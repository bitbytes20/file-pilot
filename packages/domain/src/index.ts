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
