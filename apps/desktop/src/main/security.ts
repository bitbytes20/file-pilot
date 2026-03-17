import { app, shell, session, type WebContents } from 'electron';

const trustedOrigins = new Set(['file://']);

const enforceNavigationGuards = (contents: WebContents) => {
  contents.on('will-navigate', (event, url) => {
    if (![...trustedOrigins].some((origin) => url.startsWith(origin))) {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url).catch((error) => {
        console.error('Failed to open external url', url, error);
      });
    }
    return { action: 'deny' };
  });
};

const applyContentSecurityPolicy = () => {
  const defaultCsp = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:;";
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const sanitized: Record<string, string | string[]> = {};
    const existingHeaders = details.responseHeaders ?? {};

    for (const [key, value] of Object.entries(existingHeaders)) {
      if (typeof value === 'undefined') {
        continue;
      }
      sanitized[key] = value;
    }

    sanitized['Content-Security-Policy'] = [defaultCsp];

    callback({
      responseHeaders: sanitized,
    });
  });
};

export const enforceSecurityDefaults = async () => {
  app.on('web-contents-created', (_, contents) => {
    enforceNavigationGuards(contents);
  });

  app.on('browser-window-created', (_, window) => {
    window.removeMenu();
  });

  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  applyContentSecurityPolicy();
};
