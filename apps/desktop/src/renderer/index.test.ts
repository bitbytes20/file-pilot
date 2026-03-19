import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDuplicateGroupFileMarkup,
  buildDuplicateGroupMarkup,
  buildEventListMarkup,
  buildFileRowsMarkup,
  formatBytes,
} from './index.ts';

describe('renderer helpers', () => {
  it('formats bytes for display', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(1536), '1.5 KB');
  });

  it('builds file table markup for scan results', () => {
    const markup = buildFileRowsMarkup([{ id: 'file-1', absolutePath: '/tmp/example.txt', fileName: 'example.txt', extension: 'txt', sizeBytes: 42, createdAt: null, modifiedAt: null, category: 'document', hashStatus: 'hashed', contentHash: 'abc' }]);
    assert.match(markup, /example\.txt/);
    assert.match(markup, /hashed/);
  });

  it('builds diagnostics markup for scan events', () => {
    const markup = buildEventListMarkup([{ id: 'event-1', jobId: 'job-1', level: 'warning', eventType: 'permission_denied', message: 'Permission denied while reading path.', path: '/tmp/private', createdAt: '2026-03-19T00:00:00.000Z' }]);
    assert.match(markup, /permission_denied/);
    assert.match(markup, /\/tmp\/private/);
  });

  it('builds duplicate review markup', () => {
    const listMarkup = buildDuplicateGroupMarkup([{ id: 'group-1', analysisJobId: 'analysis-1', scanJobId: 'scan-1', contentHash: 'abc', hashAlgorithm: 'sha256', fileCount: 2, totalBytes: 20, reclaimableBytes: 10, representativeFileId: 'file-1', keepRecommendationFileId: 'file-1', createdAt: '2026-03-19T00:00:00.000Z' }], 'group-1');
    const detailMarkup = buildDuplicateGroupFileMarkup([{ memberId: 'member-1', groupId: 'group-1', fileId: 'file-1', absolutePath: '/tmp/a.txt', fileName: 'a.txt', sizeBytes: 10, modifiedAt: null, createdAt: null, isKeepRecommendation: true, position: 0 }]);
    assert.match(listMarkup, /exact matches/);
    assert.match(detailMarkup, /Keep candidate/);
  });
});
