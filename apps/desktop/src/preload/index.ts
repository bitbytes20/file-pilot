import { contextBridge, ipcRenderer } from 'electron';
import {
  ipcChannels,
  parseScanCancelRequest,
  parseScanCompleteEvent,
  parseScanEventListResponse,
  parseScanFileListResponse,
  parseScanGetJobRequest,
  parseScanJobListResponse,
  parseScanJobResponse,
  parseScanListEventsRequest,
  parseScanListFilesRequest,
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
  startScan: async (request) =>
    parseScanJobResponse(
      await ipcRenderer.invoke(ipcChannels.scanStart, parseScanStartRequest(request))
    )!,
  getScanJob: async (request) =>
    parseScanJobResponse(
      await ipcRenderer.invoke(ipcChannels.scanGetJob, parseScanGetJobRequest(request))
    ),
  listRecentScanJobs: async () =>
    parseScanJobListResponse(await ipcRenderer.invoke(ipcChannels.scanListRecentJobs)),
  listFilesForJob: async (request) =>
    parseScanFileListResponse(
      await ipcRenderer.invoke(ipcChannels.scanListFiles, parseScanListFilesRequest(request))
    ),
  listEventsForJob: async (request) =>
    parseScanEventListResponse(
      await ipcRenderer.invoke(ipcChannels.scanListEvents, parseScanListEventsRequest(request))
    ),
  cancelScan: async (request) =>
    parseScanJobResponse(
      await ipcRenderer.invoke(ipcChannels.scanCancel, parseScanCancelRequest(request))
    ),
  onScanProgress: (listener: (event: ScanProgressEvent) => void) =>
    registerEvent(ipcChannels.scanProgress, parseScanProgressEvent, listener),
  onScanComplete: (listener: (event: ScanCompleteEvent) => void) =>
    registerEvent(ipcChannels.scanComplete, parseScanCompleteEvent, listener),
};

contextBridge.exposeInMainWorld('filePilot', api);
