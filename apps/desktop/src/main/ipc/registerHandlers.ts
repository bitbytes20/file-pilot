import path from 'node:path';
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
  parseScanListFilesRequest,
  parseScanStartRequest,
  toScanFileDto,
  toScanJobDto,
  type FolderSelectionResult,
} from '@filepilot/shared-contracts';

let scanCoordinatorPromise: Promise<ScanCoordinator> | null = null;

const getActiveWindow = (): BrowserWindow | null =>
  BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

const getScanCoordinator = async (): Promise<ScanCoordinator> => {
  if (!scanCoordinatorPromise) {
    scanCoordinatorPromise = (async () => {
      const database = await bootstrapDatabase(path.join(app.getPath('userData'), 'filepilot.sqlite'));
      const jobs = new ScanJobRepository(database.database);
      const files = new FileRepository(database.database);
      const events = new ScanEventRepository(database.database);
      const scanner = new FileScanner(jobs, files, events);
      return new ScanCoordinator({ scanner, jobs, files });
    })();
  }

  return scanCoordinatorPromise;
};

export const registerIpcHandlers = (): void => {
  ipcMain.handle(ipcChannels.appGetVersion, () => process.versions.electron);

  ipcMain.handle(ipcChannels.dialogSelectFolder, async (): Promise<FolderSelectionResult> => {
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
  });

  ipcMain.handle(ipcChannels.scanStart, async (event, payload: unknown) => {
    const { rootPath } = parseScanStartRequest(payload);
    const scanCoordinator = await getScanCoordinator();
    const window = BrowserWindow.fromWebContents(event.sender);
    const job = await scanCoordinator.startScan(rootPath, {
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
    const scanCoordinator = await getScanCoordinator();
    const job = await scanCoordinator.getScanJob(request.jobId);
    return job ? toScanJobDto(job) : null;
  });

  ipcMain.handle(ipcChannels.scanListRecentJobs, async () => {
    const scanCoordinator = await getScanCoordinator();
    const jobs = await scanCoordinator.listRecentJobs();
    return jobs.map((job) => toScanJobDto(job));
  });

  ipcMain.handle(ipcChannels.scanListFiles, async (_event, payload: unknown) => {
    const request = parseScanListFilesRequest(payload);
    const scanCoordinator = await getScanCoordinator();
    const files = await scanCoordinator.listFilesForJob(request.jobId, request.limit);
    return files.map((file) => toScanFileDto(file));
  });

  ipcMain.handle(ipcChannels.scanCancel, async (_event, payload: unknown) => {
    const request = parseScanCancelRequest(payload);
    const scanCoordinator = await getScanCoordinator();
    const job = await scanCoordinator.cancelScan(request.jobId);
    return job ? toScanJobDto(job) : null;
  });
};
