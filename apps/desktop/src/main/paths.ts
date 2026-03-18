import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mainDirname = path.dirname(fileURLToPath(import.meta.url));

export const resolveFromMainBundle = (...segments: string[]) => path.join(mainDirname, ...segments);

export const preloadBundlePath = resolveFromMainBundle('../preload/index.js');
export const rendererBundlePath = resolveFromMainBundle('../renderer/index.js');
