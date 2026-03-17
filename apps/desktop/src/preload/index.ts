import { contextBridge } from 'electron';

declare global {
  interface Window {
    filepilot: {
      version: () => string;
    };
  }
}

const api = {
  version: (): string => process.versions.electron,
} as const;

contextBridge.exposeInMainWorld('filepilot', api);
