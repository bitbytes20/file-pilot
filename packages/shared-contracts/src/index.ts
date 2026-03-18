export const ipcChannels = {
  appGetVersion: 'app:get-version',
  dialogSelectFolder: 'dialog:select-folder',
  scanStartMock: 'scan:start-mock',
  scanProgress: 'scan:progress',
  scanComplete: 'scan:complete',
} as const;

export type IpcInvokeChannel =
  | (typeof ipcChannels)['appGetVersion']
  | (typeof ipcChannels)['dialogSelectFolder']
  | (typeof ipcChannels)['scanStartMock'];

export type IpcEventChannel =
  | (typeof ipcChannels)['scanProgress']
  | (typeof ipcChannels)['scanComplete'];

export interface FolderSelectionResult {
  readonly canceled: boolean;
  readonly folderPath: string | null;
}

export interface ScanStartRequest {
  readonly rootPath: string;
}

export interface ScanSession {
  readonly sessionId: string;
  readonly rootPath: string;
  readonly startedAt: string;
}

export interface ScanProgressEvent {
  readonly sessionId: string;
  readonly processedPaths: number;
  readonly discoveredFiles: number;
  readonly scannedBytes: number;
  readonly percentComplete: number;
  readonly currentPath: string;
}

export interface ScanCompleteEvent {
  readonly sessionId: string;
  readonly processedPaths: number;
  readonly discoveredFiles: number;
  readonly scannedBytes: number;
  readonly completedAt: string;
  readonly rootPath: string;
}

export interface FilePilotApi {
  readonly getVersion: () => Promise<string>;
  readonly selectFolder: () => Promise<FolderSelectionResult>;
  readonly startMockScan: (request: ScanStartRequest) => Promise<ScanSession>;
  readonly onScanProgress: (listener: (event: ScanProgressEvent) => void) => () => void;
  readonly onScanComplete: (listener: (event: ScanCompleteEvent) => void) => () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const parseScanStartRequest = (value: unknown): ScanStartRequest => {
  if (
    !isRecord(value) ||
    typeof value.rootPath !== 'string' ||
    value.rootPath.trim().length === 0
  ) {
    throw new TypeError('Expected a scan request with a non-empty rootPath string.');
  }

  return {
    rootPath: value.rootPath,
  };
};

export const parseScanProgressEvent = (value: unknown): ScanProgressEvent => {
  if (
    !isRecord(value) ||
    typeof value.sessionId !== 'string' ||
    typeof value.processedPaths !== 'number' ||
    typeof value.discoveredFiles !== 'number' ||
    typeof value.scannedBytes !== 'number' ||
    typeof value.percentComplete !== 'number' ||
    typeof value.currentPath !== 'string'
  ) {
    throw new TypeError('Expected a valid scan progress payload.');
  }

  return {
    sessionId: value.sessionId,
    processedPaths: value.processedPaths,
    discoveredFiles: value.discoveredFiles,
    scannedBytes: value.scannedBytes,
    percentComplete: value.percentComplete,
    currentPath: value.currentPath,
  };
};

export const parseScanCompleteEvent = (value: unknown): ScanCompleteEvent => {
  if (
    !isRecord(value) ||
    typeof value.sessionId !== 'string' ||
    typeof value.processedPaths !== 'number' ||
    typeof value.discoveredFiles !== 'number' ||
    typeof value.scannedBytes !== 'number' ||
    typeof value.completedAt !== 'string' ||
    typeof value.rootPath !== 'string'
  ) {
    throw new TypeError('Expected a valid scan completion payload.');
  }

  return {
    sessionId: value.sessionId,
    processedPaths: value.processedPaths,
    discoveredFiles: value.discoveredFiles,
    scannedBytes: value.scannedBytes,
    completedAt: value.completedAt,
    rootPath: value.rootPath,
  };
};
