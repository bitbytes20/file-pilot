import type {
  DuplicateAnalysisJob,
  DuplicateAnalysisStatus,
  DuplicateGroup,
  DuplicateGroupFile,
  DuplicateSummary,
  FileCategory,
  FileHashStatus,
  FileRecord,
  ScanEventRecord,
  ScanJob,
  ScanJobStatus,
} from '@filepilot/domain';

export const ipcChannels = {
  appGetVersion: 'app:get-version',
  dialogSelectFolder: 'dialog:select-folder',
  scanStart: 'scan:start',
  scanGetJob: 'scan:getJob',
  scanListRecentJobs: 'scan:listRecentJobs',
  scanListFiles: 'scan:listFiles',
  scanListEvents: 'scan:listEvents',
  scanCancel: 'scan:cancel',
  scanProgress: 'scan:progress',
  scanComplete: 'scan:complete',
  duplicatesStartAnalysis: 'duplicates:startAnalysis',
  duplicatesGetAnalysisJob: 'duplicates:getAnalysisJob',
  duplicatesGetLatestAnalysis: 'duplicates:getLatestAnalysis',
  duplicatesListGroups: 'duplicates:listGroups',
  duplicatesGetGroup: 'duplicates:getGroup',
  duplicatesListGroupFiles: 'duplicates:listGroupFiles',
  duplicatesGetSummary: 'duplicates:getSummary',
  duplicatesCancelAnalysis: 'duplicates:cancelAnalysis',
  duplicatesProgress: 'duplicates:progress',
  duplicatesComplete: 'duplicates:complete',
} as const;

export interface FolderSelectionResult {
  readonly canceled: boolean;
  readonly folderPath: string | null;
}

export interface ScanStartRequest { readonly rootPath: string; }
export interface ScanCancelRequest { readonly jobId: string; }
export interface ScanGetJobRequest { readonly jobId: string; }
export interface ScanListFilesRequest { readonly jobId: string; readonly limit?: number; }
export interface ScanListEventsRequest { readonly jobId: string; readonly limit?: number; }

export interface DuplicatesStartAnalysisRequest { readonly scanJobId: string; }
export interface DuplicatesGetAnalysisJobRequest { readonly analysisJobId: string; }
export interface DuplicatesGetLatestAnalysisRequest { readonly scanJobId: string; }
export interface DuplicatesCancelAnalysisRequest { readonly analysisJobId: string; }
export interface DuplicatesListGroupsRequest { readonly scanJobId: string; readonly limit?: number; readonly offset?: number; }
export interface DuplicatesGetGroupRequest { readonly groupId: string; }
export interface DuplicatesListGroupFilesRequest { readonly groupId: string; readonly limit?: number; readonly offset?: number; }

export interface ScanFileDto {
  readonly id: string;
  readonly absolutePath: string;
  readonly fileName: string;
  readonly extension: string;
  readonly sizeBytes: number;
  readonly createdAt: string | null;
  readonly modifiedAt: string | null;
  readonly category: FileCategory;
  readonly hashStatus: FileHashStatus;
  readonly contentHash: string | null;
}

export interface ScanEventDto extends ScanEventRecord {}

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

export interface DuplicateAnalysisJobDto {
  readonly id: string;
  readonly scanJobId: string;
  readonly status: DuplicateAnalysisStatus;
  readonly phase: DuplicateAnalysisJob['phase'];
  readonly totalCandidates: number;
  readonly hashedFiles: number;
  readonly duplicateGroups: number;
  readonly duplicateFiles: number;
  readonly duplicateBytes: number;
  readonly reclaimableBytes: number;
  readonly currentFileId: string | null;
  readonly currentPath: string | null;
  readonly progressPercent: number;
  readonly hashAlgorithm: string;
  readonly errorMessage: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly updatedAt: string;
}

export interface DuplicateGroupDto extends DuplicateGroup {}
export interface DuplicateGroupFileDto extends DuplicateGroupFile {}
export interface DuplicateSummaryDto extends DuplicateSummary {}

