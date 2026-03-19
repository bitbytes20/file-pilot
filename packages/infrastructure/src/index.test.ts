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
  ScanEventRepository,
  ScanJobRepository,
  StreamingFileHasher,
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
  it('persists hash state and duplicate query data in SQLite', async () => {
    const dir = await createTempDir();
    const db = await bootstrapDatabase(path.join(dir, 'filepilot.sqlite'));
    const jobs = new ScanJobRepository(db.database);
    const files = new FileRepository(db.database);
    const analysisJobs = new DuplicateAnalysisJobRepository(db.database);
    const groups = new DuplicateGroupRepository(db.database);

    const job = jobs.create('/tmp/example');
    jobs.update(job.id, { status: 'completed', completedAt: new Date().toISOString() });
    const first = files.insert({ jobId: job.id, absolutePath: '/tmp/example/a.txt', fileName: 'a.txt', extension: 'txt', sizeBytes: 12, createdAt: null, modifiedAt: null, category: 'document' });
    const second = files.insert({ jobId: job.id, absolutePath: '/tmp/example/b.txt', fileName: 'b.txt', extension: 'txt', sizeBytes: 12, createdAt: null, modifiedAt: null, category: 'document' });
    files.updateHashState(first.id, { hashStatus: 'hashed', contentHash: 'abc', hashAlgorithm: 'sha256', hashedAt: '2026-03-19T00:00:00.000Z', hashError: null });
    files.updateHashState(second.id, { hashStatus: 'hashed', contentHash: 'abc', hashAlgorithm: 'sha256', hashedAt: '2026-03-19T00:00:00.000Z', hashError: null });

    const analysis = analysisJobs.create(job.id);
    groups.replaceForAnalysis(analysis.id, job.id, [{ contentHash: 'abc', hashAlgorithm: 'sha256', files: [files.getById(first.id)!, files.getById(second.id)!] }]);

    assert.equal(files.getById(first.id)?.hashStatus, 'hashed');
    assert.equal(groups.listByScanJobId(job.id).length, 1);
    assert.equal(groups.listFiles(groups.listByScanJobId(job.id)[0]!.id).length, 2);
  });
});

describe('hashing and duplicate analysis', () => {
  it('hashes files deterministically by streaming full file contents', async () => {
    const dir = await createTempDir();
    const file = path.join(dir, 'payload.bin');
    await fs.writeFile(file, 'same-content'.repeat(10_000));
    const hasher = new StreamingFileHasher();
    const left = await hasher.hashFile(file);
    const right = await hasher.hashFile(file);
    assert.equal(left, right);
  });

  it('runs scan results through hashing and duplicate grouping', async () => {
    const dir = await createTempDir();
    const root = path.join(dir, 'root');
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, 'a.txt'), 'duplicate');
    await fs.writeFile(path.join(root, 'b.txt'), 'duplicate');
    await fs.writeFile(path.join(root, 'c.txt'), 'unique');

    const db = await bootstrapDatabase(path.join(dir, 'filepilot.sqlite'));
    const jobs = new ScanJobRepository(db.database);
    const files = new FileRepository(db.database);
    const analysisJobs = new DuplicateAnalysisJobRepository(db.database);
    const groups = new DuplicateGroupRepository(db.database);
    const job = jobs.create(root);
    jobs.update(job.id, { status: 'completed', completedAt: new Date().toISOString() });
    files.insert({ jobId: job.id, absolutePath: path.join(root, 'a.txt'), fileName: 'a.txt', extension: 'txt', sizeBytes: 9, createdAt: null, modifiedAt: null, category: 'document' });
    files.insert({ jobId: job.id, absolutePath: path.join(root, 'b.txt'), fileName: 'b.txt', extension: 'txt', sizeBytes: 9, createdAt: null, modifiedAt: null, category: 'document' });
    files.insert({ jobId: job.id, absolutePath: path.join(root, 'c.txt'), fileName: 'c.txt', extension: 'txt', sizeBytes: 6, createdAt: null, modifiedAt: null, category: 'document' });

    const analyzer = new DuplicateAnalyzer(jobs, files, analysisJobs, groups, new StreamingFileHasher());
    const result = await analyzer.start(job.id).promise;
    const persistedGroups = groups.listByScanJobId(job.id);

    assert.equal(result.status, 'completed');
    assert.equal(result.duplicateGroups, 1);
    assert.equal(persistedGroups[0]?.fileCount, 2);
    assert.equal(groups.listFiles(persistedGroups[0]!.id).length, 2);
    assert.equal(groups.summarizeByScanJobId(job.id).reclaimableBytes, 9);
  });
});
