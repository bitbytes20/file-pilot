import { app, BrowserWindow } from 'electron';
import { buildPlaceholderHtml } from './ui/placeholderHtml.js';
import { logger } from './logger.js';
import { enforceSecurityDefaults } from './security.js';
import { preloadBundlePath } from './paths.js';
import { createMainWindow } from './windows/mainWindow.js';

const isMac = process.platform === 'darwin';
const isDev = process.env.NODE_ENV === 'development';

const getPlaceholderUrl = () => {
  // Keep renderer responsibilities isolated; temporary HTML is loaded via data URL until the
  // dedicated renderer workspace is implemented in Tranche B.
  const html = buildPlaceholderHtml(app.getVersion());
  const encoded = encodeURIComponent(html);
  return `data:text/html;charset=utf-8,${encoded}`;
};

const bootstrap = async () => {
  await app.whenReady();
  await enforceSecurityDefaults();

  const window = createMainWindow({
    preloadPath: preloadBundlePath,
    devTools: isDev,
  });

  await window.loadURL(getPlaceholderUrl());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createMainWindow({
        preloadPath: preloadBundlePath,
        devTools: isDev,
      });
      newWindow.loadURL(getPlaceholderUrl()).catch((error) => {
        logger.error('Failed to load placeholder UI', error);
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
