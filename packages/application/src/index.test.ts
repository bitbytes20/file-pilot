import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  DuplicateAnalysisJobRepository,
  DuplicateAnalyzer,
  DuplicateGroupRepository,
  FileRepository,
  FileScanner,
  ScanEventRepository,
  ScanJobRepository,
  StreamingFileHasher,
  bootstrapDatabase,
} from '../../infrastructure/src/index.ts';
import { DuplicateCoordinator, ScanCoordinator } from './index.ts';

const tempDirs: string[] = [];
const createTempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'filepilot-app-'));
  tempDirs.push(dir);
  return dir;
};
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('coordinators', () => {
  it('orchestrates scan and duplicate analysis flows against SQLite-backed services', async () => {
    const dir = await createTempDir();
    const root = path.join(dir, 'root');
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, 'alpha.txt'), 'duplicate');
    await fs.writeFile(path.join(root, 'beta.txt'), 'duplicate');

    const db = await bootstrapDatabase(path.join(dir, 'filepilot.sqlite'));
    const jobs = new ScanJobRepository(db.database);
    const files = new FileRepository(db.database);
    const events = new ScanEventRepository(db.database);
    const scanner = new FileScanner(jobs, files, events);
    const scanCoordinator = new ScanCoordinator({ scanner, jobs, files, events });

    const scanJob = await scanCoordinator.startScan(root);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const analysisJobs = new DuplicateAnalysisJobRepository(db.database);
    const groups = new DuplicateGroupRepository(db.database);
    const duplicateCoordinator = new DuplicateCoordinator({ analyzer: new DuplicateAnalyzer(jobs, files, analysisJobs, groups, new StreamingFileHasher()), analysisJobs, groups });
    const analysisJob = await duplicateCoordinator.startAnalysis(scanJob.id);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const latest = await duplicateCoordinator.getLatestAnalysisForScan(scanJob.id);
    const duplicateGroups = await duplicateCoordinator.listGroups(scanJob.id);
    const duplicateFiles = await duplicateCoordinator.listGroupFiles(duplicateGroups[0]!.id);

    assert.equal(latest?.id, analysisJob.id);
    assert.equal(duplicateGroups.length, 1);
    assert.equal(duplicateFiles.length, 2);
  });
});
