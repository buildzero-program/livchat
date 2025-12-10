/**
 * Structured Logger Module
 *
 * Sends structured logs to Axiom with filterable fields.
 * Falls back to console.log in development if Axiom is not configured.
 *
 * Smart Logging Features:
 * 1. Log Levels (debug/info/warn/error)
 * 2. State Change Detection - only logs when state changes
 * 3. Sampling/Heartbeat - logs every N occurrences with count
 * 4. Silent Success - always logs errors, success is configurable
 */
import { Logger as AxiomLogger } from "next-axiom";

// ============================================================================
// Smart Logging: State & Sampling Tracking
// ============================================================================

interface SamplingState {
  count: number;
  lastLoggedAt: number;
  lastState: unknown;
}

// Global tracking for sampling and state changes (per action key)
const samplingTracker = new Map<string, SamplingState>();

const SAMPLING_INTERVAL = 10; // Log every N occurrences
const SAMPLING_TIME_MS = 30000; // Or log if 30s passed since last log

function getSamplingKey(action: string, contextId?: string): string {
  return contextId ? `${action}:${contextId}` : action;
}

function shouldLogSampled(key: string): { shouldLog: boolean; count: number; elapsed: number } {
  const now = Date.now();
  const state = samplingTracker.get(key) ?? { count: 0, lastLoggedAt: now, lastState: null };

  state.count++;

  const elapsed = now - state.lastLoggedAt;
  const shouldLog = state.count >= SAMPLING_INTERVAL || elapsed >= SAMPLING_TIME_MS;

  if (shouldLog) {
    const result = { shouldLog: true, count: state.count, elapsed };
    state.count = 0;
    state.lastLoggedAt = now;
    samplingTracker.set(key, state);
    return result;
  }

  samplingTracker.set(key, state);
  return { shouldLog: false, count: state.count, elapsed };
}

function checkStateChange(key: string, newState: unknown): { changed: boolean; previous: unknown } {
  const state = samplingTracker.get(key);
  const previous = state?.lastState;

  // Deep compare for objects, simple compare for primitives
  const stateStr = JSON.stringify(newState);
  const prevStr = JSON.stringify(previous);
  const changed = stateStr !== prevStr;

  if (changed && state) {
    state.lastState = newState;
    samplingTracker.set(key, state);
  } else if (changed) {
    samplingTracker.set(key, { count: 0, lastLoggedAt: Date.now(), lastState: newState });
  }

  return { changed, previous };
}

export interface LogContext {
  deviceId?: string;
  instanceId?: string;
  userId?: string;
  organizationId?: string;
}

export interface LogPayload extends LogContext {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  action: string;
  message: string;
  duration?: number;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  [key: string]: unknown;
}

// Axiom logger instance (singleton for server-side)
let axiomLogger: AxiomLogger | null = null;

