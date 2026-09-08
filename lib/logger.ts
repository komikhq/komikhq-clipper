/**
 * Centralized Logger Utility for KomikHQ Clipper
 * Automatically enables debug logs during development (`pnpm dev`)
 * and strips/disables debug logs in production builds (`pnpm zip`).
 */

const IS_DEV = import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOGGER === 'true';

export interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  table: (data: any, properties?: string[]) => void;
}

/**
 * Creates a scoped logger for a specific context (e.g., Background, Content, Popup)
 * @param scope The component or entrypoint scope name
 */
export function createLogger(scope: string): Logger {
  const prefix = `[KomikHQ:${scope}]`;

  return {
    debug: (...args: any[]) => {
      if (IS_DEV) {
        console.log(prefix, ...args);
      }
    },
    info: (...args: any[]) => {
      if (IS_DEV) {
        console.info(prefix, ...args);
      }
    },
    warn: (...args: any[]) => {
      // Warnings are displayed in both dev and production
      console.warn(prefix, ...args);
    },
    error: (...args: any[]) => {
      // Errors are displayed in both dev and production
      console.error(prefix, ...args);
    },
    table: (data: any, properties?: string[]) => {
      if (IS_DEV) {
        console.log(prefix);
        console.table(data, properties);
      }
    },
  };
}

export default createLogger;
