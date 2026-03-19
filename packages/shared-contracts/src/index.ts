import type { FileCategory, FileRecord, ScanJob, ScanJobStatus } from '@filepilot/domain';

export const ipcChannels = {
  appGetVersion: 'app:get-version',
  dialogSelectFolder: 'dialog:select-folder',
  scanStart: 'scan:start',
  scanGetJob: 'scan:getJob',
  scanListRecentJobs: 'scan:listRecentJobs',
  scanListFiles: 'scan:listFiles',
  scanCancel: 'scan:cancel',
  scanProgress: 'scan:progress',
  scanComplete: 'scan:complete',
} as const;

export interface FolderSelectionResult {
  readonly canceled: boolean;
  readonly folderPath: string | null;
}

export interface ScanStartRequest {
  readonly rootPath: string;
}

export interface ScanCancelRequest {
  readonly jobId: string;
}

export interface ScanGetJobRequest {
  readonly jobId: string;
}

export interface ScanListFilesRequest {
  readonly jobId: string;
  readonly limit?: number;
}

export interface ScanFileDto {
  readonly id: string;
  readonly absolutePath: string;
  readonly fileName: string;
  readonly extension: string;
  readonly sizeBytes: number;
  readonly createdAt: string | null;
  readonly modifiedAt: string | null;
  readonly category: FileCategory;
}

export interface ScanJobDto {
  readonly id: string;
  readonly rootPath: string;
  readonly status: ScanJobStatus;
  readonly processedPaths: number;
  readonly discoveredFiles: number;
  readonly scannedBytes: number;
  readonly percentComplete: number;
  readonly currentPath: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly updatedAt: string;
}

export interface ScanProgressEvent extends ScanJobDto {}

export interface ScanCompleteEvent {
  readonly jobId: string;
  readonly status: ScanJobStatus;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly errorMessage: string | null;
}

export interface FilePilotApi {
  readonly getVersion: () => Promise<string>;
  readonly selectFolder: () => Promise<FolderSelectionResult>;
  readonly startScan: (request: ScanStartRequest) => Promise<ScanJobDto>;
  readonly getScanJob: (request: ScanGetJobRequest) => Promise<ScanJobDto | null>;
  readonly listRecentScanJobs: () => Promise<readonly ScanJobDto[]>;
  readonly listFilesForJob: (request: ScanListFilesRequest) => Promise<readonly ScanFileDto[]>;
  readonly cancelScan: (request: ScanCancelRequest) => Promise<ScanJobDto | null>;
  readonly onScanProgress: (listener: (event: ScanProgressEvent) => void) => () => void;
  readonly onScanComplete: (listener: (event: ScanCompleteEvent) => void) => () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`Expected ${field} to be a non-empty string.`);
  }

  return value;
};

const optionalString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new TypeError('Expected a string or null value.');
  }

  return value;
};

const requireNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(`Expected ${field} to be a valid number.`);
  }

  return value;
};

const parseScanJobDto = (value: unknown): ScanJobDto => {
  if (!isRecord(value)) {
    throw new TypeError('Expected a scan job payload.');
  }

  return {
    id: requireString(value.id, 'job id'),
    rootPath: requireString(value.rootPath, 'rootPath'),
    status: requireString(value.status, 'status') as ScanJobStatus,
    processedPaths: requireNumber(value.processedPaths, 'processedPaths'),
    discoveredFiles: requireNumber(value.discoveredFiles, 'discoveredFiles'),
    scannedBytes: requireNumber(value.scannedBytes, 'scannedBytes'),
    percentComplete: requireNumber(value.percentComplete, 'percentComplete'),
    currentPath: optionalString(value.currentPath),
    errorMessage: optionalString(value.errorMessage),
    startedAt: requireString(value.startedAt, 'startedAt'),
    completedAt: optionalString(value.completedAt),
    cancelledAt: optionalString(value.cancelledAt),
    updatedAt: requireString(value.updatedAt, 'updatedAt'),
  };
};

export const parseScanStartRequest = (value: unknown): ScanStartRequest => ({
  rootPath: requireString(isRecord(value) ? value.rootPath : undefined, 'rootPath'),
});

export const parseScanCancelRequest = (value: unknown): ScanCancelRequest => ({
  jobId: requireString(isRecord(value) ? value.jobId : undefined, 'jobId'),
});

export const parseScanGetJobRequest = (value: unknown): ScanGetJobRequest => ({
  jobId: requireString(isRecord(value) ? value.jobId : undefined, 'jobId'),
});

export const parseScanListFilesRequest = (value: unknown): ScanListFilesRequest => {
  if (!isRecord(value)) {
    throw new TypeError('Expected a list files request payload.');
  }

  const limit = value.limit;
  if (limit !== undefined && (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0)) {
    throw new TypeError('Expected limit to be a positive integer when provided.');
  }

  return limit === undefined
    ? {
        jobId: requireString(value.jobId, 'jobId'),
      }
    : {
        jobId: requireString(value.jobId, 'jobId'),
        limit,
      };
};

export const toScanJobDto = (job: ScanJob): ScanJobDto => ({
  id: job.id,
  rootPath: job.rootPath,
  status: job.status,
  processedPaths: job.processedPaths,
  discoveredFiles: job.discoveredFiles,
  scannedBytes: job.scannedBytes,
  percentComplete: job.percentComplete,
  currentPath: job.currentPath,
  errorMessage: job.errorMessage,
  startedAt: job.startedAt,
  completedAt: job.completedAt,
  cancelledAt: job.cancelledAt,
  updatedAt: job.updatedAt,
});

export const toScanFileDto = (file: FileRecord): ScanFileDto => ({
  id: file.id,
  absolutePath: file.absolutePath,
  fileName: file.fileName,
  extension: file.extension,
  sizeBytes: file.sizeBytes,
  createdAt: file.createdAt,
  modifiedAt: file.modifiedAt,
  category: file.category,
});

export const parseScanProgressEvent = (value: unknown): ScanProgressEvent => parseScanJobDto(value);

export const parseScanCompleteEvent = (value: unknown): ScanCompleteEvent => {
  if (!isRecord(value)) {
    throw new TypeError('Expected a scan completion payload.');
  }

  return {
    jobId: requireString(value.jobId, 'jobId'),
    status: requireString(value.status, 'status') as ScanJobStatus,
    completedAt: optionalString(value.completedAt),
    cancelledAt: optionalString(value.cancelledAt),
    errorMessage: optionalString(value.errorMessage),
  };
};

export const parseScanJobResponse = (value: unknown): ScanJobDto | null => {
  if (value === null) {
    return null;
  }

  return parseScanJobDto(value);
};

export const parseScanJobListResponse = (value: unknown): readonly ScanJobDto[] => {
  if (!Array.isArray(value)) {
    throw new TypeError('Expected an array of scan jobs.');
  }

  return value.map((entry) => parseScanJobDto(entry));
};

export const parseScanFileListResponse = (value: unknown): readonly ScanFileDto[] => {
  if (!Array.isArray(value)) {
    throw new TypeError('Expected an array of scan files.');
  }

  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new TypeError('Expected a scan file payload.');
    }

    return {
      id: requireString(entry.id, 'file id'),
      absolutePath: requireString(entry.absolutePath, 'absolutePath'),
      fileName: requireString(entry.fileName, 'fileName'),
      extension: requireString(entry.extension, 'extension'),
      sizeBytes: requireNumber(entry.sizeBytes, 'sizeBytes'),
      createdAt: optionalString(entry.createdAt),
      modifiedAt: optionalString(entry.modifiedAt),
      category: requireString(entry.category, 'category') as FileCategory,
    };
  });
};
