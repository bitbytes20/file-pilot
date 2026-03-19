import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildMainWindowOptions } from './mainWindow.ts';

describe('buildMainWindowOptions', () => {
  it('enforces secure defaults on the BrowserWindow', () => {
    const options = buildMainWindowOptions({
      preloadPath: '/tmp/preload.js',
      devTools: false,
    });

    assert.equal(options.title, 'FilePilot');
    assert.equal(options.webPreferences?.contextIsolation, true);
    assert.equal(options.webPreferences?.nodeIntegration, false);
    assert.equal(options.webPreferences?.sandbox, true);
    assert.equal(options.webPreferences?.preload, '/tmp/preload.js');
    assert.equal(options.webPreferences?.devTools, false);
  });
});
