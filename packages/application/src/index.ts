import type {
  DuplicateAnalysisJob,
  DuplicateGroup,
  DuplicateGroupFile,
  DuplicateSummary,
  FileRecord,
  ScanEventRecord,
  ScanJob,
} from '@filepilot/domain';
import type {
  DuplicateAnalysisJobRepository,
  DuplicateAnalyzer,
  DuplicateGroupRepository,
  FileRepository,
  FileScanner,
  ScanEventRepository,
  ScanJobRepository,
} from '@filepilot/infrastructure';

export interface ScanCoordinatorDependencies {
  readonly scanner: FileScanner;
  readonly jobs: ScanJobRepository;
  readonly files: FileRepository;
  readonly events?: ScanEventRepository;
}

export interface ScanCoordinatorEvents {
  readonly onProgress?: (job: ScanJob) => void;
  readonly onComplete?: (job: ScanJob) => void;
}

export class ScanCoordinator {
  private readonly activeScans = new Map<string, { cancel(): void; promise?: Promise<ScanJob> }>();
  private readonly dependencies: ScanCoordinatorDependencies;

  public constructor(dependencies: ScanCoordinatorDependencies) {
    this.dependencies = dependencies;
  }

  public async recoverInterruptedScans(): Promise<number> {
    return this.dependencies.jobs.failStaleJobs(
      'Marked failed after app restart interrupted a previous scan.'
    );
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
    void controller.promise.catch(() => {
      this.activeScans.delete(controller.jobId);
    });
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

  public async listEventsForJob(jobId: string, limit = 100): Promise<readonly ScanEventRecord[]> {
    return this.dependencies.events?.listByJobId(jobId, limit) ?? [];
  }

  private requireJob(jobId: string): ScanJob {
    const job = this.dependencies.jobs.getById(jobId);
    if (!job) {
      throw new Error(`Expected scan job ${jobId} to exist.`);
    }

    return job;
  }
}

export interface DuplicateCoordinatorDependencies {
  readonly analyzer: DuplicateAnalyzer;
  readonly analysisJobs: DuplicateAnalysisJobRepository;
  readonly groups: DuplicateGroupRepository;
}

export interface DuplicateCoordinatorEvents {
  readonly onProgress?: (job: DuplicateAnalysisJob) => void;
  readonly onComplete?: (job: DuplicateAnalysisJob) => void;
}

export class DuplicateCoordinator {
  private readonly activeAnalyses = new Map<string, { cancel(): void; promise?: Promise<DuplicateAnalysisJob> }>();
  private readonly dependencies: DuplicateCoordinatorDependencies;

  public constructor(dependencies: DuplicateCoordinatorDependencies) {
    this.dependencies = dependencies;
  }

  public async recoverInterruptedAnalyses(): Promise<number> {
    return this.dependencies.analysisJobs.failStaleJobs(
      'Marked failed after app restart interrupted a previous duplicate analysis.'
    );
  }

  public async startAnalysis(
    scanJobId: string,
    events: DuplicateCoordinatorEvents = {}
  ): Promise<DuplicateAnalysisJob> {
    const controller = this.dependencies.analyzer.start(scanJobId, {
      onProgress: ({ job }) => events.onProgress?.(job),
      onComplete: (job) => {
        this.activeAnalyses.delete(job.id);
        events.onComplete?.(job);
      },
    });

    this.activeAnalyses.set(controller.analysisJobId, controller);
    void controller.promise.catch(() => {
      this.activeAnalyses.delete(controller.analysisJobId);
    });

    const job = this.dependencies.analysisJobs.getById(controller.analysisJobId);
    if (!job) {
      throw new Error(`Expected duplicate analysis job ${controller.analysisJobId} to exist.`);
    }

    return job;
  }

  public async cancelAnalysis(analysisJobId: string): Promise<DuplicateAnalysisJob | null> {
    this.activeAnalyses.get(analysisJobId)?.cancel();
    return this.dependencies.analysisJobs.getById(analysisJobId);
  }

  public async getAnalysisJob(analysisJobId: string): Promise<DuplicateAnalysisJob | null> {
    return this.dependencies.analysisJobs.getById(analysisJobId);
  }

  public async getLatestAnalysisForScan(scanJobId: string): Promise<DuplicateAnalysisJob | null> {
    return this.dependencies.analysisJobs.getLatestForScanJob(scanJobId);
  }

  public async listGroups(scanJobId: string, limit = 100, offset = 0): Promise<readonly DuplicateGroup[]> {
    return this.dependencies.groups.listByScanJobId(scanJobId, limit, offset);
  }

  public async getGroup(groupId: string): Promise<DuplicateGroup | null> {
    return this.dependencies.groups.getById(groupId);
  }

  public async listGroupFiles(groupId: string, limit = 200, offset = 0): Promise<readonly DuplicateGroupFile[]> {
    return this.dependencies.groups.listFiles(groupId, limit, offset);
  }

  public async summarize(scanJobId: string): Promise<DuplicateSummary> {
    return this.dependencies.groups.summarizeByScanJobId(scanJobId);
  }
}
