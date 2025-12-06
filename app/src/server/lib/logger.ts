/**
 * Structured Logger Module
 *
 * Sends structured logs to Axiom with filterable fields.
 * Falls back to console.log in development if Axiom is not configured.
 */
import { Logger as AxiomLogger } from "next-axiom";

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
 * Emit a log payload to Axiom with structured fields.
 * Also outputs to console for local dev and Sentry capture.
 */
function emit(payload: LogPayload): void {
  const { level, message, ...fields } = payload;

  // Always output to console (JSON for Sentry + test compatibility)
  console.log(JSON.stringify(payload));

  // Send to Axiom with structured fields (filterable in production)
  try {
    const axiom = getAxiomLogger();
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
    // Flush immediately to send to Axiom (server-side requirement)
    axiom.flush().catch(() => {});
  } catch {
    // Axiom not configured, console.log already done above
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

  // Demo endpoints
  DEMO_VALIDATE: "demo.validate",
  DEMO_SEND: "demo.send",
  DEMO_STATUS: "demo.status",
  DEMO_PAIRING: "demo.pairing",
  DEMO_DISCONNECT: "demo.disconnect",

  // Auth
  AUTH_SUCCESS: "auth.success",
  AUTH_ERROR: "auth.error",

  // tRPC
  TRPC_REQUEST: "trpc.request",
  TRPC_ERROR: "trpc.error",
} as const;

export type LogAction = (typeof LogActions)[keyof typeof LogActions];
