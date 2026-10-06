/**
 * Centralized Logger Utility for KomikHQ Clipper
 *
 * Features:
 * - Structured event logging via ClipperLogEvent schema
 * - Scoped loggers for global components and per-site adapters
 * - In-memory ring buffer (configurable capacity, default 500 events)
 * - Persistent storage of WARN and ERROR events to browser.storage.local
 * - JSON and plain text export for diagnostic reporting
 * - Automatic debug-level filtering in production builds
 */

const IS_DEV = import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOGGER === 'true';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogScopeType = 'GLOBAL' | 'ADAPTER';

export interface ClipperLogEvent {
  id: string;
  timestamp: string;
  level: LogLevel;
  scopeType: LogScopeType;
  scopeName: string;
  adapterId?: string;
  eventName: string;
  message: string;
  payload?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// ---------------------------------------------------------------------------
// Ring Buffer
// ---------------------------------------------------------------------------

const RING_BUFFER_CAPACITY = 500;
const eventBuffer: ClipperLogEvent[] = [];

function pushEvent(event: ClipperLogEvent): void {
  if (eventBuffer.length >= RING_BUFFER_CAPACITY) {
    eventBuffer.shift();
  }
  eventBuffer.push(event);
}

// ---------------------------------------------------------------------------
// Persistence (WARN / ERROR only)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'komikhq_log_events';
const PERSISTED_MAX = 100;

async function persistEvent(event: ClipperLogEvent): Promise<void> {
  try {
    if (typeof browser === 'undefined' || !browser?.storage?.local) return;
    const result = await browser.storage.local.get(STORAGE_KEY) as Record<string, unknown>;
    const stored: ClipperLogEvent[] = (result[STORAGE_KEY] as ClipperLogEvent[] | undefined) || [];
    stored.push(event);
    if (stored.length > PERSISTED_MAX) {
      stored.splice(0, stored.length - PERSISTED_MAX);
    }
    await browser.storage.local.set({ [STORAGE_KEY]: stored });
  } catch {
    // Storage unavailable (e.g., content script context without permission).
  }
}

// ---------------------------------------------------------------------------
// ID Generator
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `${Date.now()}-${idCounter}`;
}

// ---------------------------------------------------------------------------
// Scope Helpers
// ---------------------------------------------------------------------------

function inferScopeType(scopeName: string): LogScopeType {
  if (scopeName.startsWith('Adapter:')) return 'ADAPTER';
  return 'GLOBAL';
}

