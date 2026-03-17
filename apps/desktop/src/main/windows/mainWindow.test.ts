import { describe, expect, it } from 'vitest';
import { buildMainWindowOptions } from './mainWindow.js';

describe('buildMainWindowOptions', () => {
  it('enforces secure defaults on the BrowserWindow', () => {
    const options = buildMainWindowOptions({
      preloadPath: '/tmp/preload.js',
      devTools: false,
    });

    expect(options.title).toBe('FilePilot');
    expect(options.webPreferences?.contextIsolation).toBe(true);
    expect(options.webPreferences?.nodeIntegration).toBe(false);
    expect(options.webPreferences?.sandbox).toBe(true);
    expect(options.webPreferences?.preload).toBe('/tmp/preload.js');
    expect(options.webPreferences?.devTools).toBe(false);
  });
});
