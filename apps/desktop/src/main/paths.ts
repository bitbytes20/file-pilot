import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';

const mainDirname = path.dirname(fileURLToPath(import.meta.url));

export const resolveFromMainBundle = (...segments: string[]) => path.join(mainDirname, ...segments);

export const preloadBundlePath = resolveFromMainBundle('../preload/index.js');
export const rendererBundlePath = resolveFromMainBundle('../renderer/index.js');

export const configureUserDataPath = (): string => {
  const override = process.env.FILEPILOT_USER_DATA_DIR;
  if (override) {
    app.setPath('userData', override);
    return override;
  }

  return app.getPath('userData');
};

export const resolveDatabasePath = (): string =>
  path.join(app.getPath('userData'), 'filepilot.sqlite');