function inferAdapterId(scopeName: string): string | undefined {
  if (scopeName.startsWith('Adapter:')) {
    return scopeName.replace('Adapter:', '').toLowerCase();
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Console Formatting
// ---------------------------------------------------------------------------

const LEVEL_CONSOLE_MAP: Record<LogLevel, (...args: any[]) => void> = {
  DEBUG: console.log,
  INFO: console.info,
  WARN: console.warn,
  ERROR: console.error,
};

function formatConsoleOutput(event: ClipperLogEvent): void {
  const fn = LEVEL_CONSOLE_MAP[event.level];
  const prefix = `[KomikHQ:${event.scopeName}]`;
  const tag = `[${event.level}]`;
  const parts: any[] = [prefix, tag, `[${event.eventName}]`, event.message];
  if (event.payload && Object.keys(event.payload).length > 0) {
    parts.push(event.payload);
  }
  if (event.error) {
    parts.push(event.error);
  }
  fn(...parts);
}

// ---------------------------------------------------------------------------
// Logger Interface
// ---------------------------------------------------------------------------

export interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  table: (data: any, properties?: string[]) => void;

  /**
   * Emit a structured log event with an explicit event name and optional
   * payload / error metadata. This is the preferred method for adapter
   * and pipeline instrumentation.
   */
  logEvent: (
    level: LogLevel,
    eventName: string,
    message: string,
    payload?: Record<string, unknown>,
    error?: Error | { name: string; message: string; stack?: string },
  ) => ClipperLogEvent;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a scoped logger for a specific context.
 *
 * Global scopes:   createLogger('Background'), createLogger('Content')
 * Adapter scopes:  createLogger('Adapter:Komiku')
 *
 * @param scope The component or entrypoint scope name
 */
export function createLogger(scope: string): Logger {
  const scopeType = inferScopeType(scope);
  const adapterId = inferAdapterId(scope);

  function buildEvent(
    level: LogLevel,
    eventName: string,
    message: string,
    payload?: Record<string, unknown>,
    rawError?: Error | { name: string; message: string; stack?: string },
  ): ClipperLogEvent {
    const event: ClipperLogEvent = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      level,
      scopeType,
      scopeName: scope,
      adapterId,
      eventName,
      message,
    };
    if (payload && Object.keys(payload).length > 0) {
      event.payload = payload;
    }
    if (rawError) {
      event.error = {
        name: rawError.name ?? 'Error',
        message: rawError.message ?? String(rawError),
        stack: rawError.stack,
      };
    }
    return event;
  }

  function dispatchEvent(event: ClipperLogEvent): void {
    pushEvent(event);
    formatConsoleOutput(event);
    if (event.level === 'WARN' || event.level === 'ERROR') {
      persistEvent(event);
    }
  }

  // Legacy-compatible helpers that auto-generate an event name from the level.
  function legacyLog(level: LogLevel, args: any[]): void {
    const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    const event = buildEvent(level, `${level}_LOG`, message);
    // Attach first object-type argument as payload for richer diagnostics.
    const objArg = args.find((a) => typeof a === 'object' && a !== null && !(a instanceof Error));
    if (objArg) event.payload = objArg;
    const errArg = args.find((a) => a instanceof Error);
    if (errArg) {
      event.error = { name: errArg.name, message: errArg.message, stack: errArg.stack };
    }
    dispatchEvent(event);
  }

  return {
    debug: (...args: any[]) => {
      if (!IS_DEV) return;
      legacyLog('DEBUG', args);
    },
    info: (...args: any[]) => {
      legacyLog('INFO', args);
    },
    warn: (...args: any[]) => {
      legacyLog('WARN', args);
    },
    error: (...args: any[]) => {
      legacyLog('ERROR', args);
    },
    table: (data: any, properties?: string[]) => {
      if (IS_DEV) {
        const prefix = `[KomikHQ:${scope}]`;
        console.log(prefix);
        console.table(data, properties);
      }
    },

    logEvent(
      level: LogLevel,
      eventName: string,
      message: string,
      payload?: Record<string, unknown>,
      rawError?: Error | { name: string; message: string; stack?: string },
    ): ClipperLogEvent {
      if (level === 'DEBUG' && !IS_DEV) {
        return buildEvent(level, eventName, message, payload, rawError);
      }
      const event = buildEvent(level, eventName, message, payload, rawError);
      dispatchEvent(event);
      return event;
    },
  };
}

// ---------------------------------------------------------------------------
// Buffer Query API
// ---------------------------------------------------------------------------

/** Return a shallow copy of all buffered events. */
export function getEventBuffer(): ClipperLogEvent[] {
  return [...eventBuffer];
}

/** Return buffered events filtered by level. */
export function getEventsByLevel(level: LogLevel): ClipperLogEvent[] {
  return eventBuffer.filter((e) => e.level === level);
}

/** Return buffered events filtered by scope type. */
export function getEventsByScope(scopeType: LogScopeType): ClipperLogEvent[] {
  return eventBuffer.filter((e) => e.scopeType === scopeType);
}

/** Return buffered events filtered by adapter ID. */
export function getEventsByAdapter(adapterId: string): ClipperLogEvent[] {
  return eventBuffer.filter((e) => e.adapterId === adapterId);
}

/** Clear all events from the in-memory ring buffer. */
export function clearEventBuffer(): void {
  eventBuffer.length = 0;
}

// ---------------------------------------------------------------------------
// Export Utilities
// ---------------------------------------------------------------------------

/** Export the current buffer as a formatted JSON string. */
export function exportEventsAsJSON(): string {
  return JSON.stringify(eventBuffer, null, 2);
}

/** Export the current buffer as plain text log lines. */
export function exportEventsAsText(): string {
  return eventBuffer
    .map((e) => {
      const base = `[${e.timestamp}] [${e.level}] [${e.scopeName}] [${e.eventName}] ${e.message}`;
      const payloadStr = e.payload ? ` -- ${JSON.stringify(e.payload)}` : '';
      const errorStr = e.error ? ` !! ${e.error.name}: ${e.error.message}` : '';
      return `${base}${payloadStr}${errorStr}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Persisted Log Retrieval
// ---------------------------------------------------------------------------

/** Retrieve persisted WARN/ERROR events from browser.storage.local. */
export async function getPersistedEvents(): Promise<ClipperLogEvent[]> {
  try {
    if (typeof browser === 'undefined' || !browser?.storage?.local) return [];
    const result = await browser.storage.local.get(STORAGE_KEY) as Record<string, unknown>;
    return (result[STORAGE_KEY] as ClipperLogEvent[] | undefined) || [];
  } catch {
    return [];
  }
}

/** Clear persisted events from browser.storage.local. */
export async function clearPersistedEvents(): Promise<void> {
  try {
    if (typeof browser === 'undefined' || !browser?.storage?.local) return;
    await browser.storage.local.remove(STORAGE_KEY);
  } catch {
    // Silently ignore.
  }
}

export default createLogger;
