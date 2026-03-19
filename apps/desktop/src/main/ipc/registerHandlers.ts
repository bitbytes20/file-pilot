import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import { DuplicateCoordinator, ScanCoordinator } from '@filepilot/application';
import {
  DuplicateAnalysisJobRepository,
  DuplicateAnalyzer,
  DuplicateGroupRepository,
  FileRepository,
  FileScanner,
  ScanEventRepository,
  ScanJobRepository,
  StreamingFileHasher,
  bootstrapDatabase,
} from '@filepilot/infrastructure';
import {
  ipcChannels,
  parseDuplicatesCancelAnalysisRequest,
  parseDuplicatesGetAnalysisJobRequest,
  parseDuplicatesGetGroupRequest,
  parseDuplicatesGetLatestAnalysisRequest,
  parseDuplicatesListGroupFilesRequest,
  parseDuplicatesListGroupsRequest,
  parseDuplicatesStartAnalysisRequest,
  parseScanCancelRequest,
  parseScanGetJobRequest,
  parseScanListEventsRequest,
  parseScanListFilesRequest,
  parseScanStartRequest,
  toDuplicateAnalysisJobDto,
  toDuplicateGroupDto,
  toDuplicateGroupFileDto,
  toDuplicateSummaryDto,
  toScanEventDto,
  toScanFileDto,
  toScanJobDto,
  type FolderSelectionResult,
} from '@filepilot/shared-contracts';
import { infrastructureLogger, logger } from '../logger.js';
import { resolveDatabasePath } from '../paths.js';

interface DesktopRuntime {
  readonly scans: ScanCoordinator;
  readonly duplicates: DuplicateCoordinator;
  readonly close: () => void;
}

let runtimePromise: Promise<DesktopRuntime> | null = null;
const getActiveWindow = (): BrowserWindow | null => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

const getRuntime = async (): Promise<DesktopRuntime> => {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const databasePath = resolveDatabasePath();
      const database = await bootstrapDatabase(databasePath, infrastructureLogger);
      const jobs = new ScanJobRepository(database.database);
      const files = new FileRepository(database.database);
      const events = new ScanEventRepository(database.database);
      const duplicateAnalysisJobs = new DuplicateAnalysisJobRepository(database.database);
      const duplicateGroups = new DuplicateGroupRepository(database.database);
      const scanner = new FileScanner(jobs, files, events, { logger: infrastructureLogger });
      const analyzer = new DuplicateAnalyzer(jobs, files, duplicateAnalysisJobs, duplicateGroups, new StreamingFileHasher(), { logger: infrastructureLogger });
      const scans = new ScanCoordinator({ scanner, jobs, files, events });
      const duplicates = new DuplicateCoordinator({ analyzer, analysisJobs: duplicateAnalysisJobs, groups: duplicateGroups });
      const staleRecovered = await scans.recoverInterruptedScans();
      const staleAnalysesRecovered = await duplicates.recoverInterruptedAnalyses();
      logger.info('Desktop runtime initialized.', { databasePath, staleRecovered, staleAnalysesRecovered });
      return { scans, duplicates, close: () => database.close() };
    })();
  }
  return runtimePromise;
};

export const disposeScanRuntime = async (): Promise<void> => {
  if (!runtimePromise) return;
  const runtime = await runtimePromise;
  runtime.close();
  runtimePromise = null;
};

const resolveFolderSelection = async (): Promise<FolderSelectionResult> => {
  const forcedFolder = process.env.FILEPILOT_TEST_SELECTED_FOLDER;
  if (forcedFolder) return { canceled: false, folderPath: forcedFolder };
  const activeWindow = getActiveWindow();
  const options: OpenDialogOptions = { title: 'Select folder to scan', properties: ['openDirectory'] };
  const result = activeWindow ? await dialog.showOpenDialog(activeWindow, options) : await dialog.showOpenDialog(options);
  return { canceled: result.canceled, folderPath: result.filePaths[0] ?? null };
};

