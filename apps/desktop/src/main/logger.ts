const format = (level: string, message: string) => `[FilePilot][${level}] ${message}`;

export const logger = {
  info: (message: string) => {
    console.info(format('INFO', message));
  },
  warn: (message: string) => {
    console.warn(format('WARN', message));
  },
  error: (message: string, error?: unknown) => {
    console.error(format('ERROR', message), error);
  },
};
