import type { FilePilotApi } from '@filepilot/shared-contracts';

declare global {
  interface Window {
    filePilot: FilePilotApi;
  }
}

export {};
