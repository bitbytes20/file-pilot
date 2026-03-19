import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildEventListMarkup, buildFileRowsMarkup, formatBytes } from './index.ts';

describe('renderer helpers', () => {
  it('formats bytes for display', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(1536), '1.5 KB');
  });

  it('builds file table markup for scan results', () => {
    const markup = buildFileRowsMarkup([
      {
        id: 'file-1',
        absolutePath: '/tmp/example.txt',
        fileName: 'example.txt',
        extension: 'txt',
        sizeBytes: 42,
        createdAt: null,
        modifiedAt: null,
        category: 'document',
      },
    ]);

    assert.match(markup, /example\.txt/);
    assert.match(markup, /\/tmp\/example\.txt/);
    assert.match(markup, /42 B/);
  });

  it('builds diagnostics markup for scan events', () => {
    const markup = buildEventListMarkup([
      {
        id: 'event-1',
        jobId: 'job-1',
        level: 'warning',
        eventType: 'permission_denied',
        message: 'Permission denied while reading path.',
        path: '/tmp/private',
        createdAt: '2026-03-19T00:00:00.000Z',
      },
    ]);

    assert.match(markup, /permission_denied/);
    assert.match(markup, /Permission denied while reading path\./);
    assert.match(markup, /\/tmp\/private/);
  });
});
