/* eslint-disable import/no-extraneous-dependencies */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';

const require = createRequire(import.meta.url);
const electronBinary = require('electron');

const tempDirs: string[] = [];

const createTempDir = async (prefix: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

const writeFixtureTree = async (root: string, count = 3): Promise<void> => {
  await fs.mkdir(path.join(root, 'nested', 'deep'), { recursive: true });
  for (let index = 0; index < count; index += 1) {
    await fs.writeFile(
      path.join(root, 'nested', 'deep', `file-${index}.txt`),
      `payload-${index}`.repeat(200)
    );
  }
  await fs.writeFile(path.join(root, 'root.json'), JSON.stringify({ ok: true }));
};

const launchDesktop = async (options: {
  selectedFolder?: string;
  userDataDir: string;
}): Promise<{ app: ElectronApplication; page: Page }> => {
  const app = await electron.launch({
    executablePath: electronBinary,
    args: ['.'],
    cwd: path.resolve('apps/desktop'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FILEPILOT_USER_DATA_DIR: options.userDataDir,
      FILEPILOT_TEST_SELECTED_FOLDER: options.selectedFolder ?? '',
      FILEPILOT_STDOUT_LOGS: '1',
    },
  });
  const page = await app.firstWindow();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  return { app, page };
};

test.afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

test('launch smoke test', async () => {
  const userDataDir = await createTempDir('filepilot-e2e-userdata-');
  const { app, page } = await launchDesktop({ userDataDir });

  await expect(page.getByTestId('version')).toContainText(
    'Secure Electron preload bridge connected'
  );
  await expect(page.getByTestId('recent-jobs')).toContainText('No scans have been recorded yet.');

  await app.close();
});

test('select folder, run real scan, and inspect persisted results', async () => {
  const userDataDir = await createTempDir('filepilot-e2e-userdata-');
  const scanRoot = await createTempDir('filepilot-e2e-scan-');
  await writeFixtureTree(scanRoot, 5);

  const { app, page } = await launchDesktop({ userDataDir, selectedFolder: scanRoot });

  await page.getByTestId('select-folder').click();
  await expect(page.getByTestId('folder-path')).toContainText(scanRoot);
  await page.getByTestId('start-scan').click();

  await expect(page.getByTestId('progress-label')).toContainText(/completed/i, { timeout: 30_000 });
  await expect(page.getByTestId('files-value')).toContainText('6');
  await expect(page.getByTestId('files-table-body')).toContainText('root.json');
  await expect(page.getByTestId('scan-events')).toContainText('scan_completed');
  await expect(page.getByTestId('recent-jobs')).toContainText(scanRoot);

  await app.close();
});

test('can cancel a scan mid-run', async () => {
  const userDataDir = await createTempDir('filepilot-e2e-userdata-');
  const scanRoot = await createTempDir('filepilot-e2e-scan-');
  await writeFixtureTree(scanRoot, 80);

  const { app, page } = await launchDesktop({ userDataDir, selectedFolder: scanRoot });
  await page.getByTestId('select-folder').click();
  await page.getByTestId('start-scan').click();
  await expect(page.getByTestId('progress-label')).toContainText(/running|completed|cancelled/i, {
    timeout: 15_000,
  });
  await page.getByTestId('cancel-scan').click();

  await expect(page.getByTestId('status-banner')).toContainText(/Cancelled/i, { timeout: 30_000 });
  await expect(page.getByTestId('scan-events')).toContainText('scan_cancelled');

  await app.close();
});

test('shows failure state for inaccessible or missing root path', async () => {
  const userDataDir = await createTempDir('filepilot-e2e-userdata-');
  const missingRoot = path.join(
    await createTempDir('filepilot-e2e-missing-parent-'),
    'does-not-exist'
  );

  const { app, page } = await launchDesktop({ userDataDir, selectedFolder: missingRoot });
  await page.getByTestId('select-folder').click();
  await page.getByTestId('start-scan').click();

  await expect(page.getByTestId('status-banner')).toContainText(/Failed/i, { timeout: 30_000 });
  await expect(page.getByTestId('recent-jobs')).toContainText('failed');
  await expect(page.getByTestId('scan-events')).toContainText('scan_failed');

  await app.close();
});



test('runs duplicate analysis and shows duplicate groups for a completed scan', async () => {
  const userDataDir = await createTempDir('filepilot-e2e-userdata-');
  const scanRoot = await createTempDir('filepilot-e2e-scan-');
  await fs.mkdir(path.join(scanRoot, 'dupes'), { recursive: true });
  await fs.writeFile(path.join(scanRoot, 'dupes', 'copy-a.txt'), 'exact-duplicate');
  await fs.writeFile(path.join(scanRoot, 'dupes', 'copy-b.txt'), 'exact-duplicate');
  await fs.writeFile(path.join(scanRoot, 'unique.txt'), 'different-content');

  const { app, page } = await launchDesktop({ userDataDir, selectedFolder: scanRoot });
  await page.getByTestId('select-folder').click();
  await page.getByTestId('start-scan').click();
  await expect(page.getByTestId('progress-label')).toContainText(/completed/i, { timeout: 30_000 });

  await page.getByTestId('start-duplicate-analysis').click();
  await expect(page.getByTestId('duplicate-status-banner')).toContainText(/Completed/i, { timeout: 30_000 });
  await expect(page.getByTestId('duplicate-groups-count')).toContainText('1');
  await expect(page.getByTestId('duplicate-group-list')).toContainText('exact matches');
  await expect(page.getByTestId('duplicate-group-files')).toContainText('Keep candidate');

  await app.close();
});
test('recent scans persist across relaunch', async () => {
  const userDataDir = await createTempDir('filepilot-e2e-userdata-');
  const scanRoot = await createTempDir('filepilot-e2e-scan-');
  await writeFixtureTree(scanRoot, 4);

  const firstLaunch = await launchDesktop({ userDataDir, selectedFolder: scanRoot });
  await firstLaunch.page.getByTestId('select-folder').click();
  await firstLaunch.page.getByTestId('start-scan').click();
  await expect(firstLaunch.page.getByTestId('progress-label')).toContainText(/completed/i, {
    timeout: 30_000,
  });
  await firstLaunch.app.close();

  const secondLaunch = await launchDesktop({ userDataDir });
  await expect(secondLaunch.page.getByTestId('recent-jobs')).toContainText(scanRoot);
  await secondLaunch.page.getByTestId('refresh-jobs').click();
  await expect(secondLaunch.page.getByTestId('recent-jobs')).toContainText('completed');
  await secondLaunch.app.close();
});