export interface ScanProgressEvent extends ScanJobDto {}
export interface ScanCompleteEvent {
  readonly jobId: string;
  readonly status: ScanJobStatus;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly errorMessage: string | null;
}
export interface DuplicateAnalysisProgressEvent extends DuplicateAnalysisJobDto {}
export interface DuplicateAnalysisCompleteEvent {
  readonly analysisJobId: string;
  readonly scanJobId: string;
  readonly status: DuplicateAnalysisStatus;
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
  readonly listEventsForJob: (request: ScanListEventsRequest) => Promise<readonly ScanEventDto[]>;
  readonly cancelScan: (request: ScanCancelRequest) => Promise<ScanJobDto | null>;
  readonly startDuplicateAnalysis: (request: DuplicatesStartAnalysisRequest) => Promise<DuplicateAnalysisJobDto>;
  readonly getDuplicateAnalysisJob: (request: DuplicatesGetAnalysisJobRequest) => Promise<DuplicateAnalysisJobDto | null>;
  readonly getLatestDuplicateAnalysis: (request: DuplicatesGetLatestAnalysisRequest) => Promise<DuplicateAnalysisJobDto | null>;
  readonly listDuplicateGroups: (request: DuplicatesListGroupsRequest) => Promise<readonly DuplicateGroupDto[]>;
  readonly getDuplicateGroup: (request: DuplicatesGetGroupRequest) => Promise<DuplicateGroupDto | null>;
  readonly listDuplicateGroupFiles: (request: DuplicatesListGroupFilesRequest) => Promise<readonly DuplicateGroupFileDto[]>;
  readonly cancelDuplicateAnalysis: (request: DuplicatesCancelAnalysisRequest) => Promise<DuplicateAnalysisJobDto | null>;
  readonly getDuplicateSummary: (request: DuplicatesGetLatestAnalysisRequest) => Promise<DuplicateSummaryDto>;
  readonly onScanProgress: (listener: (event: ScanProgressEvent) => void) => () => void;
  readonly onScanComplete: (listener: (event: ScanCompleteEvent) => void) => () => void;
  readonly onDuplicateAnalysisProgress: (listener: (event: DuplicateAnalysisProgressEvent) => void) => () => void;
  readonly onDuplicateAnalysisComplete: (listener: (event: DuplicateAnalysisCompleteEvent) => void) => () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`Expected ${field} to be a non-empty string.`);
  return value;
};
const optionalString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new TypeError('Expected a string or null value.');
  return value;
};
const requireNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) throw new TypeError(`Expected ${field} to be a valid number.`);
  return value;
};
const optionalPositiveInteger = (value: unknown, field: string): number | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new TypeError(`Expected ${field} to be a non-negative integer when provided.`);
  return value;
};

