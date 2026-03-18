import { randomUUID } from 'node:crypto';
import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import {
  ipcChannels,
  parseScanStartRequest,
  type FolderSelectionResult,
  type ScanCompleteEvent,
  type ScanProgressEvent,
  type ScanSession,
} from '@filepilot/shared-contracts';

const mockScanSteps = 5;
const mockScanDelayMs = 250;

const buildProgressEvent = (session: ScanSession, step: number): ScanProgressEvent => ({
  sessionId: session.sessionId,
  processedPaths: step * 24,
  discoveredFiles: step * 19,
  scannedBytes: step * 128 * 1024 * 1024,
  percentComplete: Math.round((step / mockScanSteps) * 100),
  currentPath: `${session.rootPath}/mock-item-${step}`,
});

const buildCompleteEvent = (
  session: ScanSession,
  lastProgress: ScanProgressEvent
): ScanCompleteEvent => ({
  sessionId: session.sessionId,
  processedPaths: lastProgress.processedPaths,
  discoveredFiles: lastProgress.discoveredFiles,
  scannedBytes: lastProgress.scannedBytes,
  completedAt: new Date().toISOString(),
  rootPath: session.rootPath,
});

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const getActiveWindow = (): BrowserWindow | null =>
  BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

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

  ipcMain.handle(
    ipcChannels.scanStartMock,
    async (_event, payload: unknown): Promise<ScanSession> => {
      const request = parseScanStartRequest(payload);
      const session: ScanSession = {
        sessionId: randomUUID(),
        rootPath: request.rootPath,
        startedAt: new Date().toISOString(),
      };

      const window = BrowserWindow.fromWebContents(_event.sender);

      void (async () => {
        let latestProgress = buildProgressEvent(session, 1);

        for (let step = 1; step <= mockScanSteps; step += 1) {
          latestProgress = buildProgressEvent(session, step);
          window?.webContents.send(ipcChannels.scanProgress, latestProgress);
          await delay(mockScanDelayMs);
        }

        window?.webContents.send(
          ipcChannels.scanComplete,
          buildCompleteEvent(session, latestProgress)
        );
      })();

      return session;
    }
  );
};