export const registerIpcHandlers = (): void => {
  ipcMain.handle(ipcChannels.appGetVersion, () => process.versions.electron);
  ipcMain.handle(ipcChannels.dialogSelectFolder, async (): Promise<FolderSelectionResult> => resolveFolderSelection());

  ipcMain.handle(ipcChannels.scanStart, async (event, payload: unknown) => {
    const { rootPath } = parseScanStartRequest(payload);
    const { scans } = await getRuntime();
    const window = BrowserWindow.fromWebContents(event.sender);
    logger.info('IPC start scan request received.', { rootPath });
    const job = await scans.startScan(rootPath, {
      onProgress: (nextJob) => window?.webContents.send(ipcChannels.scanProgress, toScanJobDto(nextJob)),
      onComplete: (nextJob) => window?.webContents.send(ipcChannels.scanComplete, { jobId: nextJob.id, status: nextJob.status, completedAt: nextJob.completedAt, cancelledAt: nextJob.cancelledAt, errorMessage: nextJob.errorMessage }),
    });
    return toScanJobDto(job);
  });

  ipcMain.handle(ipcChannels.scanGetJob, async (_event, payload: unknown) => {
    const request = parseScanGetJobRequest(payload);
    const { scans } = await getRuntime();
    const job = await scans.getScanJob(request.jobId);
    return job ? toScanJobDto(job) : null;
  });
  ipcMain.handle(ipcChannels.scanListRecentJobs, async () => {
    const { scans } = await getRuntime();
    return (await scans.listRecentJobs()).map(toScanJobDto);
  });
  ipcMain.handle(ipcChannels.scanListFiles, async (_event, payload: unknown) => {
    const request = parseScanListFilesRequest(payload);
    const { scans } = await getRuntime();
    return (await scans.listFilesForJob(request.jobId, request.limit)).map(toScanFileDto);
  });
  ipcMain.handle(ipcChannels.scanListEvents, async (_event, payload: unknown) => {
    const request = parseScanListEventsRequest(payload);
    const { scans } = await getRuntime();
    return (await scans.listEventsForJob(request.jobId, request.limit ?? 100)).map(toScanEventDto);
  });
  ipcMain.handle(ipcChannels.scanCancel, async (_event, payload: unknown) => {
    const request = parseScanCancelRequest(payload);
    const { scans } = await getRuntime();
    logger.info('IPC cancel scan request received.', { jobId: request.jobId });
    const job = await scans.cancelScan(request.jobId);
    return job ? toScanJobDto(job) : null;
  });

  ipcMain.handle(ipcChannels.duplicatesStartAnalysis, async (event, payload: unknown) => {
    const request = parseDuplicatesStartAnalysisRequest(payload);
    const { duplicates } = await getRuntime();
    const window = BrowserWindow.fromWebContents(event.sender);
    logger.info('IPC start duplicate analysis request received.', { scanJobId: request.scanJobId });
    const job = await duplicates.startAnalysis(request.scanJobId, {
      onProgress: (nextJob) => window?.webContents.send(ipcChannels.duplicatesProgress, toDuplicateAnalysisJobDto(nextJob)),
      onComplete: (nextJob) => window?.webContents.send(ipcChannels.duplicatesComplete, { analysisJobId: nextJob.id, scanJobId: nextJob.scanJobId, status: nextJob.status, completedAt: nextJob.completedAt, cancelledAt: nextJob.cancelledAt, errorMessage: nextJob.errorMessage }),
    });
    return toDuplicateAnalysisJobDto(job);
  });
  ipcMain.handle(ipcChannels.duplicatesGetAnalysisJob, async (_event, payload: unknown) => {
    const request = parseDuplicatesGetAnalysisJobRequest(payload);
    const { duplicates } = await getRuntime();
    const job = await duplicates.getAnalysisJob(request.analysisJobId);
    return job ? toDuplicateAnalysisJobDto(job) : null;
  });
  ipcMain.handle(ipcChannels.duplicatesGetLatestAnalysis, async (_event, payload: unknown) => {
    const request = parseDuplicatesGetLatestAnalysisRequest(payload);
    const { duplicates } = await getRuntime();
    const job = await duplicates.getLatestAnalysisForScan(request.scanJobId);
    return job ? toDuplicateAnalysisJobDto(job) : null;
  });
  ipcMain.handle(ipcChannels.duplicatesListGroups, async (_event, payload: unknown) => {
    const request = parseDuplicatesListGroupsRequest(payload);
    const { duplicates } = await getRuntime();
    return (await duplicates.listGroups(request.scanJobId, request.limit ?? 100, request.offset ?? 0)).map(toDuplicateGroupDto);
  });
  ipcMain.handle(ipcChannels.duplicatesGetGroup, async (_event, payload: unknown) => {
    const request = parseDuplicatesGetGroupRequest(payload);
    const { duplicates } = await getRuntime();
    const group = await duplicates.getGroup(request.groupId);
    return group ? toDuplicateGroupDto(group) : null;
  });
  ipcMain.handle(ipcChannels.duplicatesListGroupFiles, async (_event, payload: unknown) => {
    const request = parseDuplicatesListGroupFilesRequest(payload);
    const { duplicates } = await getRuntime();
    return (await duplicates.listGroupFiles(request.groupId, request.limit ?? 200, request.offset ?? 0)).map(toDuplicateGroupFileDto);
  });
  ipcMain.handle(ipcChannels.duplicatesGetSummary, async (_event, payload: unknown) => {
    const request = parseDuplicatesGetLatestAnalysisRequest(payload);
    const { duplicates } = await getRuntime();
    return toDuplicateSummaryDto(await duplicates.summarize(request.scanJobId));
  });
  ipcMain.handle(ipcChannels.duplicatesCancelAnalysis, async (_event, payload: unknown) => {
    const request = parseDuplicatesCancelAnalysisRequest(payload);
    const { duplicates } = await getRuntime();
    const job = await duplicates.cancelAnalysis(request.analysisJobId);
    return job ? toDuplicateAnalysisJobDto(job) : null;
  });
};

app.once('before-quit', () => { void disposeScanRuntime(); });
