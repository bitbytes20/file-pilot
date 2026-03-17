import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';

export interface MainWindowConfig {
  readonly preloadPath: string;
  readonly devTools: boolean;
}

export const buildMainWindowOptions = (
  config: MainWindowConfig,
): BrowserWindowConstructorOptions => ({
  title: 'FilePilot',
  show: false,
  width: 1280,
  height: 800,
  backgroundColor: '#111111',
  webPreferences: {
    // Renderer is sandboxed and cannot access Node primitives directly.
    preload: config.preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    spellcheck: false,
    devTools: config.devTools,
    webSecurity: true,
    additionalArguments: [],
  },
});

export const createMainWindow = (config: MainWindowConfig): BrowserWindow => {
  const window = new BrowserWindow(buildMainWindowOptions(config));
  window.once('ready-to-show', () => {
    window.show();
  });
  return window;
};
