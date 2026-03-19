import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import {
  guessFileCategory,
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

const toIsoString = (value: Date | number | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return new Date(value).toISOString();
};

const toScanJob = (row: ScanJobRow): ScanJob => row;
const toFileRecord = (row: FileRow): FileRecord => row;
const toScanEventRecord = (row: ScanEventRow): ScanEventRecord => row;

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
  `);
};

export const bootstrapDatabase = async (
  databaseFilePath: string,
  logger: Logger = noopLogger
): Promise<DatabaseContext> => {
  await fs.mkdir(path.dirname(databaseFilePath), { recursive: true });
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
      id, job_id, absolute_path, file_name, extension, size_bytes, created_at, modified_at, category, created_record_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  }

  public insert(file: Omit<FileRecord, 'id' | 'createdRecordAt'>): FileRecord {
    const record: FileRecord = {
      id: randomUUID(),
      ...file,
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
        created_record_at as createdRecordAt
      FROM files WHERE job_id = ? ORDER BY absolute_path ASC LIMIT ?`
      )
      .all(jobId, limit) as FileRow[];
    return rows.map(toFileRecord);
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
      return {
        eventType: 'permission_denied',
        level: 'warning',
        message: 'Permission denied while reading path.',
      };
    case 'ENOENT':
      return {
        eventType: 'path_missing',
        level: 'warning',
        message: 'Path disappeared during scan.',
      };
    case 'ENOTDIR':
      return {
        eventType: 'not_a_directory',
        level: 'warning',
        message: 'Expected a directory but found a non-directory path.',
      };
    case 'EIO':
      return {
        eventType: 'device_io_error',
        level: 'error',
        message: 'I/O error while reading path. The device may be unavailable.',
      };
    default:
      return {
        eventType: 'path_error',
        level: 'warning',
        message: toErrorMessage(error, 'Unable to access path.'),
      };
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

    const promise = Promise.resolve().then(() =>
      this.run(job.id, rootPath, () => cancelled, callbacks)
    );
    return {
      jobId: job.id,
      cancel: () => {
        cancelled = true;
        this.logger.info({
          domain: 'scan',
          message: 'Cancellation requested.',
          context: { jobId: job.id, rootPath },
        });
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
    this.events.record({
      jobId,
      level: 'info',
      eventType: 'scan_started',
      message: 'Scan started.',
      path: rootPath,
    });

    try {
      const rootStats = await fs.lstat(rootPath);
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
        this.events.record({
          jobId,
          level: 'info',
          eventType: 'scan_cancelled',
          message: 'Scan cancelled by user.',
          path: activeJob.currentPath,
        });
        this.logger.info({
          domain: 'scan',
          message: 'Scan cancelled.',
          context: { jobId, processedPaths, persistedFiles, scannedBytes },
        });
        callbacks.onProgress?.({ job: activeJob });
        callbacks.onComplete?.(activeJob);
        return activeJob;
      }

      const currentPath = queue.shift();
      if (!currentPath) {
        break;
      }

      processedPaths += 1;
      maxQueueDepth = Math.max(maxQueueDepth, queue.length + 1);

      let currentStats;
      try {
        currentStats = await fs.lstat(currentPath);
      } catch (error) {
        await this.recordFsWarning(jobId, currentPath, error);
        activeJob = this.updateProgress(jobId, {
          processedPaths,
          persistedFiles,
          scannedBytes,
          currentPath,
          queueLength: queue.length,
        });
        await this.emitProgressMaybe(
          activeJob,
          callbacks,
          processedPaths,
          () => {
            lastProgressAt = Date.now();
          },
          lastProgressAt
        );
        continue;
      }

      if (currentStats.isSymbolicLink()) {
        this.events.record({
          jobId,
          level: 'warning',
          eventType: 'symlink_skipped',
          message: 'Symlink skipped for safety.',
          path: currentPath,
        });
        this.logger.warn({
          domain: 'scan',
          message: 'Skipped symlink.',
          context: { jobId, path: currentPath },
        });
      } else if (currentStats.isDirectory()) {
        let entries;
        try {
          entries = await fs.readdir(currentPath, { withFileTypes: true });
        } catch (error) {
          await this.recordFsWarning(jobId, currentPath, error);
          activeJob = this.updateProgress(jobId, {
            processedPaths,
            persistedFiles,
            scannedBytes,
            currentPath,
            queueLength: queue.length,
          });
          await this.emitProgressMaybe(
            activeJob,
            callbacks,
            processedPaths,
            () => {
              lastProgressAt = Date.now();
            },
            lastProgressAt
          );
          continue;
        }

        for (const entry of entries) {
          queue.push(path.join(currentPath, entry.name));
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

      activeJob = this.updateProgress(jobId, {
        processedPaths,
        persistedFiles,
        scannedBytes,
        currentPath,
        queueLength: queue.length,
      });
      await this.emitProgressMaybe(
        activeJob,
        callbacks,
        processedPaths,
        () => {
          lastProgressAt = Date.now();
        },
        lastProgressAt
      );

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
    this.events.record({
      jobId,
      level: 'info',
      eventType: 'scan_completed',
      message: 'Scan completed.',
      path: rootPath,
    });
    this.events.record({
      jobId,
      level: 'info',
      eventType: 'scan_metrics',
      message: `Processed ${processedPaths} paths and persisted ${persistedFiles} files.`,
      path: rootPath,
    });
    this.logger.info({
      domain: 'scan',
      message: 'Scan completed.',
      context: { jobId, rootPath, processedPaths, persistedFiles, scannedBytes, maxQueueDepth },
    });
    callbacks.onProgress?.({ job: activeJob });
    callbacks.onComplete?.(activeJob);
    return activeJob;
  }

  private updateProgress(
    jobId: string,
    metrics: {
      processedPaths: number;
      persistedFiles: number;
      scannedBytes: number;
      currentPath: string;
      queueLength: number;
    }
  ): ScanJob {
    const denominator = metrics.processedPaths + metrics.queueLength;
    const percentComplete =
      denominator <= 0
        ? 0
        : Math.min(99, Math.max(1, Math.round((metrics.processedPaths / denominator) * 100)));
    return this.jobs.update(jobId, {
      processedPaths: metrics.processedPaths,
      discoveredFiles: metrics.persistedFiles,
      scannedBytes: metrics.scannedBytes,
      percentComplete,
      currentPath: metrics.currentPath,
    });
  }

  private async emitProgressMaybe(
    job: ScanJob,
    callbacks: ScannerCallbacks,
    processedPaths: number,
    onEmit: () => void,
    lastProgressAt: number
  ): Promise<void> {
    const now = Date.now();
    if (
      processedPaths <= 1 ||
      processedPaths % this.progressEveryPaths === 0 ||
      now - lastProgressAt >= this.progressEveryMs
    ) {
      callbacks.onProgress?.({ job });
      onEmit();
    }
  }

  private async recordFsWarning(jobId: string, targetPath: string, error: unknown): Promise<void> {
    const classification = classifyFsError(error);
    this.events.record({
      jobId,
      level: classification.level,
      eventType: classification.eventType,
      message: `${classification.message} ${toErrorMessage(error, '')}`.trim(),
      path: targetPath,
    });
    this.logger[classification.level === 'error' ? 'error' : 'warn']({
      domain: 'filesystem',
      message: classification.message,
      context: { jobId, path: targetPath, error: toErrorMessage(error, classification.message) },
    });
  }

  private async failJob(
    jobId: string,
    rootPath: string,
    error: unknown,
    callbacks: ScannerCallbacks
  ): Promise<ScanJob> {
    const message = toErrorMessage(error, 'Scan failed to start.');
    const failedJob = this.jobs.update(jobId, {
      status: 'failed',
      errorMessage: message,
      currentPath: rootPath,
      completedAt: new Date().toISOString(),
    });
    this.events.record({
      jobId,
      level: 'error',
      eventType: 'scan_failed',
      message,
      path: rootPath,
    });
    this.logger.error({
      domain: 'scan',
      message: 'Scan failed.',
      context: { jobId, rootPath, error: message },
    });
    callbacks.onProgress?.({ job: failedJob });
    callbacks.onComplete?.(failedJob);
    return failedJob;
  }
}
