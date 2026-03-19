import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
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
    assert.throws(() => parseScanListFilesRequest({ jobId: 'job-1', limit: 0 }));
    assert.throws(() => parseScanListEventsRequest({ jobId: 'job-1', limit: -1 }));
  });

  it('parses event list responses', () => {
    const result = parseScanEventListResponse([
      {
        id: 'event-1',
        jobId: 'job-1',
        level: 'warning',
        eventType: 'permission_denied',
        message: 'denied',
        path: '/tmp/private',
        createdAt: '2026-03-19T00:00:00.000Z',
      },
    ]);

    assert.equal(result[0]?.eventType, 'permission_denied');
  });
});
