import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import {
  buildDuplicateSummary,
  calculateReclaimableBytes,
  guessFileCategory,
  selectDuplicateHashCandidates,
  selectKeepRecommendation,
  type DuplicateAnalysisJob,
  type DuplicateAnalysisStatus,
  type DuplicateCandidateFile,
  type DuplicateGroup,
  type DuplicateGroupFile,
  type DuplicateSummary,
  type FileHashStatus,
  type FileRecord,
  type ScanEventRecord,
  type ScanJob,
} from '@filepilot/domain';

export interface StructuredLogEntry {
  readonly level: 'debug' | 'info' | 'warning' | 'error';
  readonly domain: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

export interface Logger {
  debug(entry: Omit<StructuredLogEntry, 'level'>): void;
  info(entry: Omit<StructuredLogEntry, 'level'>): void;
  warn(entry: Omit<StructuredLogEntry, 'level'>): void;
  error(entry: Omit<StructuredLogEntry, 'level'>): void;
}

const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export interface DatabaseContext {
  readonly database: DatabaseSync;
  close(): void;
}

type ScanJobRow = Omit<ScanJob, never>;
type FileRow = Omit<FileRecord, never>;
type ScanEventRow = Omit<ScanEventRecord, never>;
type DuplicateAnalysisJobRow = Omit<DuplicateAnalysisJob, never>;
type DuplicateGroupRow = Omit<DuplicateGroup, never>;
type DuplicateGroupFileRow = Omit<DuplicateGroupFile, never>;

const HASH_ALGORITHM = 'sha256';

const toIsoString = (value: Date | number | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return new Date(value).toISOString();
};

const toScanJob = (row: ScanJobRow): ScanJob => row;
const toFileRecord = (row: FileRow): FileRecord => row;
const toScanEventRecord = (row: ScanEventRow): ScanEventRecord => row;
const toDuplicateAnalysisJob = (row: DuplicateAnalysisJobRow): DuplicateAnalysisJob => row;
const toDuplicateGroup = (row: DuplicateGroupRow): DuplicateGroup => row;
const toDuplicateGroupFile = (row: DuplicateGroupFileRow): DuplicateGroupFile => ({
  ...row,
  isKeepRecommendation: Boolean(row.isKeepRecommendation),
});

const loadDatabaseSync = async (): Promise<typeof import('node:sqlite').DatabaseSync> => {
  try {
    const sqlite = await import('node:sqlite');
    return sqlite.DatabaseSync;
  } catch (error) {
    throw new Error(
      'SQLite runtime is unavailable in this build. FilePilot currently requires node:sqlite support in the host runtime.',
      { cause: error instanceof Error ? error : undefined }
    );
  }
};

const ensureColumn = (database: DatabaseSync, table: string, column: string, definition: string) => {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!rows.some((row) => row.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
};

const runMigrations = (database: DatabaseSync, logger: Logger): void => {
  logger.info({ domain: 'database', message: 'Applying SQLite migrations.' });
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS scan_jobs (
      id TEXT PRIMARY KEY,
      root_path TEXT NOT NULL,
      status TEXT NOT NULL,
      processed_paths INTEGER NOT NULL DEFAULT 0,
      discovered_files INTEGER NOT NULL DEFAULT 0,
      scanned_bytes INTEGER NOT NULL DEFAULT 0,
      percent_complete INTEGER NOT NULL DEFAULT 0,
      current_path TEXT,
      error_message TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      cancelled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      absolute_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      extension TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT,
      modified_at TEXT,
      category TEXT NOT NULL,
      created_record_at TEXT NOT NULL,
      FOREIGN KEY(job_id) REFERENCES scan_jobs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_files_job_id ON files(job_id);
    CREATE TABLE IF NOT EXISTS scan_events (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      level TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      path TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(job_id) REFERENCES scan_jobs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_scan_events_job_id ON scan_events(job_id);
    CREATE TABLE IF NOT EXISTS duplicate_analysis_jobs (
      id TEXT PRIMARY KEY,
      scan_job_id TEXT NOT NULL,
      status TEXT NOT NULL,
      phase TEXT NOT NULL,
      total_candidates INTEGER NOT NULL DEFAULT 0,
      hashed_files INTEGER NOT NULL DEFAULT 0,
      duplicate_groups INTEGER NOT NULL DEFAULT 0,
      duplicate_files INTEGER NOT NULL DEFAULT 0,
      duplicate_bytes INTEGER NOT NULL DEFAULT 0,
      reclaimable_bytes INTEGER NOT NULL DEFAULT 0,
      current_file_id TEXT,
      current_path TEXT,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      hash_algorithm TEXT NOT NULL,
      error_message TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      cancelled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(scan_job_id) REFERENCES scan_jobs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_duplicate_analysis_jobs_scan_job_id ON duplicate_analysis_jobs(scan_job_id);
    CREATE TABLE IF NOT EXISTS duplicate_groups (
      id TEXT PRIMARY KEY,
      analysis_job_id TEXT NOT NULL,
      scan_job_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      hash_algorithm TEXT NOT NULL,
      file_count INTEGER NOT NULL,
      total_bytes INTEGER NOT NULL,
      reclaimable_bytes INTEGER NOT NULL,
      representative_file_id TEXT NOT NULL,
      keep_recommendation_file_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(analysis_job_id) REFERENCES duplicate_analysis_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY(scan_job_id) REFERENCES scan_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY(representative_file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY(keep_recommendation_file_id) REFERENCES files(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_duplicate_groups_scan_job_id ON duplicate_groups(scan_job_id);
    CREATE INDEX IF NOT EXISTS idx_duplicate_groups_analysis_job_id ON duplicate_groups(analysis_job_id);
    CREATE TABLE IF NOT EXISTS duplicate_group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      is_keep_recommendation INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(group_id) REFERENCES duplicate_groups(id) ON DELETE CASCADE,
      FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_duplicate_group_members_group_id ON duplicate_group_members(group_id);
    CREATE INDEX IF NOT EXISTS idx_duplicate_group_members_file_id ON duplicate_group_members(file_id);
  `);

  ensureColumn(database, 'files', 'hash_status', "TEXT NOT NULL DEFAULT 'pending'");
  ensureColumn(database, 'files', 'content_hash', 'TEXT');
  ensureColumn(database, 'files', 'hash_algorithm', 'TEXT');
  ensureColumn(database, 'files', 'hashed_at', 'TEXT');
  ensureColumn(database, 'files', 'hash_error', 'TEXT');
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_job_size ON files(job_id, size_bytes);
    CREATE INDEX IF NOT EXISTS idx_files_job_hash ON files(job_id, content_hash);
  `);
};

export const bootstrapDatabase = async (
  databaseFilePath: string,
  logger: Logger = noopLogger
): Promise<DatabaseContext> => {
  await fsp.mkdir(path.dirname(databaseFilePath), { recursive: true });
  logger.info({
    domain: 'database',
    message: 'Opening SQLite database.',
    context: { databaseFilePath },
  });
  const DatabaseSync = await loadDatabaseSync();
  const database = new DatabaseSync(databaseFilePath);
  runMigrations(database, logger);

  return {
    database,
    close: () => database.close(),
  };
};

export class ScanJobRepository {
  private readonly database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.database = database;
  }

  public create(rootPath: string): ScanJob {
    const now = new Date().toISOString();
    const job: ScanJob = {
      id: randomUUID(),
      rootPath,
      status: 'pending',
      processedPaths: 0,
      discoveredFiles: 0,
      scannedBytes: 0,
      percentComplete: 0,
      currentPath: null,
      errorMessage: null,
      startedAt: now,
      completedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.database
      .prepare(
        `INSERT INTO scan_jobs (
        id, root_path, status, processed_paths, discovered_files, scanned_bytes, percent_complete,
        current_path, error_message, started_at, completed_at, cancelled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        job.id,
        job.rootPath,
        job.status,
        job.processedPaths,
        job.discoveredFiles,
        job.scannedBytes,
        job.percentComplete,
        job.currentPath,
        job.errorMessage,
        job.startedAt,
        job.completedAt,
        job.cancelledAt,
        job.createdAt,
        job.updatedAt
      );

    return job;
  }

  public update(
    jobId: string,
    patch: Partial<Omit<ScanJob, 'id' | 'rootPath' | 'startedAt' | 'createdAt'>>
  ): ScanJob {
    const current = this.getById(jobId);
    if (!current) {
      throw new Error(`Scan job ${jobId} was not found.`);
    }

    const next: ScanJob = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    this.database
      .prepare(
        `UPDATE scan_jobs SET
        status = ?, processed_paths = ?, discovered_files = ?, scanned_bytes = ?, percent_complete = ?,
        current_path = ?, error_message = ?, completed_at = ?, cancelled_at = ?, updated_at = ?
        WHERE id = ?`
      )
      .run(
        next.status,
        next.processedPaths,
        next.discoveredFiles,
        next.scannedBytes,
        next.percentComplete,
        next.currentPath,
        next.errorMessage,
        next.completedAt,
        next.cancelledAt,
        next.updatedAt,
        next.id
      );

    return next;
  }

  public failStaleJobs(message: string): number {
    const now = new Date().toISOString();
    const result = this.database
      .prepare(
        `UPDATE scan_jobs
        SET status = 'failed', error_message = ?, completed_at = ?, updated_at = ?
        WHERE status IN ('pending', 'running')`
      )
      .run(message, now, now);
    return result.changes;
  }

  public getById(jobId: string): ScanJob | null {
    const row = this.database
      .prepare(
        `SELECT
        id,
        root_path as rootPath,
        status,
        processed_paths as processedPaths,
        discovered_files as discoveredFiles,
        scanned_bytes as scannedBytes,
        percent_complete as percentComplete,
        current_path as currentPath,
        error_message as errorMessage,
        started_at as startedAt,
        completed_at as completedAt,
        cancelled_at as cancelledAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM scan_jobs WHERE id = ?`
      )
      .get(jobId) as ScanJobRow | undefined;

    return row ? toScanJob(row) : null;
  }

  public listRecent(limit = 10): readonly ScanJob[] {
    const rows = this.database
      .prepare(
        `SELECT
        id,
        root_path as rootPath,
        status,
        processed_paths as processedPaths,
        discovered_files as discoveredFiles,
        scanned_bytes as scannedBytes,
        percent_complete as percentComplete,
        current_path as currentPath,
        error_message as errorMessage,
        started_at as startedAt,
        completed_at as completedAt,
        cancelled_at as cancelledAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM scan_jobs ORDER BY started_at DESC LIMIT ?`
      )
      .all(limit) as ScanJobRow[];
    return rows.map(toScanJob);
  }
}

export class FileRepository {
  private readonly database: DatabaseSync;
  private readonly insertStatement: ReturnType<DatabaseSync['prepare']>;

  public constructor(database: DatabaseSync) {
    this.database = database;
    this.insertStatement = database.prepare(`INSERT INTO files (
      id, job_id, absolute_path, file_name, extension, size_bytes, created_at, modified_at, category,
      hash_status, content_hash, hash_algorithm, hashed_at, hash_error, created_record_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  }

  public insert(
    file: Omit<
      FileRecord,
      'id' | 'createdRecordAt' | 'hashStatus' | 'contentHash' | 'hashAlgorithm' | 'hashedAt' | 'hashError'
    >
  ): FileRecord {
    const record: FileRecord = {
      id: randomUUID(),
      ...file,
      hashStatus: 'pending',
      contentHash: null,
      hashAlgorithm: null,
      hashedAt: null,
      hashError: null,
      createdRecordAt: new Date().toISOString(),
    };

    this.insertStatement.run(
      record.id,
      record.jobId,
      record.absolutePath,
      record.fileName,
      record.extension,
      record.sizeBytes,
      record.createdAt,
      record.modifiedAt,
      record.category,
      record.hashStatus,
      record.contentHash,
      record.hashAlgorithm,
      record.hashedAt,
      record.hashError,
      record.createdRecordAt
    );

    return record;
  }

  public listByJobId(jobId: string, limit = 500): readonly FileRecord[] {
    const rows = this.database
      .prepare(
        `SELECT
        id,
        job_id as jobId,
        absolute_path as absolutePath,
        file_name as fileName,
        extension,
        size_bytes as sizeBytes,
        created_at as createdAt,
        modified_at as modifiedAt,
        category,
        hash_status as hashStatus,
        content_hash as contentHash,
        hash_algorithm as hashAlgorithm,
        hashed_at as hashedAt,
        hash_error as hashError,
        created_record_at as createdRecordAt
      FROM files WHERE job_id = ? ORDER BY absolute_path ASC LIMIT ?`
      )
      .all(jobId, limit) as FileRow[];
    return rows.map(toFileRecord);
  }

  public getById(fileId: string): FileRecord | null {
    const row = this.database
      .prepare(
        `SELECT id, job_id as jobId, absolute_path as absolutePath, file_name as fileName, extension,
        size_bytes as sizeBytes, created_at as createdAt, modified_at as modifiedAt, category,
        hash_status as hashStatus, content_hash as contentHash, hash_algorithm as hashAlgorithm,
        hashed_at as hashedAt, hash_error as hashError, created_record_at as createdRecordAt
        FROM files WHERE id = ?`
      )
      .get(fileId) as FileRow | undefined;
    return row ? toFileRecord(row) : null;
  }

  public updateHashState(
    fileId: string,
    patch: {
      readonly hashStatus: FileHashStatus;
      readonly contentHash?: string | null;
      readonly hashAlgorithm?: string | null;
      readonly hashedAt?: string | null;
      readonly hashError?: string | null;
    }
  ): FileRecord {
    const current = this.getById(fileId);
    if (!current) {
      throw new Error(`File ${fileId} was not found.`);
    }

    const next: FileRecord = {
      ...current,
      hashStatus: patch.hashStatus,
      contentHash: patch.contentHash ?? current.contentHash,
      hashAlgorithm: patch.hashAlgorithm ?? current.hashAlgorithm,
      hashedAt: patch.hashedAt ?? current.hashedAt,
      hashError: patch.hashError ?? current.hashError,
    };

    this.database
      .prepare(
        `UPDATE files SET hash_status = ?, content_hash = ?, hash_algorithm = ?, hashed_at = ?, hash_error = ?
        WHERE id = ?`
      )
      .run(
        next.hashStatus,
        next.contentHash,
        next.hashAlgorithm,
        next.hashedAt,
        next.hashError,
        next.id
      );

    return next;
  }

  public markHashStatesForJob(jobId: string, sizeBytes: number, status: FileHashStatus): number {
    return this.database
      .prepare(`UPDATE files SET hash_status = ?, hash_error = NULL WHERE job_id = ? AND size_bytes = ?`)
      .run(status, jobId, sizeBytes).changes;
  }

  public listHashCandidatesByJobId(jobId: string): readonly DuplicateCandidateFile[] {
    return this.database
      .prepare(
        `SELECT id as fileId, absolute_path as absolutePath, size_bytes as sizeBytes,
        hash_status as hashStatus, content_hash as contentHash, hash_algorithm as hashAlgorithm
        FROM files WHERE job_id = ? ORDER BY size_bytes ASC, absolute_path ASC`
      )
      .all(jobId) as DuplicateCandidateFile[];
  }
}

export class ScanEventRepository {
  private readonly database: DatabaseSync;
  private readonly insertStatement: ReturnType<DatabaseSync['prepare']>;

  public constructor(database: DatabaseSync) {
    this.database = database;
    this.insertStatement = database.prepare(
      'INSERT INTO scan_events (id, job_id, level, event_type, message, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
  }

  public record(event: Omit<ScanEventRecord, 'id' | 'createdAt'>): ScanEventRecord {
    const row: ScanEventRecord = {
      id: randomUUID(),
      ...event,
      createdAt: new Date().toISOString(),
    };

    this.insertStatement.run(
      row.id,
      row.jobId,
      row.level,
      row.eventType,
      row.message,
      row.path,
      row.createdAt
    );
    return row;
  }

  public listByJobId(jobId: string, limit = 100): readonly ScanEventRecord[] {
    const rows = this.database
      .prepare(
        `SELECT id, job_id as jobId, level, event_type as eventType, message, path, created_at as createdAt
        FROM scan_events WHERE job_id = ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(jobId, limit) as ScanEventRow[];
    return rows.map(toScanEventRecord);
  }
}

export class DuplicateAnalysisJobRepository {
  private readonly database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.database = database;
  }

  public create(scanJobId: string, hashAlgorithm = HASH_ALGORITHM): DuplicateAnalysisJob {
    const now = new Date().toISOString();
    const job: DuplicateAnalysisJob = {
      id: randomUUID(),
      scanJobId,
      status: 'pending',
      phase: 'candidate-selection',
      totalCandidates: 0,
      hashedFiles: 0,
      duplicateGroups: 0,
      duplicateFiles: 0,
      duplicateBytes: 0,
      reclaimableBytes: 0,
      currentFileId: null,
      currentPath: null,
      progressPercent: 0,
      hashAlgorithm,
      errorMessage: null,
      startedAt: now,
      completedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.database.prepare(`INSERT INTO duplicate_analysis_jobs (
      id, scan_job_id, status, phase, total_candidates, hashed_files, duplicate_groups, duplicate_files,
      duplicate_bytes, reclaimable_bytes, current_file_id, current_path, progress_percent, hash_algorithm,
      error_message, started_at, completed_at, cancelled_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        job.id, job.scanJobId, job.status, job.phase, job.totalCandidates, job.hashedFiles,
        job.duplicateGroups, job.duplicateFiles, job.duplicateBytes, job.reclaimableBytes,
        job.currentFileId, job.currentPath, job.progressPercent, job.hashAlgorithm, job.errorMessage,
        job.startedAt, job.completedAt, job.cancelledAt, job.createdAt, job.updatedAt
      );

    return job;
  }

  public update(
    jobId: string,
    patch: Partial<Omit<DuplicateAnalysisJob, 'id' | 'scanJobId' | 'hashAlgorithm' | 'startedAt' | 'createdAt'>>
  ): DuplicateAnalysisJob {
    const current = this.getById(jobId);
    if (!current) {
      throw new Error(`Duplicate analysis job ${jobId} was not found.`);
    }

    const next: DuplicateAnalysisJob = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.database.prepare(`UPDATE duplicate_analysis_jobs SET
      status = ?, phase = ?, total_candidates = ?, hashed_files = ?, duplicate_groups = ?, duplicate_files = ?,
      duplicate_bytes = ?, reclaimable_bytes = ?, current_file_id = ?, current_path = ?, progress_percent = ?,
      error_message = ?, completed_at = ?, cancelled_at = ?, updated_at = ? WHERE id = ?`)
      .run(
        next.status, next.phase, next.totalCandidates, next.hashedFiles, next.duplicateGroups,
        next.duplicateFiles, next.duplicateBytes, next.reclaimableBytes, next.currentFileId,
        next.currentPath, next.progressPercent, next.errorMessage, next.completedAt, next.cancelledAt,
        next.updatedAt, next.id
      );
    return next;
  }

  public getById(jobId: string): DuplicateAnalysisJob | null {
    const row = this.database.prepare(`SELECT id, scan_job_id as scanJobId, status, phase,
      total_candidates as totalCandidates, hashed_files as hashedFiles, duplicate_groups as duplicateGroups,
      duplicate_files as duplicateFiles, duplicate_bytes as duplicateBytes,
      reclaimable_bytes as reclaimableBytes, current_file_id as currentFileId, current_path as currentPath,
      progress_percent as progressPercent, hash_algorithm as hashAlgorithm, error_message as errorMessage,
      started_at as startedAt, completed_at as completedAt, cancelled_at as cancelledAt,
      created_at as createdAt, updated_at as updatedAt
      FROM duplicate_analysis_jobs WHERE id = ?`).get(jobId) as DuplicateAnalysisJobRow | undefined;
    return row ? toDuplicateAnalysisJob(row) : null;
  }

  public getLatestForScanJob(scanJobId: string): DuplicateAnalysisJob | null {
    const row = this.database.prepare(`SELECT id, scan_job_id as scanJobId, status, phase,
      total_candidates as totalCandidates, hashed_files as hashedFiles, duplicate_groups as duplicateGroups,
      duplicate_files as duplicateFiles, duplicate_bytes as duplicateBytes,
      reclaimable_bytes as reclaimableBytes, current_file_id as currentFileId, current_path as currentPath,
      progress_percent as progressPercent, hash_algorithm as hashAlgorithm, error_message as errorMessage,
      started_at as startedAt, completed_at as completedAt, cancelled_at as cancelledAt,
      created_at as createdAt, updated_at as updatedAt
      FROM duplicate_analysis_jobs WHERE scan_job_id = ? ORDER BY created_at DESC LIMIT 1`).get(scanJobId) as DuplicateAnalysisJobRow | undefined;
    return row ? toDuplicateAnalysisJob(row) : null;
  }

  public failStaleJobs(message: string): number {
    const now = new Date().toISOString();
    return this.database.prepare(`UPDATE duplicate_analysis_jobs
      SET status = 'failed', phase = 'failed', error_message = ?, completed_at = ?, updated_at = ?
      WHERE status IN ('pending', 'running')`).run(message, now, now).changes;
  }
}

export class DuplicateGroupRepository {
  private readonly database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.database = database;
  }

  public replaceForAnalysis(
    analysisJobId: string,
    scanJobId: string,
    groups: readonly Array<{
      readonly contentHash: string;
      readonly hashAlgorithm: string;
      readonly files: readonly FileRecord[];
    }>
  ): readonly DuplicateGroup[] {
    this.database.prepare('DELETE FROM duplicate_groups WHERE analysis_job_id = ?').run(analysisJobId);
    const createdAt = new Date().toISOString();
    const persisted: DuplicateGroup[] = [];

    for (const group of groups) {
      const keepRecommendationFileId = selectKeepRecommendation(group.files);
      const representativeFileId = group.files[0]?.id;
      if (!representativeFileId) {
        continue;
      }

      const groupId = randomUUID();
      const totalBytes = group.files.reduce((sum, file) => sum + file.sizeBytes, 0);
      const reclaimableBytes = calculateReclaimableBytes(group.files[0]?.sizeBytes ?? 0, group.files.length);
      const row: DuplicateGroup = {
        id: groupId,
        analysisJobId,
        scanJobId,
        contentHash: group.contentHash,
        hashAlgorithm: group.hashAlgorithm,
        fileCount: group.files.length,
        totalBytes,
        reclaimableBytes,
        representativeFileId,
        keepRecommendationFileId,
        createdAt,
      };

      this.database.prepare(`INSERT INTO duplicate_groups (
        id, analysis_job_id, scan_job_id, content_hash, hash_algorithm, file_count, total_bytes,
        reclaimable_bytes, representative_file_id, keep_recommendation_file_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        row.id, row.analysisJobId, row.scanJobId, row.contentHash, row.hashAlgorithm, row.fileCount,
        row.totalBytes, row.reclaimableBytes, row.representativeFileId, row.keepRecommendationFileId, row.createdAt
      );

      group.files
        .slice()
        .sort((left, right) => left.absolutePath.localeCompare(right.absolutePath))
        .forEach((file, index) => {
          this.database.prepare(`INSERT INTO duplicate_group_members (
            id, group_id, file_id, position, is_keep_recommendation, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`).run(
            randomUUID(),
            groupId,
            file.id,
            index,
            file.id === keepRecommendationFileId ? 1 : 0,
            createdAt
          );
        });

      persisted.push(row);
    }

    return persisted;
  }

  public listByScanJobId(scanJobId: string, limit = 100, offset = 0): readonly DuplicateGroup[] {
    const rows = this.database.prepare(`SELECT id, analysis_job_id as analysisJobId, scan_job_id as scanJobId,
      content_hash as contentHash, hash_algorithm as hashAlgorithm, file_count as fileCount,
      total_bytes as totalBytes, reclaimable_bytes as reclaimableBytes,
      representative_file_id as representativeFileId,
      keep_recommendation_file_id as keepRecommendationFileId, created_at as createdAt
      FROM duplicate_groups WHERE scan_job_id = ? ORDER BY reclaimable_bytes DESC, file_count DESC, created_at DESC
      LIMIT ? OFFSET ?`).all(scanJobId, limit, offset) as DuplicateGroupRow[];
    return rows.map(toDuplicateGroup);
  }

  public getById(groupId: string): DuplicateGroup | null {
    const row = this.database.prepare(`SELECT id, analysis_job_id as analysisJobId, scan_job_id as scanJobId,
      content_hash as contentHash, hash_algorithm as hashAlgorithm, file_count as fileCount,
      total_bytes as totalBytes, reclaimable_bytes as reclaimableBytes,
      representative_file_id as representativeFileId,
      keep_recommendation_file_id as keepRecommendationFileId, created_at as createdAt
      FROM duplicate_groups WHERE id = ?`).get(groupId) as DuplicateGroupRow | undefined;
    return row ? toDuplicateGroup(row) : null;
  }

  public listFiles(groupId: string, limit = 200, offset = 0): readonly DuplicateGroupFile[] {
    const rows = this.database.prepare(`SELECT member.id as memberId, member.group_id as groupId,
      file.id as fileId, file.absolute_path as absolutePath, file.file_name as fileName,
      file.size_bytes as sizeBytes, file.modified_at as modifiedAt, file.created_at as createdAt,
      member.is_keep_recommendation as isKeepRecommendation, member.position as position
      FROM duplicate_group_members member
      JOIN files file ON file.id = member.file_id
      WHERE member.group_id = ?
      ORDER BY member.position ASC, file.absolute_path ASC
      LIMIT ? OFFSET ?`).all(groupId, limit, offset) as DuplicateGroupFileRow[];
    return rows.map(toDuplicateGroupFile);
  }

  public summarizeByScanJobId(scanJobId: string): DuplicateSummary {
    const groups = this.listByScanJobId(scanJobId, 10_000, 0);
    return buildDuplicateSummary(groups);
  }
}

export interface ScanProgressSnapshot {
  readonly job: ScanJob;
}

export interface ScannerCallbacks {
  readonly onProgress?: (snapshot: ScanProgressSnapshot) => void;
  readonly onComplete?: (job: ScanJob) => void;
}

export interface ScannerController {
  readonly jobId: string;
  cancel(): void;
  readonly promise: Promise<ScanJob>;
}

export interface FileScannerOptions {
  readonly progressEveryPaths?: number;
  readonly progressEveryMs?: number;
  readonly yieldEveryPaths?: number;
  readonly logger?: Logger;
}

const isNodeError = (error: unknown): error is NodeJS.ErrnoException => error instanceof Error;
const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const classifyFsError = (
  error: unknown
): { eventType: string; level: 'warning' | 'error'; message: string } => {
  const code = isNodeError(error) ? error.code : undefined;
  switch (code) {
    case 'EACCES':
    case 'EPERM':
      return { eventType: 'permission_denied', level: 'warning', message: 'Permission denied while reading path.' };
    case 'ENOENT':
      return { eventType: 'path_missing', level: 'warning', message: 'Path disappeared during scan.' };
    case 'ENOTDIR':
      return { eventType: 'not_a_directory', level: 'warning', message: 'Expected a directory but found a non-directory path.' };
    case 'EIO':
      return { eventType: 'device_io_error', level: 'error', message: 'I/O error while reading path. The device may be unavailable.' };
    default:
      return { eventType: 'path_error', level: 'warning', message: toErrorMessage(error, 'Unable to access path.') };
  }
};

export class FileScanner {
  private readonly jobs: ScanJobRepository;
  private readonly files: FileRepository;
  private readonly events: ScanEventRepository;
  private readonly progressEveryPaths: number;
  private readonly progressEveryMs: number;
  private readonly yieldEveryPaths: number;
  private readonly logger: Logger;

  public constructor(
    jobs: ScanJobRepository,
    files: FileRepository,
    events: ScanEventRepository,
    options: FileScannerOptions = {}
  ) {
    this.jobs = jobs;
    this.files = files;
    this.events = events;
    this.progressEveryPaths = options.progressEveryPaths ?? 25;
    this.progressEveryMs = options.progressEveryMs ?? 250;
    this.yieldEveryPaths = options.yieldEveryPaths ?? 100;
    this.logger = options.logger ?? noopLogger;
  }

  public start(rootPath: string, callbacks: ScannerCallbacks = {}): ScannerController {
    const job = this.jobs.create(rootPath);
    let cancelled = false;

    const promise = Promise.resolve().then(() => this.run(job.id, rootPath, () => cancelled, callbacks));
    return {
      jobId: job.id,
      cancel: () => {
        cancelled = true;
        this.logger.info({ domain: 'scan', message: 'Cancellation requested.', context: { jobId: job.id, rootPath } });
      },
      promise,
    };
  }

  private async run(
    jobId: string,
    rootPath: string,
    isCancelled: () => boolean,
    callbacks: ScannerCallbacks
  ): Promise<ScanJob> {
    let activeJob = this.jobs.update(jobId, { status: 'running' });
    callbacks.onProgress?.({ job: activeJob });
    this.logger.info({ domain: 'scan', message: 'Scan started.', context: { jobId, rootPath } });
    this.events.record({ jobId, level: 'info', eventType: 'scan_started', message: 'Scan started.', path: rootPath });

    try {
      const rootStats = await fsp.lstat(rootPath);
      if (!rootStats.isDirectory()) {
        throw new Error('Selected root path is not a directory.');
      }
    } catch (error) {
      return this.failJob(jobId, rootPath, error, callbacks);
    }

    const queue = [rootPath];
    let processedPaths = 0;
    let persistedFiles = 0;
    let scannedBytes = 0;
    let maxQueueDepth = 1;
    let lastProgressAt = 0;

    while (queue.length > 0) {
      if (isCancelled()) {
        activeJob = this.jobs.update(jobId, {
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          currentPath: activeJob.currentPath,
          percentComplete: Math.min(activeJob.percentComplete, 99),
        });
        this.events.record({ jobId, level: 'info', eventType: 'scan_cancelled', message: 'Scan cancelled by user.', path: activeJob.currentPath });
        this.logger.info({ domain: 'scan', message: 'Scan cancelled.', context: { jobId, processedPaths, persistedFiles, scannedBytes } });
        callbacks.onProgress?.({ job: activeJob });
        callbacks.onComplete?.(activeJob);
        return activeJob;
      }

      const currentPath = queue.shift();
      if (!currentPath) break;
      processedPaths += 1;
      maxQueueDepth = Math.max(maxQueueDepth, queue.length + 1);

      let currentStats;
      try {
        currentStats = await fsp.lstat(currentPath);
      } catch (error) {
        await this.recordFsWarning(jobId, currentPath, error);
        activeJob = this.updateProgress(jobId, { processedPaths, persistedFiles, scannedBytes, currentPath, queueLength: queue.length });
        await this.emitProgressMaybe(activeJob, callbacks, processedPaths, () => { lastProgressAt = Date.now(); }, lastProgressAt);
        continue;
      }

      if (currentStats.isSymbolicLink()) {
        this.events.record({ jobId, level: 'warning', eventType: 'symlink_skipped', message: 'Symlink skipped for safety.', path: currentPath });
        this.logger.warn({ domain: 'scan', message: 'Skipped symlink.', context: { jobId, path: currentPath } });
      } else if (currentStats.isDirectory()) {
        try {
          const entries = await fsp.readdir(currentPath, { withFileTypes: true });
          for (const entry of entries) {
            queue.push(path.join(currentPath, entry.name));
          }
        } catch (error) {
          await this.recordFsWarning(jobId, currentPath, error);
        }
      } else if (currentStats.isFile()) {
        try {
          const extension = path.extname(currentPath).replace(/^\./u, '').toLowerCase();
          this.files.insert({
            jobId,
            absolutePath: currentPath,
            fileName: path.basename(currentPath),
            extension,
            sizeBytes: currentStats.size,
            createdAt: toIsoString(currentStats.birthtimeMs),
            modifiedAt: toIsoString(currentStats.mtimeMs),
            category: guessFileCategory(extension),
          });
          persistedFiles += 1;
          scannedBytes += currentStats.size;
        } catch (error) {
          await this.recordFsWarning(jobId, currentPath, error);
        }
      }

      activeJob = this.updateProgress(jobId, { processedPaths, persistedFiles, scannedBytes, currentPath, queueLength: queue.length });
      await this.emitProgressMaybe(activeJob, callbacks, processedPaths, () => { lastProgressAt = Date.now(); }, lastProgressAt);
      if (processedPaths % this.yieldEveryPaths === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    activeJob = this.jobs.update(jobId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      currentPath: rootPath,
      percentComplete: 100,
      processedPaths,
      discoveredFiles: persistedFiles,
      scannedBytes,
    });
    this.events.record({ jobId, level: 'info', eventType: 'scan_completed', message: 'Scan completed.', path: rootPath });
    this.events.record({ jobId, level: 'info', eventType: 'scan_metrics', message: `Processed ${processedPaths} paths and persisted ${persistedFiles} files.`, path: rootPath });
    this.logger.info({ domain: 'scan', message: 'Scan completed.', context: { jobId, rootPath, processedPaths, persistedFiles, scannedBytes, maxQueueDepth } });
    callbacks.onProgress?.({ job: activeJob });
    callbacks.onComplete?.(activeJob);
    return activeJob;
  }

  private updateProgress(jobId: string, metrics: { processedPaths: number; persistedFiles: number; scannedBytes: number; currentPath: string; queueLength: number; }): ScanJob {
    const denominator = metrics.processedPaths + metrics.queueLength;
    const percentComplete = denominator <= 0 ? 0 : Math.min(99, Math.max(1, Math.round((metrics.processedPaths / denominator) * 100)));
    return this.jobs.update(jobId, {
      processedPaths: metrics.processedPaths,
      discoveredFiles: metrics.persistedFiles,
      scannedBytes: metrics.scannedBytes,
      percentComplete,
      currentPath: metrics.currentPath,
    });
  }

  private async emitProgressMaybe(job: ScanJob, callbacks: ScannerCallbacks, processedPaths: number, onEmit: () => void, lastProgressAt: number): Promise<void> {
    const now = Date.now();
    if (processedPaths <= 1 || processedPaths % this.progressEveryPaths === 0 || now - lastProgressAt >= this.progressEveryMs) {
      callbacks.onProgress?.({ job });
      onEmit();
    }
  }

  private async recordFsWarning(jobId: string, targetPath: string, error: unknown): Promise<void> {
    const classification = classifyFsError(error);
    this.events.record({ jobId, level: classification.level, eventType: classification.eventType, message: `${classification.message} ${toErrorMessage(error, '')}`.trim(), path: targetPath });
    this.logger[classification.level === 'error' ? 'error' : 'warn']({ domain: 'filesystem', message: classification.message, context: { jobId, path: targetPath, error: toErrorMessage(error, classification.message) } });
  }

  private async failJob(jobId: string, rootPath: string, error: unknown, callbacks: ScannerCallbacks): Promise<ScanJob> {
    const message = toErrorMessage(error, 'Scan failed.');
    const failedJob = this.jobs.update(jobId, { status: 'failed', errorMessage: message, completedAt: new Date().toISOString(), currentPath: rootPath });
    this.events.record({ jobId, level: 'error', eventType: 'scan_failed', message, path: rootPath });
    this.logger.error({ domain: 'scan', message: 'Scan failed.', context: { jobId, rootPath, error: message } });
    callbacks.onProgress?.({ job: failedJob });
    callbacks.onComplete?.(failedJob);
    return failedJob;
  }
}

export interface FileHasher {
  hashFile(absolutePath: string): Promise<string>;
}

export class StreamingFileHasher implements FileHasher {
  public async hashFile(absolutePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash(HASH_ALGORITHM);
      const stream = fs.createReadStream(absolutePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', (error) => reject(error));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }
}

export interface DuplicateAnalysisProgressSnapshot {
  readonly job: DuplicateAnalysisJob;
}

export interface DuplicateAnalysisCallbacks {
  readonly onProgress?: (snapshot: DuplicateAnalysisProgressSnapshot) => void;
  readonly onComplete?: (job: DuplicateAnalysisJob) => void;
}

export interface DuplicateAnalysisController {
  readonly analysisJobId: string;
  cancel(): void;
  readonly promise: Promise<DuplicateAnalysisJob>;
}

export interface DuplicateAnalyzerOptions {
  readonly logger?: Logger;
  readonly yieldEveryFiles?: number;
  readonly progressEveryFiles?: number;
}

export class DuplicateAnalyzer {
  private readonly files: FileRepository;
  private readonly scanJobs: ScanJobRepository;
  private readonly analysisJobs: DuplicateAnalysisJobRepository;
  private readonly groups: DuplicateGroupRepository;
  private readonly hasher: FileHasher;
  private readonly logger: Logger;
  private readonly yieldEveryFiles: number;
  private readonly progressEveryFiles: number;

  public constructor(
    scanJobs: ScanJobRepository,
    files: FileRepository,
    analysisJobs: DuplicateAnalysisJobRepository,
    groups: DuplicateGroupRepository,
    hasher: FileHasher,
    options: DuplicateAnalyzerOptions = {}
  ) {
    this.scanJobs = scanJobs;
    this.files = files;
    this.analysisJobs = analysisJobs;
    this.groups = groups;
    this.hasher = hasher;
    this.logger = options.logger ?? noopLogger;
    this.yieldEveryFiles = options.yieldEveryFiles ?? 10;
    this.progressEveryFiles = options.progressEveryFiles ?? 5;
  }

  public start(scanJobId: string, callbacks: DuplicateAnalysisCallbacks = {}): DuplicateAnalysisController {
    const analysisJob = this.analysisJobs.create(scanJobId, HASH_ALGORITHM);
    let cancelled = false;
    const promise = Promise.resolve().then(() => this.run(analysisJob.id, scanJobId, () => cancelled, callbacks));
    return {
      analysisJobId: analysisJob.id,
      cancel: () => { cancelled = true; this.logger.info({ domain: 'duplicates', message: 'Duplicate analysis cancellation requested.', context: { analysisJobId: analysisJob.id, scanJobId } }); },
      promise,
    };
  }

  private async run(
    analysisJobId: string,
    scanJobId: string,
    isCancelled: () => boolean,
    callbacks: DuplicateAnalysisCallbacks
  ): Promise<DuplicateAnalysisJob> {
    const scanJob = this.scanJobs.getById(scanJobId);
    if (!scanJob || scanJob.status !== 'completed') {
      return this.failJob(analysisJobId, `Scan job ${scanJobId} is unavailable or not completed.`, callbacks);
    }

    let activeJob = this.analysisJobs.update(analysisJobId, { status: 'running', phase: 'candidate-selection' });
    callbacks.onProgress?.({ job: activeJob });
    this.logger.info({ domain: 'duplicates', message: 'Duplicate analysis started.', context: { analysisJobId, scanJobId } });

    const allFiles = this.files.listHashCandidatesByJobId(scanJobId);
    const candidates = selectDuplicateHashCandidates(allFiles);
    activeJob = this.analysisJobs.update(analysisJobId, {
      phase: 'hashing',
      totalCandidates: candidates.length,
      progressPercent: candidates.length === 0 ? 100 : 0,
    });
    callbacks.onProgress?.({ job: activeJob });

    let hashedFiles = 0;
    for (const candidate of candidates) {
      if (isCancelled()) {
        return this.cancelJob(activeJob, callbacks);
      }

      activeJob = this.analysisJobs.update(analysisJobId, {
        currentFileId: candidate.fileId,
        currentPath: candidate.absolutePath,
      });
      this.files.updateHashState(candidate.fileId, {
        hashStatus: 'hashing',
        hashError: null,
      });

      try {
        const contentHash = await this.hasher.hashFile(candidate.absolutePath);
        this.files.updateHashState(candidate.fileId, {
          hashStatus: 'hashed',
          contentHash,
          hashAlgorithm: HASH_ALGORITHM,
          hashedAt: new Date().toISOString(),
          hashError: null,
        });
      } catch (error) {
        const message = toErrorMessage(error, 'Hashing failed.');
        this.files.updateHashState(candidate.fileId, {
          hashStatus: isNodeError(error) && error.code === 'ENOENT' ? 'skipped' : 'failed',
          hashAlgorithm: HASH_ALGORITHM,
          hashedAt: new Date().toISOString(),
          hashError: message,
        });
        this.logger.warn({ domain: 'duplicates', message: 'Failed to hash file.', context: { analysisJobId, scanJobId, fileId: candidate.fileId, path: candidate.absolutePath, error: message } });
      }

      hashedFiles += 1;
      activeJob = this.analysisJobs.update(analysisJobId, {
        hashedFiles,
        progressPercent: candidates.length === 0 ? 100 : Math.min(99, Math.round((hashedFiles / candidates.length) * 100)),
      });
      if (hashedFiles <= 1 || hashedFiles % this.progressEveryFiles === 0 || hashedFiles === candidates.length) {
        this.logger.info({ domain: 'duplicates', message: 'Duplicate analysis hash progress.', context: { analysisJobId, scanJobId, hashedFiles, totalCandidates: candidates.length } });
        callbacks.onProgress?.({ job: activeJob });
      }
      if (hashedFiles % this.yieldEveryFiles === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    if (isCancelled()) {
      return this.cancelJob(activeJob, callbacks);
    }

    activeJob = this.analysisJobs.update(analysisJobId, { phase: 'grouping', currentFileId: null });
    callbacks.onProgress?.({ job: activeJob });

    const hashedRecords = this.files
      .listByJobId(scanJobId, 100_000)
      .filter((file) => file.hashStatus === 'hashed' && file.hashAlgorithm === HASH_ALGORITHM && file.contentHash);
    const grouped = new Map<string, FileRecord[]>();
    for (const file of hashedRecords) {
      const key = `${file.hashAlgorithm}:${file.contentHash}`;
      const group = grouped.get(key) ?? [];
      group.push(file);
      grouped.set(key, group);
    }

    const duplicateSets = [...grouped.values()]
      .filter((group) => group.length > 1)
      .map((group) => ({
        contentHash: group[0]!.contentHash!,
        hashAlgorithm: group[0]!.hashAlgorithm!,
        files: group,
      }));

    const persistedGroups = this.groups.replaceForAnalysis(analysisJobId, scanJobId, duplicateSets);
    const summary = buildDuplicateSummary(persistedGroups);
    activeJob = this.analysisJobs.update(analysisJobId, {
      status: 'completed',
      phase: 'completed',
      duplicateGroups: summary.totalGroups,
      duplicateFiles: summary.totalFiles,
      duplicateBytes: summary.duplicateBytes,
      reclaimableBytes: summary.reclaimableBytes,
      progressPercent: 100,
      completedAt: new Date().toISOString(),
      currentPath: null,
    });
    this.logger.info({ domain: 'duplicates', message: 'Duplicate analysis completed.', context: { analysisJobId, scanJobId, ...summary } });
    callbacks.onProgress?.({ job: activeJob });
    callbacks.onComplete?.(activeJob);
    return activeJob;
  }

  private cancelJob(job: DuplicateAnalysisJob, callbacks: DuplicateAnalysisCallbacks): DuplicateAnalysisJob {
    const cancelled = this.analysisJobs.update(job.id, {
      status: 'cancelled',
      phase: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });
    this.logger.info({ domain: 'duplicates', message: 'Duplicate analysis cancelled.', context: { analysisJobId: job.id, scanJobId: job.scanJobId } });
    callbacks.onProgress?.({ job: cancelled });
    callbacks.onComplete?.(cancelled);
    return cancelled;
  }

  private failJob(analysisJobId: string, message: string, callbacks: DuplicateAnalysisCallbacks): DuplicateAnalysisJob {
    const failed = this.analysisJobs.update(analysisJobId, {
      status: 'failed',
      phase: 'failed',
      errorMessage: message,
      completedAt: new Date().toISOString(),
    });
    this.logger.error({ domain: 'duplicates', message: 'Duplicate analysis failed.', context: { analysisJobId, error: message } });
    callbacks.onProgress?.({ job: failed });
    callbacks.onComplete?.(failed);
    return failed;
  }
}
