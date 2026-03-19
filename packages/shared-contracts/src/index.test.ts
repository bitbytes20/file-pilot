import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseDuplicateAnalysisJobResponse,
  parseDuplicateGroupListResponse,
  parseDuplicatesListGroupsRequest,
  parseScanEventListResponse,
  parseScanListEventsRequest,
  parseScanListFilesRequest,
  parseScanStartRequest,
} from './index.ts';

describe('shared scan contract parsing', () => {
  it('parses scan start requests', () => {
    assert.deepEqual(parseScanStartRequest({ rootPath: '/tmp/root' }), { rootPath: '/tmp/root' });
  });

  it('rejects invalid list limits', () => {
    assert.throws(() => parseScanListFilesRequest({ jobId: 'job-1', limit: -1 }));
    assert.throws(() => parseScanListEventsRequest({ jobId: 'job-1', limit: -1 }));
    assert.throws(() => parseDuplicatesListGroupsRequest({ scanJobId: 'scan-1', offset: -1 }));
  });

  it('parses event list responses', () => {
    const result = parseScanEventListResponse([{ id: 'event-1', jobId: 'job-1', level: 'warning', eventType: 'permission_denied', message: 'denied', path: '/tmp/private', createdAt: '2026-03-19T00:00:00.000Z' }]);
    assert.equal(result[0]?.eventType, 'permission_denied');
  });

  it('parses duplicate responses', () => {
    const job = parseDuplicateAnalysisJobResponse({
      id: 'analysis-1', scanJobId: 'scan-1', status: 'completed', phase: 'completed', totalCandidates: 2, hashedFiles: 2,
      duplicateGroups: 1, duplicateFiles: 2, duplicateBytes: 20, reclaimableBytes: 10, currentFileId: null, currentPath: null,
      progressPercent: 100, hashAlgorithm: 'sha256', errorMessage: null, startedAt: '2026-03-19T00:00:00.000Z',
      completedAt: '2026-03-19T00:00:01.000Z', cancelledAt: null, updatedAt: '2026-03-19T00:00:01.000Z'
    });
    const groups = parseDuplicateGroupListResponse([{ id: 'group-1', analysisJobId: 'analysis-1', scanJobId: 'scan-1', contentHash: 'abc', hashAlgorithm: 'sha256', fileCount: 2, totalBytes: 20, reclaimableBytes: 10, representativeFileId: 'file-1', keepRecommendationFileId: 'file-1', createdAt: '2026-03-19T00:00:01.000Z' }]);
    assert.equal(job?.status, 'completed');
    assert.equal(groups[0]?.contentHash, 'abc');
  });
});