const parseScanJobDto = (value: unknown): ScanJobDto => {
  if (!isRecord(value)) throw new TypeError('Expected a scan job payload.');
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

const parseDuplicateAnalysisJobDto = (value: unknown): DuplicateAnalysisJobDto => {
  if (!isRecord(value)) throw new TypeError('Expected a duplicate analysis job payload.');
  return {
    id: requireString(value.id, 'analysisJobId'),
    scanJobId: requireString(value.scanJobId, 'scanJobId'),
    status: requireString(value.status, 'status') as DuplicateAnalysisStatus,
    phase: requireString(value.phase, 'phase') as DuplicateAnalysisJob['phase'],
    totalCandidates: requireNumber(value.totalCandidates, 'totalCandidates'),
    hashedFiles: requireNumber(value.hashedFiles, 'hashedFiles'),
    duplicateGroups: requireNumber(value.duplicateGroups, 'duplicateGroups'),
    duplicateFiles: requireNumber(value.duplicateFiles, 'duplicateFiles'),
    duplicateBytes: requireNumber(value.duplicateBytes, 'duplicateBytes'),
    reclaimableBytes: requireNumber(value.reclaimableBytes, 'reclaimableBytes'),
    currentFileId: optionalString(value.currentFileId),
    currentPath: optionalString(value.currentPath),
    progressPercent: requireNumber(value.progressPercent, 'progressPercent'),
    hashAlgorithm: requireString(value.hashAlgorithm, 'hashAlgorithm'),
    errorMessage: optionalString(value.errorMessage),
    startedAt: requireString(value.startedAt, 'startedAt'),
    completedAt: optionalString(value.completedAt),
    cancelledAt: optionalString(value.cancelledAt),
    updatedAt: requireString(value.updatedAt, 'updatedAt'),
  };
};

export const parseScanStartRequest = (value: unknown): ScanStartRequest => ({ rootPath: requireString(isRecord(value) ? value.rootPath : undefined, 'rootPath') });
export const parseScanCancelRequest = (value: unknown): ScanCancelRequest => ({ jobId: requireString(isRecord(value) ? value.jobId : undefined, 'jobId') });
export const parseScanGetJobRequest = (value: unknown): ScanGetJobRequest => ({ jobId: requireString(isRecord(value) ? value.jobId : undefined, 'jobId') });
export const parseDuplicatesStartAnalysisRequest = (value: unknown): DuplicatesStartAnalysisRequest => ({ scanJobId: requireString(isRecord(value) ? value.scanJobId : undefined, 'scanJobId') });
export const parseDuplicatesGetAnalysisJobRequest = (value: unknown): DuplicatesGetAnalysisJobRequest => ({ analysisJobId: requireString(isRecord(value) ? value.analysisJobId : undefined, 'analysisJobId') });
export const parseDuplicatesGetLatestAnalysisRequest = (value: unknown): DuplicatesGetLatestAnalysisRequest => ({ scanJobId: requireString(isRecord(value) ? value.scanJobId : undefined, 'scanJobId') });
export const parseDuplicatesCancelAnalysisRequest = (value: unknown): DuplicatesCancelAnalysisRequest => ({ analysisJobId: requireString(isRecord(value) ? value.analysisJobId : undefined, 'analysisJobId') });
export const parseDuplicatesGetGroupRequest = (value: unknown): DuplicatesGetGroupRequest => ({ groupId: requireString(isRecord(value) ? value.groupId : undefined, 'groupId') });

export const parseScanListFilesRequest = (value: unknown): ScanListFilesRequest => {
  if (!isRecord(value)) throw new TypeError('Expected a list files request payload.');
  const limit = optionalPositiveInteger(value.limit, 'limit');
  return limit === undefined ? { jobId: requireString(value.jobId, 'jobId') } : { jobId: requireString(value.jobId, 'jobId'), limit };
};
export const parseScanListEventsRequest = (value: unknown): ScanListEventsRequest => {
  if (!isRecord(value)) throw new TypeError('Expected a list events request payload.');
  const limit = optionalPositiveInteger(value.limit, 'limit');
  return limit === undefined ? { jobId: requireString(value.jobId, 'jobId') } : { jobId: requireString(value.jobId, 'jobId'), limit };
};
export const parseDuplicatesListGroupsRequest = (value: unknown): DuplicatesListGroupsRequest => {
  if (!isRecord(value)) throw new TypeError('Expected a duplicate list groups request payload.');
  const limit = optionalPositiveInteger(value.limit, 'limit');
  const offset = optionalPositiveInteger(value.offset, 'offset');
  return { scanJobId: requireString(value.scanJobId, 'scanJobId'), ...(limit === undefined ? {} : { limit }), ...(offset === undefined ? {} : { offset }) };
};
export const parseDuplicatesListGroupFilesRequest = (value: unknown): DuplicatesListGroupFilesRequest => {
  if (!isRecord(value)) throw new TypeError('Expected a duplicate list group files request payload.');
  const limit = optionalPositiveInteger(value.limit, 'limit');
  const offset = optionalPositiveInteger(value.offset, 'offset');
  return { groupId: requireString(value.groupId, 'groupId'), ...(limit === undefined ? {} : { limit }), ...(offset === undefined ? {} : { offset }) };
};

export const toScanJobDto = (job: ScanJob): ScanJobDto => ({
  id: job.id, rootPath: job.rootPath, status: job.status, processedPaths: job.processedPaths,
  discoveredFiles: job.discoveredFiles, scannedBytes: job.scannedBytes, percentComplete: job.percentComplete,
  currentPath: job.currentPath, errorMessage: job.errorMessage, startedAt: job.startedAt,
  completedAt: job.completedAt, cancelledAt: job.cancelledAt, updatedAt: job.updatedAt,
});
export const toScanFileDto = (file: FileRecord): ScanFileDto => ({
  id: file.id, absolutePath: file.absolutePath, fileName: file.fileName, extension: file.extension,
  sizeBytes: file.sizeBytes, createdAt: file.createdAt, modifiedAt: file.modifiedAt, category: file.category,
  hashStatus: file.hashStatus, contentHash: file.contentHash,
});
export const toScanEventDto = (event: ScanEventRecord): ScanEventDto => ({ ...event });
export const toDuplicateAnalysisJobDto = (job: DuplicateAnalysisJob): DuplicateAnalysisJobDto => ({
  id: job.id, scanJobId: job.scanJobId, status: job.status, phase: job.phase, totalCandidates: job.totalCandidates,
  hashedFiles: job.hashedFiles, duplicateGroups: job.duplicateGroups, duplicateFiles: job.duplicateFiles,
  duplicateBytes: job.duplicateBytes, reclaimableBytes: job.reclaimableBytes, currentFileId: job.currentFileId,
  currentPath: job.currentPath, progressPercent: job.progressPercent, hashAlgorithm: job.hashAlgorithm,
  errorMessage: job.errorMessage, startedAt: job.startedAt, completedAt: job.completedAt,
  cancelledAt: job.cancelledAt, updatedAt: job.updatedAt,
});
export const toDuplicateGroupDto = (group: DuplicateGroup): DuplicateGroupDto => ({ ...group });
export const toDuplicateGroupFileDto = (file: DuplicateGroupFile): DuplicateGroupFileDto => ({ ...file });
export const toDuplicateSummaryDto = (summary: DuplicateSummary): DuplicateSummaryDto => ({ ...summary });

export const parseScanProgressEvent = (value: unknown): ScanProgressEvent => parseScanJobDto(value);
export const parseScanCompleteEvent = (value: unknown): ScanCompleteEvent => {
  if (!isRecord(value)) throw new TypeError('Expected a scan completion payload.');
  return { jobId: requireString(value.jobId, 'jobId'), status: requireString(value.status, 'status') as ScanJobStatus, completedAt: optionalString(value.completedAt), cancelledAt: optionalString(value.cancelledAt), errorMessage: optionalString(value.errorMessage) };
};
export const parseDuplicateAnalysisProgressEvent = (value: unknown): DuplicateAnalysisProgressEvent => parseDuplicateAnalysisJobDto(value);
export const parseDuplicateAnalysisCompleteEvent = (value: unknown): DuplicateAnalysisCompleteEvent => {
  if (!isRecord(value)) throw new TypeError('Expected a duplicate analysis completion payload.');
  return {
    analysisJobId: requireString(value.analysisJobId, 'analysisJobId'),
    scanJobId: requireString(value.scanJobId, 'scanJobId'),
    status: requireString(value.status, 'status') as DuplicateAnalysisStatus,
    completedAt: optionalString(value.completedAt), cancelledAt: optionalString(value.cancelledAt), errorMessage: optionalString(value.errorMessage),
  };
};

export const parseScanJobResponse = (value: unknown): ScanJobDto | null => (value === null ? null : parseScanJobDto(value));
export const parseDuplicateAnalysisJobResponse = (value: unknown): DuplicateAnalysisJobDto | null => (value === null ? null : parseDuplicateAnalysisJobDto(value));
export const parseScanJobListResponse = (value: unknown): readonly ScanJobDto[] => {
  if (!Array.isArray(value)) throw new TypeError('Expected an array of scan jobs.');
  return value.map((entry) => parseScanJobDto(entry));
};
export const parseScanFileListResponse = (value: unknown): readonly ScanFileDto[] => {
  if (!Array.isArray(value)) throw new TypeError('Expected an array of scan files.');
  return value.map((entry) => {
    if (!isRecord(entry)) throw new TypeError('Expected a scan file payload.');
    return {
      id: requireString(entry.id, 'file id'), absolutePath: requireString(entry.absolutePath, 'absolutePath'),
      fileName: requireString(entry.fileName, 'fileName'), extension: requireString(entry.extension, 'extension'),
      sizeBytes: requireNumber(entry.sizeBytes, 'sizeBytes'), createdAt: optionalString(entry.createdAt),
      modifiedAt: optionalString(entry.modifiedAt), category: requireString(entry.category, 'category') as FileCategory,
      hashStatus: requireString(entry.hashStatus, 'hashStatus') as FileHashStatus, contentHash: optionalString(entry.contentHash),
    };
  });
};
export const parseScanEventListResponse = (value: unknown): readonly ScanEventDto[] => {
  if (!Array.isArray(value)) throw new TypeError('Expected an array of scan events.');
  return value.map((entry) => {
    if (!isRecord(entry)) throw new TypeError('Expected a scan event payload.');
    return {
      id: requireString(entry.id, 'event id'), jobId: requireString(entry.jobId, 'jobId'),
      level: requireString(entry.level, 'level') as ScanEventDto['level'], eventType: requireString(entry.eventType, 'eventType'),
      message: requireString(entry.message, 'message'), path: optionalString(entry.path), createdAt: requireString(entry.createdAt, 'createdAt'),
    };
  });
};
export const parseDuplicateGroupListResponse = (value: unknown): readonly DuplicateGroupDto[] => {
  if (!Array.isArray(value)) throw new TypeError('Expected an array of duplicate groups.');
  return value.map((entry) => {
    if (!isRecord(entry)) throw new TypeError('Expected a duplicate group payload.');
    return {
      id: requireString(entry.id, 'groupId'), analysisJobId: requireString(entry.analysisJobId, 'analysisJobId'),
      scanJobId: requireString(entry.scanJobId, 'scanJobId'), contentHash: requireString(entry.contentHash, 'contentHash'),
      hashAlgorithm: requireString(entry.hashAlgorithm, 'hashAlgorithm'), fileCount: requireNumber(entry.fileCount, 'fileCount'),
      totalBytes: requireNumber(entry.totalBytes, 'totalBytes'), reclaimableBytes: requireNumber(entry.reclaimableBytes, 'reclaimableBytes'),
      representativeFileId: requireString(entry.representativeFileId, 'representativeFileId'),
      keepRecommendationFileId: optionalString(entry.keepRecommendationFileId), createdAt: requireString(entry.createdAt, 'createdAt'),
    };
  });
};
export const parseDuplicateGroupResponse = (value: unknown): DuplicateGroupDto | null => {
  const list = parseDuplicateGroupListResponse(value === null ? [] : [value]);
  return list[0] ?? null;
};
export const parseDuplicateGroupFileListResponse = (value: unknown): readonly DuplicateGroupFileDto[] => {
  if (!Array.isArray(value)) throw new TypeError('Expected an array of duplicate group files.');
  return value.map((entry) => {
    if (!isRecord(entry)) throw new TypeError('Expected a duplicate group file payload.');
    return {
      memberId: requireString(entry.memberId, 'memberId'), groupId: requireString(entry.groupId, 'groupId'),
      fileId: requireString(entry.fileId, 'fileId'), absolutePath: requireString(entry.absolutePath, 'absolutePath'),
      fileName: requireString(entry.fileName, 'fileName'), sizeBytes: requireNumber(entry.sizeBytes, 'sizeBytes'),
      modifiedAt: optionalString(entry.modifiedAt), createdAt: optionalString(entry.createdAt),
      isKeepRecommendation: Boolean(entry.isKeepRecommendation), position: requireNumber(entry.position, 'position'),
    };
  });
};
export const parseDuplicateSummaryResponse = (value: unknown): DuplicateSummaryDto => {
  if (!isRecord(value)) throw new TypeError('Expected duplicate summary payload.');
  return {
    totalGroups: requireNumber(value.totalGroups, 'totalGroups'), totalFiles: requireNumber(value.totalFiles, 'totalFiles'),
    duplicateBytes: requireNumber(value.duplicateBytes, 'duplicateBytes'), reclaimableBytes: requireNumber(value.reclaimableBytes, 'reclaimableBytes'),
  };
};
