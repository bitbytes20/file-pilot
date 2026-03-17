export type IpcChannel = 'scan:start' | 'scan:progress' | 'scan:complete';

export interface ScanStartRequest {
  roots: string[];
}

export interface ScanProgressEvent {
  processedPaths: number;
  scannedBytes: number;
}
