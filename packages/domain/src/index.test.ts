import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDuplicateSummary,
  calculateReclaimableBytes,
  selectDuplicateHashCandidates,
  selectKeepRecommendation,
} from './index.ts';

describe('duplicate domain helpers', () => {
  it('selects only same-size files that still need hashing', () => {
    const result = selectDuplicateHashCandidates([
      { fileId: 'a', absolutePath: '/a', sizeBytes: 100, hashStatus: 'pending', contentHash: null, hashAlgorithm: null },
      { fileId: 'b', absolutePath: '/b', sizeBytes: 100, hashStatus: 'hashed', contentHash: 'x', hashAlgorithm: 'sha256' },
      { fileId: 'c', absolutePath: '/c', sizeBytes: 100, hashStatus: 'failed', contentHash: null, hashAlgorithm: 'sha256' },
      { fileId: 'd', absolutePath: '/d', sizeBytes: 50, hashStatus: 'pending', contentHash: null, hashAlgorithm: null },
    ]);

    assert.deepEqual(result.map((entry) => entry.fileId), ['a', 'c']);
  });

  it('calculates reclaimable bytes and summary totals', () => {
    assert.equal(calculateReclaimableBytes(512, 3), 1024);
    const summary = buildDuplicateSummary([{ fileCount: 3, totalBytes: 1536, reclaimableBytes: 1024 }]);
    assert.deepEqual(summary, { totalGroups: 1, totalFiles: 3, duplicateBytes: 1536, reclaimableBytes: 1024 });
  });

  it('chooses a deterministic keep recommendation', () => {
    const selected = selectKeepRecommendation([
      { fileId: 'a', absolutePath: '/b', modifiedAt: '2024-01-01T00:00:00.000Z', createdAt: '2024-01-01T00:00:00.000Z' },
      { fileId: 'b', absolutePath: '/a', modifiedAt: '2024-02-01T00:00:00.000Z', createdAt: '2024-01-01T00:00:00.000Z' },
    ]);
    assert.equal(selected, 'b');
  });
});
