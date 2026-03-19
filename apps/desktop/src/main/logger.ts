import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { Logger as InfrastructureLogger, StructuredLogEntry } from '@filepilot/infrastructure';

const isDev = process.env.NODE_ENV === 'development';
const logDirectoryOverride = process.env.FILEPILOT_LOG_DIR;
const logFileName = 'filepilot.log';

const serialize = (entry: StructuredLogEntry): string =>
  JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry,
  });

const writeLogLine = async (line: string): Promise<void> => {
  const targetDir = logDirectoryOverride ?? path.join(app.getPath('userData'), 'logs');
  await fs.mkdir(targetDir, { recursive: true });
  await fs.appendFile(
    path.join(targetDir, logFileName),
    `${line}
`,
    'utf8'
  );
};

const emit = (
  level: StructuredLogEntry['level'],
  message: string,
  context?: Record<string, unknown>,
  domain = 'desktop'
): void => {
  const entry: StructuredLogEntry =
    context === undefined ? { level, domain, message } : { level, domain, message, context };
  const line = serialize(entry);

  if (isDev || process.env.FILEPILOT_STDOUT_LOGS === '1') {
    const consoleMethod =
      level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
    consoleMethod(`[FilePilot] ${line}`);
  }

  void writeLogLine(line).catch((error) => {
    console.error('[FilePilot] Failed to write log line.', error);
  });
};

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warning', message, context),
  error: (message: string, error?: unknown, context?: Record<string, unknown>) =>
    emit('error', message, {
      ...context,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    }),
};

export const infrastructureLogger: InfrastructureLogger = {
  debug: (entry) => emit('debug', entry.message, entry.context, entry.domain),
  info: (entry) => emit('info', entry.message, entry.context, entry.domain),
  warn: (entry) => emit('warning', entry.message, entry.context, entry.domain),
  error: (entry) => emit('error', entry.message, entry.context, entry.domain),
};
