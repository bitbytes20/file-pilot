import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import { ScanCoordinator } from '@filepilot/application';
import {
  FileRepository,
  FileScanner,
  ScanEventRepository,
  ScanJobRepository,
  bootstrapDatabase,
} from '@filepilot/infrastructure';
import {
  ipcChannels,
  parseScanCancelRequest,
  parseScanGetJobRequest,
  parseScanListEventsRequest,
  parseScanListFilesRequest,
  parseScanStartRequest,
  toScanEventDto,
  toScanFileDto,
  toScanJobDto,
  type FolderSelectionResult,
} from '@filepilot/shared-contracts';
import { infrastructureLogger, logger } from '../logger.js';
import { resolveDatabasePath } from '../paths.js';

interface ScanRuntime {
  readonly coordinator: ScanCoordinator;
  readonly close: () => void;
}

let scanRuntimePromise: Promise<ScanRuntime> | null = null;

const getActiveWindow = (): BrowserWindow | null =>
  BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

const getScanRuntime = async (): Promise<ScanRuntime> => {
  if (!scanRuntimePromise) {
    scanRuntimePromise = (async () => {
      const databasePath = resolveDatabasePath();
      const database = await bootstrapDatabase(databasePath, infrastructureLogger);
      const jobs = new ScanJobRepository(database.database);
      const files = new FileRepository(database.database);
      const events = new ScanEventRepository(database.database);
      const scanner = new FileScanner(jobs, files, events, { logger: infrastructureLogger });
      const coordinator = new ScanCoordinator({ scanner, jobs, files, events });
      const staleRecovered = await coordinator.recoverInterruptedScans();
      logger.info('Scan runtime initialized.', { databasePath, staleRecovered });
      if (staleRecovered > 0) {
        logger.warn('Recovered stale scan jobs after restart.', { staleRecovered });
      }

      return {
        coordinator,
        close: () => database.close(),
      };
    })();
  }

  return scanRuntimePromise;
};

export const disposeScanRuntime = async (): Promise<void> => {
  if (!scanRuntimePromise) {
    return;
  }

  const runtime = await scanRuntimePromise;
  runtime.close();
  scanRuntimePromise = null;
};

const resolveFolderSelection = async (): Promise<FolderSelectionResult> => {
  const forcedFolder = process.env.FILEPILOT_TEST_SELECTED_FOLDER;
  if (forcedFolder) {
    return {
      canceled: false,
      folderPath: forcedFolder,
    };
  }

  const activeWindow = getActiveWindow();
  const options: OpenDialogOptions = {
    title: 'Select folder to scan',
    properties: ['openDirectory'],
  };
  const result = activeWindow
    ? await dialog.showOpenDialog(activeWindow, options)
    : await dialog.showOpenDialog(options);

  return {
    canceled: result.canceled,
    folderPath: result.filePaths[0] ?? null,
  };
};

export const registerIpcHandlers = (): void => {
  ipcMain.handle(ipcChannels.appGetVersion, () => process.versions.electron);

  ipcMain.handle(
    ipcChannels.dialogSelectFolder,
    async (): Promise<FolderSelectionResult> => resolveFolderSelection()
  );

  ipcMain.handle(ipcChannels.scanStart, async (event, payload: unknown) => {
    const { rootPath } = parseScanStartRequest(payload);
    const { coordinator } = await getScanRuntime();
    const window = BrowserWindow.fromWebContents(event.sender);
    logger.info('IPC start scan request received.', { rootPath });

    const job = await coordinator.startScan(rootPath, {
      onProgress: (nextJob) => {
        window?.webContents.send(ipcChannels.scanProgress, toScanJobDto(nextJob));
      },
      onComplete: (nextJob) => {
        window?.webContents.send(ipcChannels.scanComplete, {
          jobId: nextJob.id,
          status: nextJob.status,
          completedAt: nextJob.completedAt,
          cancelledAt: nextJob.cancelledAt,
          errorMessage: nextJob.errorMessage,
        });
      },
    });

    return toScanJobDto(job);
  });

  ipcMain.handle(ipcChannels.scanGetJob, async (_event, payload: unknown) => {
    const request = parseScanGetJobRequest(payload);
    const { coordinator } = await getScanRuntime();
    const job = await coordinator.getScanJob(request.jobId);
    return job ? toScanJobDto(job) : null;
  });

  ipcMain.handle(ipcChannels.scanListRecentJobs, async () => {
    const { coordinator } = await getScanRuntime();
    const jobs = await coordinator.listRecentJobs();
    return jobs.map((job) => toScanJobDto(job));
  });

  ipcMain.handle(ipcChannels.scanListFiles, async (_event, payload: unknown) => {
    const request = parseScanListFilesRequest(payload);
    const { coordinator } = await getScanRuntime();
    const files = await coordinator.listFilesForJob(request.jobId, request.limit);
    return files.map((file) => toScanFileDto(file));
  });

  ipcMain.handle(ipcChannels.scanListEvents, async (_event, payload: unknown) => {
    const request = parseScanListEventsRequest(payload);
    const { coordinator } = await getScanRuntime();
    const events = await coordinator.listEventsForJob(request.jobId, request.limit ?? 100);
    return events.map((scanEvent) => toScanEventDto(scanEvent));
  });

  ipcMain.handle(ipcChannels.scanCancel, async (_event, payload: unknown) => {
    const request = parseScanCancelRequest(payload);
    const { coordinator } = await getScanRuntime();
    logger.info('IPC cancel scan request received.', { jobId: request.jobId });
    const job = await coordinator.cancelScan(request.jobId);
    return job ? toScanJobDto(job) : null;
  });
};

app.once('before-quit', () => {
  void disposeScanRuntime();
});
