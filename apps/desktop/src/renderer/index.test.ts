import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFileRowsMarkup, formatBytes } from './index.ts';

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
});
