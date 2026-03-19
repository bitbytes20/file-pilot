import { contextBridge, ipcRenderer } from 'electron';
import {
  ipcChannels,
  parseDuplicateAnalysisCompleteEvent,
  parseDuplicateAnalysisJobResponse,
  parseDuplicateAnalysisProgressEvent,
  parseDuplicateGroupFileListResponse,
  parseDuplicateGroupListResponse,
  parseDuplicateGroupResponse,
  parseDuplicateSummaryResponse,
  parseDuplicatesCancelAnalysisRequest,
  parseDuplicatesGetAnalysisJobRequest,
  parseDuplicatesGetGroupRequest,
  parseDuplicatesGetLatestAnalysisRequest,
  parseDuplicatesListGroupFilesRequest,
  parseDuplicatesListGroupsRequest,
  parseDuplicatesStartAnalysisRequest,
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
  type DuplicateAnalysisCompleteEvent,
  type DuplicateAnalysisProgressEvent,
  type FilePilotApi,
  type ScanCompleteEvent,
  type ScanProgressEvent,
} from '@filepilot/shared-contracts';

declare global {
  interface Window {
    filePilot: FilePilotApi;
  }
}

const registerEvent = <T>(channel: string, parser: (value: unknown) => T, listener: (event: T) => void): (() => void) => {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) => {
    listener(parser(payload));
  };
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
};

const api: FilePilotApi = {
  getVersion: async () => ipcRenderer.invoke(ipcChannels.appGetVersion),
  selectFolder: async () => ipcRenderer.invoke(ipcChannels.dialogSelectFolder),
  startScan: async (request) => parseScanJobResponse(await ipcRenderer.invoke(ipcChannels.scanStart, parseScanStartRequest(request)))!,
  getScanJob: async (request) => parseScanJobResponse(await ipcRenderer.invoke(ipcChannels.scanGetJob, parseScanGetJobRequest(request))),
  listRecentScanJobs: async () => parseScanJobListResponse(await ipcRenderer.invoke(ipcChannels.scanListRecentJobs)),
  listFilesForJob: async (request) => parseScanFileListResponse(await ipcRenderer.invoke(ipcChannels.scanListFiles, parseScanListFilesRequest(request))),
  listEventsForJob: async (request) => parseScanEventListResponse(await ipcRenderer.invoke(ipcChannels.scanListEvents, parseScanListEventsRequest(request))),
  cancelScan: async (request) => parseScanJobResponse(await ipcRenderer.invoke(ipcChannels.scanCancel, parseScanCancelRequest(request))),
  startDuplicateAnalysis: async (request) => parseDuplicateAnalysisJobResponse(await ipcRenderer.invoke(ipcChannels.duplicatesStartAnalysis, parseDuplicatesStartAnalysisRequest(request)))!,
  getDuplicateAnalysisJob: async (request) => parseDuplicateAnalysisJobResponse(await ipcRenderer.invoke(ipcChannels.duplicatesGetAnalysisJob, parseDuplicatesGetAnalysisJobRequest(request))),
  getLatestDuplicateAnalysis: async (request) => parseDuplicateAnalysisJobResponse(await ipcRenderer.invoke(ipcChannels.duplicatesGetLatestAnalysis, parseDuplicatesGetLatestAnalysisRequest(request))),
  listDuplicateGroups: async (request) => parseDuplicateGroupListResponse(await ipcRenderer.invoke(ipcChannels.duplicatesListGroups, parseDuplicatesListGroupsRequest(request))),
  getDuplicateGroup: async (request) => parseDuplicateGroupResponse(await ipcRenderer.invoke(ipcChannels.duplicatesGetGroup, parseDuplicatesGetGroupRequest(request))),
  listDuplicateGroupFiles: async (request) => parseDuplicateGroupFileListResponse(await ipcRenderer.invoke(ipcChannels.duplicatesListGroupFiles, parseDuplicatesListGroupFilesRequest(request))),
  cancelDuplicateAnalysis: async (request) => parseDuplicateAnalysisJobResponse(await ipcRenderer.invoke(ipcChannels.duplicatesCancelAnalysis, parseDuplicatesCancelAnalysisRequest(request))),
  getDuplicateSummary: async (request) => parseDuplicateSummaryResponse(await ipcRenderer.invoke(ipcChannels.duplicatesGetSummary, parseDuplicatesGetLatestAnalysisRequest(request))),
  onScanProgress: (listener: (event: ScanProgressEvent) => void) => registerEvent(ipcChannels.scanProgress, parseScanProgressEvent, listener),
  onScanComplete: (listener: (event: ScanCompleteEvent) => void) => registerEvent(ipcChannels.scanComplete, parseScanCompleteEvent, listener),
  onDuplicateAnalysisProgress: (listener: (event: DuplicateAnalysisProgressEvent) => void) => registerEvent(ipcChannels.duplicatesProgress, parseDuplicateAnalysisProgressEvent, listener),
  onDuplicateAnalysisComplete: (listener: (event: DuplicateAnalysisCompleteEvent) => void) => registerEvent(ipcChannels.duplicatesComplete, parseDuplicateAnalysisCompleteEvent, listener),
};

contextBridge.exposeInMainWorld('filePilot', api);
