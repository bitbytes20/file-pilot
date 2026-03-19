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
} from './index.ts';

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'filepilot-infra-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('repositories', () => {
  it('persists scan jobs, files, and events in SQLite', async () => {
    const dir = await createTempDir();
    const db = await bootstrapDatabase(path.join(dir, 'filepilot.sqlite'));
    const jobs = new ScanJobRepository(db.database);
    const files = new FileRepository(db.database);
    const events = new ScanEventRepository(db.database);

    const job = jobs.create('/tmp/example');
    const updated = jobs.update(job.id, {
      status: 'running',
      processedPaths: 3,
      currentPath: '/tmp/example/a.txt',
    });
    files.insert({
      jobId: job.id,
      absolutePath: '/tmp/example/a.txt',
      fileName: 'a.txt',
      extension: 'txt',
      sizeBytes: 12,
      createdAt: '2024-01-01T00:00:00.000Z',
      modifiedAt: '2024-01-02T00:00:00.000Z',
      category: 'document',
    });
    events.record({
      jobId: job.id,
      level: 'warning',
      eventType: 'directory_skipped',
      message: 'denied',
      path: '/tmp/example/private',
    });

    assert.equal(updated.status, 'running');
    assert.equal(jobs.getById(job.id)?.processedPaths, 3);
    assert.equal(files.listByJobId(job.id).length, 1);
    assert.equal(events.listByJobId(job.id).length, 1);
  });

  it('marks stale pending and running jobs as failed on recovery', async () => {
    const dir = await createTempDir();
    const db = await bootstrapDatabase(path.join(dir, 'filepilot.sqlite'));
    const jobs = new ScanJobRepository(db.database);
    const pending = jobs.create('/tmp/pending');
    const running = jobs.create('/tmp/running');
    jobs.update(running.id, { status: 'running' });

    const changed = jobs.failStaleJobs('Recovered after restart');

    assert.equal(changed, 2);
    assert.equal(jobs.getById(pending.id)?.status, 'failed');
    assert.equal(jobs.getById(running.id)?.errorMessage, 'Recovered after restart');
  });
});

describe('scanner', () => {
  it('scans a directory tree, persists files, and skips symlinks', async () => {
    const dir = await createTempDir();
    const root = path.join(dir, 'root');
    await fs.mkdir(path.join(root, 'nested'), { recursive: true });
    await fs.writeFile(path.join(root, 'alpha.txt'), 'alpha');
    await fs.writeFile(path.join(root, 'nested', 'beta.json'), '{"ok":true}');
    await fs.symlink(path.join(root, 'alpha.txt'), path.join(root, 'nested', 'alpha.link'));

    const db = await bootstrapDatabase(path.join(dir, 'filepilot.sqlite'));
    const jobs = new ScanJobRepository(db.database);
    const files = new FileRepository(db.database);
    const events = new ScanEventRepository(db.database);
    const scanner = new FileScanner(jobs, files, events, {
      progressEveryPaths: 1,
      progressEveryMs: 0,
    });

    const controller = scanner.start(root);
    const job = await controller.promise;
    const persistedFiles = files.listByJobId(job.id);
    const recordedEvents = events.listByJobId(job.id);

    assert.equal(job.status, 'completed');
    assert.equal(job.discoveredFiles, 2);
    assert.deepEqual(
      persistedFiles.map((entry) => entry.fileName),
      ['alpha.txt', 'beta.json']
    );
    assert.ok(recordedEvents.some((entry) => entry.eventType === 'symlink_skipped'));
  });

  it('supports cancellation', async () => {
    const dir = await createTempDir();
    const root = path.join(dir, 'root');
    await fs.mkdir(root, { recursive: true });
    for (let index = 0; index < 250; index += 1) {
      await fs.writeFile(path.join(root, `file-${index}.txt`), `payload-${index}`.repeat(200));
    }

    const db = await bootstrapDatabase(path.join(dir, 'filepilot.sqlite'));
    const jobs = new ScanJobRepository(db.database);
    const files = new FileRepository(db.database);
    const events = new ScanEventRepository(db.database);
    const scanner = new FileScanner(jobs, files, events, {
      progressEveryPaths: 1,
      progressEveryMs: 0,
    });

    const controller = scanner.start(root, {
      onProgress: ({ job }) => {
        if (job.processedPaths >= 5) {
          controller.cancel();
        }
      },
    });
    const job = await controller.promise;

    assert.equal(job.status, 'cancelled');
    assert.ok(files.listByJobId(job.id).length > 0);
    assert.ok(files.listByJobId(job.id).length < 250);
    assert.ok(events.listByJobId(job.id).some((event) => event.eventType === 'scan_cancelled'));
  });

  it('fails cleanly when the selected root path is missing', async () => {
    const dir = await createTempDir();
    const db = await bootstrapDatabase(path.join(dir, 'filepilot.sqlite'));
    const jobs = new ScanJobRepository(db.database);
    const files = new FileRepository(db.database);
    const events = new ScanEventRepository(db.database);
    const scanner = new FileScanner(jobs, files, events);

    const missingRoot = path.join(dir, 'missing-root');
    const job = await scanner.start(missingRoot).promise;

    assert.equal(job.status, 'failed');
    assert.match(job.errorMessage ?? '', /no such file|ENOENT|missing/i);
    assert.equal(files.listByJobId(job.id).length, 0);
    assert.ok(events.listByJobId(job.id).some((event) => event.eventType === 'scan_failed'));
  });
});
