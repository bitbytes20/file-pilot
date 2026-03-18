import type { FileRecord, ScanJob } from '@filepilot/domain';
import type { FileRepository, FileScanner, ScanJobRepository } from '@filepilot/infrastructure';

export interface ScanCoordinatorDependencies {
  readonly scanner: FileScanner;
  readonly jobs: ScanJobRepository;
  readonly files: FileRepository;
}

export interface ScanCoordinatorEvents {
  readonly onProgress?: (job: ScanJob) => void;
  readonly onComplete?: (job: ScanJob) => void;
}

export class ScanCoordinator {
  private readonly activeScans = new Map<string, { cancel(): void }>();
  private readonly dependencies: ScanCoordinatorDependencies;

  public constructor(dependencies: ScanCoordinatorDependencies) {
    this.dependencies = dependencies;
  }

  public async startScan(rootPath: string, events: ScanCoordinatorEvents = {}): Promise<ScanJob> {
    const controller = this.dependencies.scanner.start(rootPath, {
      onProgress: ({ job }) => {
        events.onProgress?.(job);
      },
      onComplete: (job) => {
        this.activeScans.delete(job.id);
        events.onComplete?.(job);
      },
    });

    this.activeScans.set(controller.jobId, controller);
    return this.requireJob(controller.jobId);
  }

  public async cancelScan(jobId: string): Promise<ScanJob | null> {
    const controller = this.activeScans.get(jobId);
    controller?.cancel();
    return this.dependencies.jobs.getById(jobId);
  }

  public async getScanJob(jobId: string): Promise<ScanJob | null> {
    return this.dependencies.jobs.getById(jobId);
  }

  public async listRecentJobs(limit = 10): Promise<readonly ScanJob[]> {
    return this.dependencies.jobs.listRecent(limit);
  }

  public async listFilesForJob(jobId: string, limit = 500): Promise<readonly FileRecord[]> {
    return this.dependencies.files.listByJobId(jobId, limit);
  }

  private requireJob(jobId: string): ScanJob {
    const job = this.dependencies.jobs.getById(jobId);
    if (!job) {
      throw new Error(`Expected scan job ${jobId} to exist.`);
    }

    return job;
  }
}
