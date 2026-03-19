import { app, BrowserWindow } from 'electron';
import { logger } from './logger.js';
import { configureUserDataPath, preloadBundlePath, rendererBundlePath } from './paths.js';
import { enforceSecurityDefaults } from './security.js';
import { registerIpcHandlers } from './ipc/registerHandlers.js';
import { buildRendererHtml } from './ui/rendererHtml.js';
import { createMainWindow } from './windows/mainWindow.js';

const isMac = process.platform === 'darwin';
const isDev = process.env.NODE_ENV === 'development';

configureUserDataPath();

const getRendererUrl = async () => {
  const html = await buildRendererHtml(rendererBundlePath);
  const encoded = encodeURIComponent(html);
  return `data:text/html;charset=utf-8,${encoded}`;
};

const loadMainWindow = async (): Promise<void> => {
  const window = createMainWindow({
    preloadPath: preloadBundlePath,
    devTools: isDev,
  });

  await window.loadURL(await getRendererUrl());
};

const bootstrap = async () => {
  await app.whenReady();
  logger.info('Electron app ready.', {
    userDataPath: app.getPath('userData'),
    preloadBundlePath,
    rendererBundlePath,
    packaged: app.isPackaged,
  });
  await enforceSecurityDefaults();
  registerIpcHandlers();
  await loadMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      loadMainWindow().catch((error) => {
        logger.error('Failed to load renderer UI', error);
      });
    }
  });
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  });
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
app.setAppUserModelId('dev.filepilot.desktop');
bootstrap().catch((error) => {
  logger.error('Failed to bootstrap Electron app', error);
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});
