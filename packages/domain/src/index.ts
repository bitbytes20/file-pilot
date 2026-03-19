export const scanJobStatuses = ['pending', 'running', 'completed', 'cancelled', 'failed'] as const;

export type ScanJobStatus = (typeof scanJobStatuses)[number];

export const fileCategories = [
  'document',
  'image',
  'audio',
  'video',
  'archive',
  'code',
  'data',
  'other',
] as const;

export type FileCategory = (typeof fileCategories)[number];

export const fileHashStatuses = ['pending', 'hashing', 'hashed', 'failed', 'skipped'] as const;
export type FileHashStatus = (typeof fileHashStatuses)[number];

export const duplicateAnalysisStatuses = [
  'pending',
  'running',
  'completed',
  'cancelled',
  'failed',
] as const;
export type DuplicateAnalysisStatus = (typeof duplicateAnalysisStatuses)[number];

export interface ScanJob {
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
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FileRecord {
  readonly id: string;
  readonly jobId: string;
  readonly absolutePath: string;
  readonly fileName: string;
  readonly extension: string;
  readonly sizeBytes: number;
  readonly createdAt: string | null;
  readonly modifiedAt: string | null;
  readonly category: FileCategory;
  readonly hashStatus: FileHashStatus;
  readonly contentHash: string | null;
  readonly hashAlgorithm: string | null;
  readonly hashedAt: string | null;
  readonly hashError: string | null;
  readonly createdRecordAt: string;
}

export interface ScanEventRecord {
  readonly id: string;
  readonly jobId: string;
  readonly level: 'info' | 'warning' | 'error';
  readonly eventType: string;
  readonly message: string;
  readonly path: string | null;
  readonly createdAt: string;
}

export interface DuplicateAnalysisJob {
  readonly id: string;
  readonly scanJobId: string;
  readonly status: DuplicateAnalysisStatus;
  readonly phase: 'candidate-selection' | 'hashing' | 'grouping' | 'completed' | 'cancelled' | 'failed';
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
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DuplicateGroup {
  readonly id: string;
  readonly analysisJobId: string;
  readonly scanJobId: string;
  readonly contentHash: string;
  readonly hashAlgorithm: string;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly reclaimableBytes: number;
  readonly representativeFileId: string;
  readonly keepRecommendationFileId: string | null;
  readonly createdAt: string;
}

export interface DuplicateGroupFile {
  readonly memberId: string;
  readonly groupId: string;
  readonly fileId: string;
  readonly absolutePath: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly modifiedAt: string | null;
  readonly createdAt: string | null;
  readonly isKeepRecommendation: boolean;
  readonly position: number;
}

export interface DuplicateSummary {
  readonly totalGroups: number;
  readonly totalFiles: number;
  readonly duplicateBytes: number;
  readonly reclaimableBytes: number;
}

export interface DuplicateCandidateFile {
  readonly fileId: string;
  readonly absolutePath: string;
  readonly sizeBytes: number;
  readonly hashStatus: FileHashStatus;
  readonly contentHash: string | null;
  readonly hashAlgorithm: string | null;
}

const extensionCategoryMap: Record<string, FileCategory> = {
  txt: 'document',
  md: 'document',
  pdf: 'document',
  doc: 'document',
  docx: 'document',
  xls: 'data',
  xlsx: 'data',
  csv: 'data',
  json: 'data',
  xml: 'data',
  yaml: 'data',
  yml: 'data',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  mp3: 'audio',
  wav: 'audio',
  flac: 'audio',
  mp4: 'video',
  mov: 'video',
  mkv: 'video',
  avi: 'video',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  ts: 'code',
  tsx: 'code',
  js: 'code',
  jsx: 'code',
  py: 'code',
  rs: 'code',
  java: 'code',
  go: 'code',
  c: 'code',
  cpp: 'code',
  h: 'code',
  css: 'code',
  html: 'code',
};

export const guessFileCategory = (extension: string): FileCategory => {
  const normalized = extension.replace(/^\./u, '').trim().toLowerCase();
  if (normalized.length === 0) {
    return 'other';
  }

  return extensionCategoryMap[normalized] ?? 'other';
};

export const selectDuplicateHashCandidates = (
  files: readonly DuplicateCandidateFile[]
): readonly DuplicateCandidateFile[] => {
  const groupedBySize = new Map<number, DuplicateCandidateFile[]>();
  for (const file of files) {
    const group = groupedBySize.get(file.sizeBytes) ?? [];
    group.push(file);
    groupedBySize.set(file.sizeBytes, group);
  }

  return [...groupedBySize.values()]
    .filter((group) => group.length > 1)
    .flatMap((group) =>
      group.filter(
        (file) =>
          !(
            file.hashStatus === 'hashed' &&
            typeof file.contentHash === 'string' &&
            file.contentHash.length > 0 &&
            file.hashAlgorithm === 'sha256'
          )
      )
    );
};

export const selectKeepRecommendation = (
  files: readonly Pick<DuplicateGroupFile, 'fileId' | 'absolutePath' | 'modifiedAt' | 'createdAt'>[]
): string | null => {
  if (files.length === 0) {
    return null;
  }

  const sorted = [...files].sort((left, right) => {
    const modifiedComparison = (right.modifiedAt ?? '').localeCompare(left.modifiedAt ?? '');
    if (modifiedComparison !== 0) {
      return modifiedComparison;
    }

    const createdComparison = (right.createdAt ?? '').localeCompare(left.createdAt ?? '');
    if (createdComparison !== 0) {
      return createdComparison;
    }

    return left.absolutePath.localeCompare(right.absolutePath);
  });

  return sorted[0]?.fileId ?? null;
};

export const calculateReclaimableBytes = (fileSizeBytes: number, fileCount: number): number =>
  Math.max(0, fileSizeBytes * Math.max(0, fileCount - 1));

export const buildDuplicateSummary = (
  groups: readonly Pick<DuplicateGroup, 'fileCount' | 'totalBytes' | 'reclaimableBytes'>[]
): DuplicateSummary => ({
  totalGroups: groups.length,
  totalFiles: groups.reduce((sum, group) => sum + group.fileCount, 0),
  duplicateBytes: groups.reduce((sum, group) => sum + group.totalBytes, 0),
  reclaimableBytes: groups.reduce((sum, group) => sum + group.reclaimableBytes, 0),
});
