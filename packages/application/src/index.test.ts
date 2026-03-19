import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  FileRepository,
  FileScanner,
  ScanEventRepository,
  ScanJobRepository,
  bootstrapDatabase,
} from '../../infrastructure/src/index.ts';
import { ScanCoordinator } from './index.ts';

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'filepilot-app-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('ScanCoordinator', () => {
  it('orchestrates start/get/list flows against the SQLite-backed scanner', async () => {
    const dir = await createTempDir();
    const root = path.join(dir, 'root');
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, 'gamma.ts'), 'export const gamma = true;');

    const db = await bootstrapDatabase(path.join(dir, 'filepilot.sqlite'));
    const jobs = new ScanJobRepository(db.database);
    const files = new FileRepository(db.database);
    const events = new ScanEventRepository(db.database);
    const scanner = new FileScanner(jobs, files, events);
    const coordinator = new ScanCoordinator({ scanner, jobs, files, events });

    const job = await coordinator.startScan(root);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const recent = await coordinator.listRecentJobs();
    const current = await coordinator.getScanJob(job.id);
    const persistedFiles = await coordinator.listFilesForJob(job.id);
    const recordedEvents = await coordinator.listEventsForJob(job.id);

    assert.equal(recent[0]?.id, job.id);
    assert.equal(current?.rootPath, root);
    assert.equal(persistedFiles.length, 1);
    assert.equal(persistedFiles[0]?.category, 'code');
    assert.ok(recordedEvents.some((event) => event.eventType === 'scan_completed'));
  });

  it('recovers interrupted scans on app restart', async () => {
    const dir = await createTempDir();
    const db = await bootstrapDatabase(path.join(dir, 'filepilot.sqlite'));
    const jobs = new ScanJobRepository(db.database);
    const files = new FileRepository(db.database);
    const events = new ScanEventRepository(db.database);
    const scanner = new FileScanner(jobs, files, events);
    const coordinator = new ScanCoordinator({ scanner, jobs, files, events });

    const job = jobs.create('/tmp/interrupted');
    jobs.update(job.id, { status: 'running' });

    const changed = await coordinator.recoverInterruptedScans();

    assert.equal(changed, 1);
    assert.equal(jobs.getById(job.id)?.status, 'failed');
  });
});
