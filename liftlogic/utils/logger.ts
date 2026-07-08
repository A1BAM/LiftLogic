const isProduction =
  (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') ||
  // @ts-expect-error import.meta.env might not be defined in all environments
  (typeof import.meta !== 'undefined' && import.meta.env?.PROD);

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    if (!isProduction) console.log(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    if (!isProduction) console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    if (!isProduction) console.error(`[ERROR] ${message}`, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    if (!isProduction) console.debug(`[DEBUG] ${message}`, ...args);
  },
};
