import type { ScanCompleteEvent, ScanProgressEvent } from '@filepilot/shared-contracts';

const formatBytes = (value: number): string => {
  if (value === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Renderer root element was not found.');
}

app.innerHTML = `
  <main style="max-width: 880px; margin: 0 auto; padding: 48px 24px 64px;">
    <header style="margin-bottom: 32px;">
      <p style="margin: 0 0 8px; color: #8aa4ff; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">Tranche B shell</p>
      <h1 style="margin: 0; font-size: 40px;">FilePilot mock scan</h1>
      <p id="version" style="margin: 12px 0 0; color: #a8b0bf;"></p>
    </header>

    <section style="background: rgba(24, 30, 40, 0.92); border: 1px solid #2a3240; border-radius: 18px; padding: 24px; box-shadow: 0 18px 40px rgba(0,0,0,0.25);">
      <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 18px;">
        <button id="select-folder" style="appearance: none; border: 0; border-radius: 10px; background: #4b74ff; color: white; padding: 12px 16px; font-weight: 600; cursor: pointer;">Select folder</button>
        <button id="start-scan" style="appearance: none; border: 1px solid #3a4354; border-radius: 10px; background: #161b24; color: white; padding: 12px 16px; font-weight: 600; cursor: pointer;" disabled>Run mock scan</button>
        <span id="folder-path" style="color: #cdd6e3; word-break: break-all;">No folder selected.</span>
      </div>

      <div style="margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #a8b0bf;">
          <span>Progress</span>
          <span id="progress-label">Idle</span>
        </div>
        <div style="height: 12px; background: #0f131a; border-radius: 999px; overflow: hidden; border: 1px solid #273041;">
          <div id="progress-bar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #4b74ff, #73e0ff);"></div>
        </div>
      </div>

      <dl style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0 0 18px;">
        <div style="padding: 16px; border-radius: 14px; background: #121720; border: 1px solid #222c3b;"><dt style="color: #7e8aa0; margin-bottom: 6px;">Paths</dt><dd id="paths-value" style="margin: 0; font-size: 26px;">0</dd></div>
        <div style="padding: 16px; border-radius: 14px; background: #121720; border: 1px solid #222c3b;"><dt style="color: #7e8aa0; margin-bottom: 6px;">Files</dt><dd id="files-value" style="margin: 0; font-size: 26px;">0</dd></div>
        <div style="padding: 16px; border-radius: 14px; background: #121720; border: 1px solid #222c3b;"><dt style="color: #7e8aa0; margin-bottom: 6px;">Bytes</dt><dd id="bytes-value" style="margin: 0; font-size: 26px;">0 B</dd></div>
      </dl>

      <div style="padding: 16px; border-radius: 14px; background: #0f131a; border: 1px solid #222c3b;">
        <p style="margin: 0 0 8px; color: #7e8aa0;">Current item</p>
        <p id="current-path" style="margin: 0; color: #dfe7f5; word-break: break-all;">Waiting for a scan.</p>
      </div>
    </section>
  </main>
`;

const version = document.querySelector<HTMLParagraphElement>('#version');
const selectFolderButton = document.querySelector<HTMLButtonElement>('#select-folder');
const startScanButton = document.querySelector<HTMLButtonElement>('#start-scan');
const folderPath = document.querySelector<HTMLSpanElement>('#folder-path');
const progressBar = document.querySelector<HTMLDivElement>('#progress-bar');
const progressLabel = document.querySelector<HTMLSpanElement>('#progress-label');
const pathsValue = document.querySelector<HTMLElement>('#paths-value');
const filesValue = document.querySelector<HTMLElement>('#files-value');
const bytesValue = document.querySelector<HTMLElement>('#bytes-value');
const currentPath = document.querySelector<HTMLParagraphElement>('#current-path');

if (
  !version ||
  !selectFolderButton ||
  !startScanButton ||
  !folderPath ||
  !progressBar ||
  !progressLabel ||
  !pathsValue ||
  !filesValue ||
  !bytesValue ||
  !currentPath
) {
  throw new Error('Renderer UI elements are missing.');
}

let selectedFolderPath: string | null = null;
let activeSessionId: string | null = null;

const renderProgress = (progress: ScanProgressEvent): void => {
  if (progress.sessionId !== activeSessionId) {
    return;
  }

  progressBar.style.width = `${progress.percentComplete}%`;
  progressLabel.textContent = `${progress.percentComplete}%`;
  pathsValue.textContent = String(progress.processedPaths);
  filesValue.textContent = String(progress.discoveredFiles);
  bytesValue.textContent = formatBytes(progress.scannedBytes);
  currentPath.textContent = progress.currentPath;
};

const renderCompletion = (completion: ScanCompleteEvent): void => {
  if (completion.sessionId !== activeSessionId) {
    return;
  }

  progressBar.style.width = '100%';
  progressLabel.textContent = 'Completed';
  pathsValue.textContent = String(completion.processedPaths);
  filesValue.textContent = String(completion.discoveredFiles);
  bytesValue.textContent = formatBytes(completion.scannedBytes);
  currentPath.textContent = `Mock scan finished at ${completion.completedAt}`;
  startScanButton.disabled = false;
};

window.filePilot.onScanProgress(renderProgress);
window.filePilot.onScanComplete(renderCompletion);

void (async () => {
  const electronVersion = await window.filePilot.getVersion();
  version.textContent = `Secure Electron preload bridge connected · Electron ${electronVersion}`;
})();

selectFolderButton.addEventListener('click', async () => {
  const result = await window.filePilot.selectFolder();
  selectedFolderPath = result.folderPath;
  folderPath.textContent = result.folderPath ?? 'No folder selected.';
  startScanButton.disabled = result.folderPath === null;
  progressLabel.textContent = result.canceled ? 'Selection cancelled' : 'Ready';
});

startScanButton.addEventListener('click', async () => {
  if (!selectedFolderPath) {
    return;
  }

  startScanButton.disabled = true;
  progressBar.style.width = '0%';
  progressLabel.textContent = 'Starting…';
  currentPath.textContent = selectedFolderPath;
  pathsValue.textContent = '0';
  filesValue.textContent = '0';
  bytesValue.textContent = '0 B';

  const session = await window.filePilot.startMockScan({ rootPath: selectedFolderPath });
  activeSessionId = session.sessionId;
});
