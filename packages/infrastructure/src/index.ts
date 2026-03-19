import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { guessFileCategory, type FileRecord, type ScanEventRecord, type ScanJob } from '@filepilot/domain';

export interface DatabaseContext {
  readonly database: DatabaseSync;
  close(): void;
}

type ScanJobRow = Omit<ScanJob, never>;
type FileRow = Omit<FileRecord, never>;
const toIsoString = (value: Date | number | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return new Date(value).toISOString();
};

const toScanJob = (row: ScanJobRow): ScanJob => row;
const toFileRecord = (row: FileRow): FileRecord => row;

export const bootstrapDatabase = async (databaseFilePath: string): Promise<DatabaseContext> => {
  await fs.mkdir(path.dirname(databaseFilePath), { recursive: true });
  const database = new DatabaseSync(databaseFilePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
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
      .prepare(`INSERT INTO scan_jobs (
        id, root_path, status, processed_paths, discovered_files, scanned_bytes, percent_complete,
        current_path, error_message, started_at, completed_at, cancelled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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

  public update(jobId: string, patch: Partial<Omit<ScanJob, 'id' | 'rootPath' | 'startedAt' | 'createdAt'>>): ScanJob {
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
      .prepare(`UPDATE scan_jobs SET
        status = ?, processed_paths = ?, discovered_files = ?, scanned_bytes = ?, percent_complete = ?,
        current_path = ?, error_message = ?, completed_at = ?, cancelled_at = ?, updated_at = ?
        WHERE id = ?`)
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

  public getById(jobId: string): ScanJob | null {
    const row = this.database
      .prepare(`SELECT
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
      FROM scan_jobs WHERE id = ?`)
      .get(jobId) as ScanJobRow | undefined;

    return row ? toScanJob(row) : null;
  }

  public listRecent(limit = 10): readonly ScanJob[] {
    const rows = this.database
      .prepare(`SELECT
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
      FROM scan_jobs ORDER BY started_at DESC LIMIT ?`)
      .all(limit) as ScanJobRow[];
    return rows.map(toScanJob);
  }
}

export class FileRepository {
  private readonly database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.database = database;
  }

  public insert(file: Omit<FileRecord, 'id' | 'createdRecordAt'>): FileRecord {
    const record: FileRecord = {
      id: randomUUID(),
      ...file,
      createdRecordAt: new Date().toISOString(),
    };

    this.database
      .prepare(`INSERT INTO files (
        id, job_id, absolute_path, file_name, extension, size_bytes, created_at, modified_at, category, created_record_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
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
      .prepare(`SELECT
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
      FROM files WHERE job_id = ? ORDER BY absolute_path ASC LIMIT ?`)
      .all(jobId, limit) as FileRow[];
    return rows.map(toFileRecord);
  }
}

export class ScanEventRepository {
  private readonly database: DatabaseSync;

  public constructor(database: DatabaseSync) {
    this.database = database;
  }

  public record(event: Omit<ScanEventRecord, 'id' | 'createdAt'>): ScanEventRecord {
    const row: ScanEventRecord = {
      id: randomUUID(),
      ...event,
      createdAt: new Date().toISOString(),
    };

    this.database
      .prepare('INSERT INTO scan_events (id, job_id, level, event_type, message, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(row.id, row.jobId, row.level, row.eventType, row.message, row.path, row.createdAt);

    return row;
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

export class FileScanner {
  private readonly jobs: ScanJobRepository;
  private readonly files: FileRepository;
  private readonly events: ScanEventRepository;

  public constructor(jobs: ScanJobRepository, files: FileRepository, events: ScanEventRepository) {
    this.jobs = jobs;
    this.files = files;
    this.events = events;
  }

  public start(rootPath: string, callbacks: ScannerCallbacks = {}): ScannerController {
    const job = this.jobs.create(rootPath);
    let cancelled = false;

    const promise = Promise.resolve().then(() => this.run(job.id, rootPath, () => cancelled, callbacks));
    return {
      jobId: job.id,
      cancel: () => {
        cancelled = true;
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
    await this.events.record({ jobId, level: 'info', eventType: 'scan_started', message: 'Scan started.', path: rootPath });

    const discoveredFiles = await this.enumerateFiles(rootPath, jobId, isCancelled);
    let processedPaths = 0;
    let persistedFiles = 0;
    let scannedBytes = 0;

    for (const absolutePath of discoveredFiles) {
      if (isCancelled()) {
        activeJob = this.jobs.update(jobId, {
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          currentPath: absolutePath,
          percentComplete: Math.min(activeJob.percentComplete, 99),
        });
        await this.events.record({
          jobId,
          level: 'info',
          eventType: 'scan_cancelled',
          message: 'Scan cancelled by user.',
          path: absolutePath,
        });
        callbacks.onProgress?.({ job: activeJob });
        callbacks.onComplete?.(activeJob);
        return activeJob;
      }

      processedPaths += 1;

      try {
        const stats = await fs.stat(absolutePath, { bigint: false });
        if (!stats.isFile()) {
          continue;
        }

        const extension = path.extname(absolutePath).replace(/^\./u, '').toLowerCase();
        this.files.insert({
          jobId,
          absolutePath,
          fileName: path.basename(absolutePath),
          extension,
          sizeBytes: stats.size,
          createdAt: toIsoString(stats.birthtimeMs),
          modifiedAt: toIsoString(stats.mtimeMs),
          category: guessFileCategory(extension),
        });
        persistedFiles += 1;
        scannedBytes += stats.size;
      } catch (error) {
        await this.events.record({
          jobId,
          level: 'warning',
          eventType: 'file_skipped',
          message: error instanceof Error ? error.message : 'Unknown file error.',
          path: absolutePath,
        });
      }

      activeJob = this.jobs.update(jobId, {
        processedPaths,
        discoveredFiles: persistedFiles,
        scannedBytes,
        percentComplete: discoveredFiles.length === 0 ? 100 : Math.round((processedPaths / discoveredFiles.length) * 100),
        currentPath: absolutePath,
      });
      callbacks.onProgress?.({ job: activeJob });
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
    await this.events.record({ jobId, level: 'info', eventType: 'scan_completed', message: 'Scan completed.', path: rootPath });
    callbacks.onProgress?.({ job: activeJob });
    callbacks.onComplete?.(activeJob);
    return activeJob;
  }

  private async enumerateFiles(rootPath: string, jobId: string, isCancelled: () => boolean): Promise<string[]> {
    const queue = [rootPath];
    const files: string[] = [];

    while (queue.length > 0) {
      if (isCancelled()) {
        break;
      }

      const currentPath = queue.shift();
      if (!currentPath) {
        break;
      }

      let entries;
      try {
        entries = await fs.readdir(currentPath, { withFileTypes: true });
      } catch (error) {
        await this.events.record({
          jobId,
          level: 'warning',
          eventType: 'directory_skipped',
          message: error instanceof Error ? error.message : 'Unable to read directory.',
          path: currentPath,
        });
        continue;
      }

      for (const entry of entries) {
        const absolutePath = path.join(currentPath, entry.name);
        try {
          if (entry.isSymbolicLink()) {
            await this.events.record({
              jobId,
              level: 'warning',
              eventType: 'symlink_skipped',
              message: 'Symlink skipped for safety.',
              path: absolutePath,
            });
            continue;
          }

          if (entry.isDirectory()) {
            queue.push(absolutePath);
            continue;
          }

          if (entry.isFile()) {
            files.push(absolutePath);
          }
        } catch (error) {
          await this.events.record({
            jobId,
            level: 'warning',
            eventType: 'path_skipped',
            message: error instanceof Error ? error.message : 'Unable to process path.',
            path: absolutePath,
          });
        }
      }
    }

    return files;
  }
}
