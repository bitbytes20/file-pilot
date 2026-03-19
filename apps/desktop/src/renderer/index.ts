import type { ScanCompleteEvent, ScanFileDto, ScanJobDto, ScanProgressEvent } from '@filepilot/shared-contracts';

export const formatBytes = (value: number): string => {
  if (value === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

export const buildFileRowsMarkup = (entries: readonly ScanFileDto[]): string =>
  entries.length === 0
    ? '<tr><td colspan="3" style="padding: 12px; color: #8b96a9;">No files persisted for this scan yet.</td></tr>'
    : entries
        .map(
          (file) => `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #1d2430; vertical-align: top;">
                <div style="font-weight: 600; color: #e6edfa;">${file.fileName}</div>
                <div style="color: #8b96a9; word-break: break-all; margin-top: 4px;">${file.absolutePath}</div>
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #1d2430; text-transform: capitalize;">${file.category}</td>
              <td style="padding: 10px; border-bottom: 1px solid #1d2430;">${formatBytes(file.sizeBytes)}</td>
            </tr>`
        )
        .join('');

const queryRequired = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
};

export const bootstrapRenderer = (): void => {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) {
    throw new Error('Renderer root element was not found.');
  }

  app.innerHTML = `
    <main style="max-width: 1180px; margin: 0 auto; padding: 40px 24px 64px;">
      <header style="margin-bottom: 24px;">
        <p style="margin: 0 0 8px; color: #8aa4ff; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">Tranche C shell</p>
        <h1 style="margin: 0; font-size: 40px;">FilePilot scan pipeline</h1>
        <p id="version" style="margin: 12px 0 0; color: #a8b0bf;"></p>
      </header>

      <section style="display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr); gap: 20px; align-items: start;">
        <div style="background: rgba(24, 30, 40, 0.92); border: 1px solid #2a3240; border-radius: 18px; padding: 24px; box-shadow: 0 18px 40px rgba(0,0,0,0.25);">
          <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 18px;">
            <button id="select-folder" style="appearance: none; border: 0; border-radius: 10px; background: #4b74ff; color: white; padding: 12px 16px; font-weight: 600; cursor: pointer;">Select folder</button>
            <button id="start-scan" style="appearance: none; border: 1px solid #3a4354; border-radius: 10px; background: #161b24; color: white; padding: 12px 16px; font-weight: 600; cursor: pointer;" disabled>Start scan</button>
            <button id="cancel-scan" style="appearance: none; border: 1px solid #735656; border-radius: 10px; background: #241616; color: white; padding: 12px 16px; font-weight: 600; cursor: pointer;" disabled>Cancel</button>
            <span id="folder-path" style="color: #cdd6e3; word-break: break-all;">No folder selected.</span>
          </div>

          <div style="margin-bottom: 18px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #a8b0bf;">
              <span>Status</span>
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

          <div style="padding: 16px; border-radius: 14px; background: #0f131a; border: 1px solid #222c3b; margin-bottom: 18px;">
            <p style="margin: 0 0 8px; color: #7e8aa0;">Current item</p>
            <p id="current-path" style="margin: 0; color: #dfe7f5; word-break: break-all;">Waiting for a scan.</p>
          </div>

          <div style="padding: 16px; border-radius: 14px; background: #0f131a; border: 1px solid #222c3b;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px;">
              <h2 style="margin: 0; font-size: 18px;">Files</h2>
              <span id="selected-job-status" style="color: #9eb6ff; font-size: 13px;">No scan selected</span>
            </div>
            <div style="max-height: 360px; overflow: auto; border: 1px solid #1d2430; border-radius: 12px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead style="position: sticky; top: 0; background: #111722;">
                  <tr>
                    <th style="text-align: left; padding: 10px; border-bottom: 1px solid #1d2430;">Name</th>
                    <th style="text-align: left; padding: 10px; border-bottom: 1px solid #1d2430;">Category</th>
                    <th style="text-align: left; padding: 10px; border-bottom: 1px solid #1d2430;">Size</th>
                  </tr>
                </thead>
                <tbody id="files-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>

        <aside style="background: rgba(24, 30, 40, 0.92); border: 1px solid #2a3240; border-radius: 18px; padding: 24px; box-shadow: 0 18px 40px rgba(0,0,0,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h2 style="margin: 0; font-size: 20px;">Recent scans</h2>
            <button id="refresh-jobs" style="appearance: none; border: 1px solid #3a4354; border-radius: 10px; background: transparent; color: white; padding: 8px 12px; font-weight: 600; cursor: pointer;">Refresh</button>
          </div>
          <div id="recent-jobs" style="display: grid; gap: 12px;"></div>
        </aside>
      </section>
    </main>
  `;

  const version = queryRequired<HTMLParagraphElement>('#version');
  const selectFolderButton = queryRequired<HTMLButtonElement>('#select-folder');
  const startScanButton = queryRequired<HTMLButtonElement>('#start-scan');
  const cancelScanButton = queryRequired<HTMLButtonElement>('#cancel-scan');
  const refreshJobsButton = queryRequired<HTMLButtonElement>('#refresh-jobs');
  const folderPath = queryRequired<HTMLSpanElement>('#folder-path');
  const progressBar = queryRequired<HTMLDivElement>('#progress-bar');
  const progressLabel = queryRequired<HTMLSpanElement>('#progress-label');
  const pathsValue = queryRequired<HTMLElement>('#paths-value');
  const filesValue = queryRequired<HTMLElement>('#files-value');
  const bytesValue = queryRequired<HTMLElement>('#bytes-value');
  const currentPath = queryRequired<HTMLParagraphElement>('#current-path');
  const recentJobs = queryRequired<HTMLDivElement>('#recent-jobs');
  const filesTableBody = queryRequired<HTMLTableSectionElement>('#files-table-body');
  const selectedJobStatus = queryRequired<HTMLSpanElement>('#selected-job-status');

  let selectedFolderPath: string | null = null;
  let activeJobId: string | null = null;
  let selectedJobId: string | null = null;

  const renderFiles = (entries: readonly ScanFileDto[]): void => {
    filesTableBody.innerHTML = buildFileRowsMarkup(entries);
  };

  const renderJobMetrics = (job: ScanJobDto): void => {
    progressBar.style.width = `${job.percentComplete}%`;
    progressLabel.textContent = `${job.status} · ${job.percentComplete}%`;
    pathsValue.textContent = String(job.processedPaths);
    filesValue.textContent = String(job.discoveredFiles);
    bytesValue.textContent = formatBytes(job.scannedBytes);
    currentPath.textContent = job.currentPath ?? 'Waiting for work.';
    selectedJobStatus.textContent = `${job.status.toUpperCase()} · ${new Date(job.startedAt).toLocaleString()}`;
  };

  const loadFilesForJob = async (jobId: string): Promise<void> => {
    const files = await window.filePilot.listFilesForJob({ jobId, limit: 250 });
    renderFiles(files);
  };

  const selectJob = async (jobId: string): Promise<void> => {
    selectedJobId = jobId;
    const job = await window.filePilot.getScanJob({ jobId });
    if (!job) {
      return;
    }

    renderJobMetrics(job);
    await loadFilesForJob(jobId);
  };

  const renderRecentJobs = async (): Promise<void> => {
    const jobs = await window.filePilot.listRecentScanJobs();
    recentJobs.innerHTML = jobs.length === 0
      ? '<p style="margin: 0; color: #8b96a9;">No scans have been recorded yet.</p>'
      : jobs
          .map(
            (job) => `
              <button data-job-id="${job.id}" style="text-align: left; width: 100%; appearance: none; border: 1px solid #273041; background: #101620; color: white; border-radius: 12px; padding: 14px; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px;">
                  <strong style="display: block; overflow: hidden; text-overflow: ellipsis;">${job.rootPath}</strong>
                  <span style="color: #9eb6ff; text-transform: capitalize;">${job.status}</span>
                </div>
                <div style="color: #8b96a9; font-size: 12px;">${job.discoveredFiles} files · ${formatBytes(job.scannedBytes)} · ${job.percentComplete}%</div>
              </button>`
          )
          .join('');

    for (const button of recentJobs.querySelectorAll<HTMLButtonElement>('button[data-job-id]')) {
      button.addEventListener('click', () => {
        const jobId = button.dataset.jobId;
        if (jobId) {
          void selectJob(jobId);
        }
      });
    }
  };

  const renderProgress = async (progress: ScanProgressEvent): Promise<void> => {
    if (progress.id !== activeJobId && progress.id !== selectedJobId) {
      return;
    }

    if (progress.id === activeJobId) {
      renderJobMetrics(progress);
    }

    if (progress.id === selectedJobId || selectedJobId === null) {
      selectedJobId = progress.id;
      renderJobMetrics(progress);
      await loadFilesForJob(progress.id);
    }

    await renderRecentJobs();
  };

  const renderCompletion = async (completion: ScanCompleteEvent): Promise<void> => {
    if (completion.jobId === activeJobId) {
      activeJobId = null;
      startScanButton.disabled = selectedFolderPath === null;
      cancelScanButton.disabled = true;
    }

    const job = await window.filePilot.getScanJob({ jobId: completion.jobId });
    if (job && (selectedJobId === completion.jobId || selectedJobId === null)) {
      renderJobMetrics(job);
      await loadFilesForJob(job.id);
    }

    progressLabel.textContent = completion.status === 'completed'
      ? 'completed · 100%'
      : completion.status === 'cancelled'
        ? 'cancelled'
        : `${completion.status}${completion.errorMessage ? ` · ${completion.errorMessage}` : ''}`;
    await renderRecentJobs();
  };

  window.filePilot.onScanProgress((event: ScanProgressEvent) => {
    void renderProgress(event);
  });
  window.filePilot.onScanComplete((event: ScanCompleteEvent) => {
    void renderCompletion(event);
  });

  void (async () => {
    const electronVersion = await window.filePilot.getVersion();
    version.textContent = `Secure Electron preload bridge connected · Electron ${electronVersion}`;
    await renderRecentJobs();
  })();

  selectFolderButton.addEventListener('click', async () => {
    const result = await window.filePilot.selectFolder();
    selectedFolderPath = result.folderPath;
    folderPath.textContent = result.folderPath ?? 'No folder selected.';
    startScanButton.disabled = result.folderPath === null || activeJobId !== null;
    progressLabel.textContent = result.canceled ? 'Selection cancelled' : 'Ready';
  });

  startScanButton.addEventListener('click', async () => {
    if (!selectedFolderPath) {
      return;
    }

    startScanButton.disabled = true;
    cancelScanButton.disabled = false;
    progressBar.style.width = '0%';
    progressLabel.textContent = 'starting';
    currentPath.textContent = selectedFolderPath;
    pathsValue.textContent = '0';
    filesValue.textContent = '0';
    bytesValue.textContent = '0 B';
    renderFiles([]);

    const job = await window.filePilot.startScan({ rootPath: selectedFolderPath });
    activeJobId = job.id;
    selectedJobId = job.id;
    renderJobMetrics(job);
    await renderRecentJobs();
  });

  cancelScanButton.addEventListener('click', async () => {
    if (!activeJobId) {
      return;
    }

    await window.filePilot.cancelScan({ jobId: activeJobId });
    cancelScanButton.disabled = true;
  });

  refreshJobsButton.addEventListener('click', () => {
    void renderRecentJobs();
  });
};

if (typeof document !== 'undefined' && typeof window !== 'undefined' && 'filePilot' in window) {
  bootstrapRenderer();
}
