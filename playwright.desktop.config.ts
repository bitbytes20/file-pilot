/* eslint-disable import/no-default-export, import/no-extraneous-dependencies */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/desktop/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 90_000,
  use: {
    trace: 'on-first-retry',
  },
  workers: 1,
});
