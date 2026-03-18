import { contextBridge, ipcRenderer } from 'electron';
import {
  ipcChannels,
  parseScanCompleteEvent,
  parseScanProgressEvent,
  parseScanStartRequest,
  type FilePilotApi,
  type ScanCompleteEvent,
  type ScanProgressEvent,
} from '@filepilot/shared-contracts';

declare global {
  interface Window {
    filePilot: FilePilotApi;
  }
}

const registerEvent = <T>(
  channel: string,
  parser: (value: unknown) => T,
  listener: (event: T) => void
): (() => void) => {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) => {
    listener(parser(payload));
  };

  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
};

const api: FilePilotApi = {
  getVersion: async () => ipcRenderer.invoke(ipcChannels.appGetVersion),
  selectFolder: async () => ipcRenderer.invoke(ipcChannels.dialogSelectFolder),
  startMockScan: async (request) =>
    ipcRenderer.invoke(ipcChannels.scanStartMock, parseScanStartRequest(request)),
  onScanProgress: (listener: (event: ScanProgressEvent) => void) =>
    registerEvent(ipcChannels.scanProgress, parseScanProgressEvent, listener),
  onScanComplete: (listener: (event: ScanCompleteEvent) => void) =>
    registerEvent(ipcChannels.scanComplete, parseScanCompleteEvent, listener),
};

contextBridge.exposeInMainWorld('filePilot', api);