function getAxiomLogger(): AxiomLogger {
  if (!axiomLogger) {
    axiomLogger = new AxiomLogger();
  }
  return axiomLogger;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms?: number): string {
  if (ms === undefined) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Emit a log payload to Axiom with structured fields.
 * Console output: pretty in dev (info+), JSON in prod/test.
 *
 * In dev: debug level is suppressed from console (still sent to Axiom)
 * This keeps the terminal clean during polling operations.
 */
function emit(payload: LogPayload): void {
  const { level, action, message, duration, timestamp, ...rest } = payload;

  // Dev: human-readable one-liner (info, warn, error only - NOT debug)
  // Prod/Test: JSON for Sentry + test compatibility
  const isDev = process.env.NODE_ENV === "development";
  if (isDev && level !== "debug") {
    const dur = duration ? ` (${formatDuration(duration)})` : "";
    const levelIcon = { debug: "🔍", info: "→", warn: "⚠", error: "✖" }[level];
    console.log(`${levelIcon} ${action} | ${message}${dur}`);
  }
  // Always output JSON in prod (for Sentry)
  if (!isDev) {
    console.log(JSON.stringify(payload));
  }

  // Send to Axiom with structured fields (filterable)
  // Skip in test environment to avoid fetch errors
  const isTest = process.env.NODE_ENV === "test" || !process.env.NODE_ENV;
  if (!isTest) {
    try {
      const axiom = getAxiomLogger();
      const fields = { action, duration, timestamp, ...rest };
      switch (level) {
        case "debug":
          axiom.debug(message, fields);
          break;
        case "info":
          axiom.info(message, fields);
          break;
        case "warn":
          axiom.warn(message, fields);
          break;
        case "error":
          axiom.error(message, fields);
          break;
      }
      axiom.flush().catch(() => {});
    } catch {
      // Axiom not configured
    }
  }
}

export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  withContext(ctx: LogContext): Logger {
    return new Logger({ ...this.context, ...ctx });
  }

  info(action: string, message: string, data?: Record<string, unknown>): void {
    this.log("info", action, message, undefined, data);
  }

  warn(action: string, message: string, data?: Record<string, unknown>): void {
    this.log("warn", action, message, undefined, data);
  }

  error(
    action: string,
    message: string,
    error?: Error | unknown,
    data?: Record<string, unknown>,
  ): void {
    this.log("error", action, message, error, data);
  }

  debug(action: string, message: string, data?: Record<string, unknown>): void {
    this.log("debug", action, message, undefined, data);
  }

  async time<T>(
    action: string,
    message: string,
    fn: () => Promise<T>,
    data?: Record<string, unknown>,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.log("info", action, message, undefined, { ...data, duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      // Show actual error message instead of success message
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log("error", action, `Failed: ${errorMsg}`, error, { ...data, duration });
      throw error;
    }
  }

  // ==========================================================================
  // Smart Logging Methods
  // ==========================================================================

  /**
   * Sampled timed operation - logs every N occurrences OR every X seconds.
   * Always logs errors. Shows count of operations since last log.
   *
   * Output: "→ wuzapi.status | Heartbeat OK (10 checks in 20s, avg 320ms)"
   */
  async timeSampled<T>(
    action: string,
    message: string,
    fn: () => Promise<T>,
    data?: Record<string, unknown>,
  ): Promise<T> {
    const key = getSamplingKey(action, this.context.instanceId ?? this.context.deviceId);
    const start = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - start;

      const { shouldLog, count, elapsed } = shouldLogSampled(key);
      if (shouldLog) {
        const elapsedSec = Math.round(elapsed / 1000);
        const avgDuration = Math.round(duration); // Could track avg, but using last for simplicity
        this.log("debug", action, `${message} (${count} checks in ${elapsedSec}s, ${avgDuration}ms)`, undefined, {
          ...data,
          duration,
          sampledCount: count,
          sampledElapsed: elapsed,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.log("error", action, message, error, { ...data, duration });
      throw error;
    }
  }

  /**
   * State-change timed operation - only logs when the extracted state changes.
   * Always logs errors. Use for polling where you only care about transitions.
   *
   * @param extractState - Function to extract comparable state from result
   *
   * Output: "→ wuzapi.status | State changed: connected false→true"
   */
  async timeStateChange<T>(
    action: string,
    message: string,
    fn: () => Promise<T>,
    extractState: (result: T) => unknown,
    data?: Record<string, unknown>,
  ): Promise<T> {
    const key = getSamplingKey(action, this.context.instanceId ?? this.context.deviceId);
    const start = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - start;
      const newState = extractState(result);

      const { changed, previous } = checkStateChange(key, newState);
      if (changed) {
        const prevStr = previous !== undefined ? JSON.stringify(previous) : "null";
        const newStr = JSON.stringify(newState);
        this.log("info", action, `${message}: ${prevStr}→${newStr}`, undefined, {
          ...data,
          duration,
          previousState: previous,
          newState,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.log("error", action, message, error, { ...data, duration });
      throw error;
    }
  }

  /**
   * Smart timed operation - combines sampling + state change detection.
   * - Logs immediately on state change (info level)
   * - Logs heartbeat every N checks or X seconds (debug level)
   * - Always logs errors (error level)
   *
   * Best for polling endpoints like status checks.
   *
   * @param extractState - Function to extract state to track for changes
   */
  async timeSmart<T>(
    action: string,
    message: string,
    fn: () => Promise<T>,
    extractState: (result: T) => unknown,
    data?: Record<string, unknown>,
  ): Promise<T> {
    const key = getSamplingKey(action, this.context.instanceId ?? this.context.deviceId);
    const start = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - start;
      const newState = extractState(result);

      // Check for state change first (higher priority)
      const { changed, previous } = checkStateChange(key, newState);
      if (changed) {
        const prevStr = previous !== undefined ? JSON.stringify(previous) : "initial";
        const newStr = JSON.stringify(newState);
        this.log("info", action, `State changed: ${prevStr}→${newStr}`, undefined, {
          ...data,
          duration,
          previousState: previous,
          newState,
          stateChange: true,
        });
        return result;
      }

      // Check sampling for heartbeat
      const { shouldLog, count, elapsed } = shouldLogSampled(key);
      if (shouldLog) {
        const elapsedSec = Math.round(elapsed / 1000);
        this.log("debug", action, `${message} (${count} checks in ${elapsedSec}s)`, undefined, {
          ...data,
          duration,
          sampledCount: count,
          heartbeat: true,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.log("error", action, message, error, { ...data, duration });
      throw error;
    }
  }

  private log(
    level: LogPayload["level"],
    action: string,
    message: string,
    error?: Error | unknown,
    data?: Record<string, unknown>,
  ): void {
    const payload: LogPayload = {
      timestamp: new Date().toISOString(),
      level,
      action,
      message,
      ...this.context,
      ...data,
    };

    if (error) {
      if (error instanceof Error) {
        payload.errorName = error.name;
        payload.errorMessage = error.message;
        payload.errorStack = error.stack;
      } else {
        payload.errorMessage = String(error);
      }
    }

    emit(payload);
  }
}

export const logger = new Logger();

/**
 * Standardized log action constants for type safety and autocomplete.
 */
export const LogActions = {
  // Device actions
  DEVICE_CREATE: "device.create",
  DEVICE_REUSE: "device.reuse",

  // Instance actions
  INSTANCE_CREATE: "instance.create",
  INSTANCE_RESOLVE: "instance.resolve",
  INSTANCE_SYNC: "instance.sync",

  // Orphan management
  ORPHAN_SEARCH: "orphan.search",
  ORPHAN_ADOPT: "orphan.adopt",
  ORPHAN_CLEANUP: "orphan.cleanup",
  ORPHAN_DELETE: "orphan.delete",

  // WuzAPI calls
  WUZAPI_STATUS: "wuzapi.status",
  WUZAPI_CONNECT: "wuzapi.connect",
  WUZAPI_SEND: "wuzapi.send",
  WUZAPI_LOGOUT: "wuzapi.logout",
  WUZAPI_PAIRING: "wuzapi.pairing",
  WUZAPI_CHECK: "wuzapi.check",

  // User management
  USER_SYNC: "user.sync",
  USER_CREATE: "user.create",
  USER_CLAIM: "user.claim",

  // WhatsApp endpoints
  WHATSAPP_VALIDATE: "whatsapp.validate",
  WHATSAPP_SEND: "whatsapp.send",
  WHATSAPP_STATUS: "whatsapp.status",
  WHATSAPP_PAIRING: "whatsapp.pairing",
  WHATSAPP_DISCONNECT: "whatsapp.disconnect",

  // Auth
  AUTH_SUCCESS: "auth.success",
  AUTH_ERROR: "auth.error",

  // tRPC
  TRPC_REQUEST: "trpc.request",
  TRPC_ERROR: "trpc.error",

  // API Keys
  API_KEY_CREATE: "api_key.create",
  API_KEY_USE: "api_key.use",
  API_KEY_REVOKE: "api_key.revoke",
  API_KEY_DELETE: "api_key.delete",
} as const;

export type LogAction = (typeof LogActions)[keyof typeof LogActions];
