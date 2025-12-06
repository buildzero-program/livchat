import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { Logger, logger, LogActions, type LogPayload, type LogAction } from "~/server/lib/logger";

describe("Logger", () => {
  let consoleSpy: ReturnType<typeof spyOn>;
  let capturedLogs: string[];

  beforeEach(() => {
    capturedLogs = [];
    consoleSpy = spyOn(console, "log").mockImplementation((output: string) => {
      capturedLogs.push(output);
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  const getLastLog = (): LogPayload => {
    const lastLog = capturedLogs[capturedLogs.length - 1];
    if (!lastLog) throw new Error("No logs captured");
    return JSON.parse(lastLog) as LogPayload;
  };

  describe("logger.info", () => {
    it("should output valid JSON to console", () => {
      logger.info("test.action", "Test message");

      expect(capturedLogs.length).toBe(1);
      expect(() => JSON.parse(capturedLogs[0]!)).not.toThrow();
    });

    it("should include timestamp in ISO 8601 format", () => {
      logger.info("test.action", "Test message");

      const log = getLastLog();
      expect(log.timestamp).toBeDefined();
      expect(new Date(log.timestamp).toISOString()).toBe(log.timestamp);
    });

    it("should include level, action, and message", () => {
      logger.info("user.create", "User created successfully");

      const log = getLastLog();
      expect(log.level).toBe("info");
      expect(log.action).toBe("user.create");
      expect(log.message).toBe("User created successfully");
    });

    it("should include additional data fields", () => {
      logger.info("user.create", "User created", { userId: "123", email: "test@test.com" });

      const log = getLastLog();
      expect(log.userId).toBe("123");
      expect(log.email).toBe("test@test.com");
    });
  });

  describe("withContext", () => {
    it("should create child logger with merged context", () => {
      const childLogger = logger.withContext({ deviceId: "dev-123" });
      childLogger.info("test.action", "Test");

      const log = getLastLog();
      expect(log.deviceId).toBe("dev-123");
    });

    it("should merge multiple context levels", () => {
      const deviceLogger = logger.withContext({ deviceId: "dev-123" });
      const instanceLogger = deviceLogger.withContext({ instanceId: "inst-456" });
      instanceLogger.info("test.action", "Test");

      const log = getLastLog();
      expect(log.deviceId).toBe("dev-123");
      expect(log.instanceId).toBe("inst-456");
    });

    it("should override context with same key", () => {
      const firstLogger = logger.withContext({ deviceId: "dev-123" });
      const secondLogger = firstLogger.withContext({ deviceId: "dev-456" });
      secondLogger.info("test.action", "Test");

      const log = getLastLog();
      expect(log.deviceId).toBe("dev-456");
    });

    it("should not mutate parent logger context", () => {
      const parentLogger = new Logger({ deviceId: "parent" });
      const childLogger = parentLogger.withContext({ instanceId: "child" });

      parentLogger.info("parent.action", "Parent log");
      const parentLog = getLastLog();

      childLogger.info("child.action", "Child log");
      const childLog = getLastLog();

      expect(parentLog.instanceId).toBeUndefined();
      expect(childLog.deviceId).toBe("parent");
      expect(childLog.instanceId).toBe("child");
    });
  });

  describe("warn", () => {
    it("should log with warn level", () => {
      logger.warn("orphan.adopt", "Logout failed during adoption");

      const log = getLastLog();
      expect(log.level).toBe("warn");
      expect(log.action).toBe("orphan.adopt");
    });
  });

  describe("error", () => {
    it("should log with error level", () => {
      logger.error("instance.create", "Failed to create instance");

      const log = getLastLog();
      expect(log.level).toBe("error");
    });

    it("should include Error object fields", () => {
      const error = new Error("Database connection failed");
      logger.error("db.connect", "Connection error", error);

      const log = getLastLog();
      expect(log.errorName).toBe("Error");
      expect(log.errorMessage).toBe("Database connection failed");
      expect(log.errorStack).toBeDefined();
      expect(log.errorStack).toContain("Database connection failed");
    });

    it("should include custom error type name", () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }
      const error = new CustomError("Custom failure");
      logger.error("custom.error", "Custom error occurred", error);

      const log = getLastLog();
      expect(log.errorName).toBe("CustomError");
      expect(log.errorMessage).toBe("Custom failure");
    });

    it("should handle non-Error objects", () => {
      logger.error("unknown.error", "Unknown error", "string error");

      const log = getLastLog();
      expect(log.errorMessage).toBe("string error");
      expect(log.errorName).toBeUndefined();
    });

    it("should include additional data with error", () => {
      const error = new Error("Failed");
      logger.error("task.fail", "Task failed", error, { taskId: "task-123" });

      const log = getLastLog();
      expect(log.taskId).toBe("task-123");
      expect(log.errorMessage).toBe("Failed");
    });
  });

  describe("debug", () => {
    it("should log with debug level", () => {
      logger.debug("cache.hit", "Cache hit for key");

      const log = getLastLog();
      expect(log.level).toBe("debug");
      expect(log.action).toBe("cache.hit");
    });
  });

  describe("time", () => {
    it("should measure and include duration for successful operations", async () => {
      const result = await logger.time(
        "wuzapi.status",
        "Fetched status",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { status: "connected" };
        }
      );

      expect(result).toEqual({ status: "connected" });

      const log = getLastLog();
      expect(log.level).toBe("info");
      expect(log.action).toBe("wuzapi.status");
      expect(log.duration).toBeDefined();
      expect(log.duration).toBeGreaterThanOrEqual(50);
      expect(log.duration).toBeLessThan(200); // reasonable upper bound
    });

    it("should include duration even when operation fails", async () => {
      const failingFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        throw new Error("Operation failed");
      };

      await expect(
        logger.time("wuzapi.send", "Send message", failingFn)
      ).rejects.toThrow("Operation failed");

      const log = getLastLog();
      expect(log.level).toBe("error");
      expect(log.duration).toBeDefined();
      expect(log.duration).toBeGreaterThanOrEqual(30);
      expect(log.errorMessage).toBe("Operation failed");
    });

    it("should include additional data in timed logs", async () => {
      await logger.time(
        "wuzapi.send",
        "Sent message",
        async () => "sent",
        { instanceId: "inst-123", phone: "5511999999999" }
      );

      const log = getLastLog();
      expect(log.instanceId).toBe("inst-123");
      expect(log.phone).toBe("5511999999999");
      expect(log.duration).toBeDefined();
    });

    it("should preserve context in timed logs", async () => {
      const contextLogger = logger.withContext({ deviceId: "dev-123" });

      await contextLogger.time("wuzapi.connect", "Connected", async () => true);

      const log = getLastLog();
      expect(log.deviceId).toBe("dev-123");
      expect(log.duration).toBeDefined();
    });
  });

  describe("singleton export", () => {
    it("should export logger singleton with empty context", () => {
      logger.info("singleton.test", "Test singleton");

      const log = getLastLog();
      expect(log.deviceId).toBeUndefined();
      expect(log.userId).toBeUndefined();
    });
  });
});

describe("LogActions", () => {
  it("should define all device actions", () => {
    expect(LogActions.DEVICE_CREATE).toBe("device.create");
    expect(LogActions.DEVICE_REUSE).toBe("device.reuse");
  });

  it("should define all instance actions", () => {
    expect(LogActions.INSTANCE_CREATE).toBe("instance.create");
    expect(LogActions.INSTANCE_RESOLVE).toBe("instance.resolve");
  });

  it("should define all orphan actions", () => {
    expect(LogActions.ORPHAN_SEARCH).toBe("orphan.search");
    expect(LogActions.ORPHAN_ADOPT).toBe("orphan.adopt");
    expect(LogActions.ORPHAN_CLEANUP).toBe("orphan.cleanup");
    expect(LogActions.ORPHAN_DELETE).toBe("orphan.delete");
  });

  it("should define all wuzapi actions", () => {
    expect(LogActions.WUZAPI_STATUS).toBe("wuzapi.status");
    expect(LogActions.WUZAPI_CONNECT).toBe("wuzapi.connect");
    expect(LogActions.WUZAPI_SEND).toBe("wuzapi.send");
    expect(LogActions.WUZAPI_LOGOUT).toBe("wuzapi.logout");
    expect(LogActions.WUZAPI_PAIRING).toBe("wuzapi.pairing");
    expect(LogActions.WUZAPI_CHECK).toBe("wuzapi.check");
  });

  it("should define all user actions", () => {
    expect(LogActions.USER_SYNC).toBe("user.sync");
    expect(LogActions.USER_CREATE).toBe("user.create");
    expect(LogActions.USER_CLAIM).toBe("user.claim");
  });

  it("should define all demo actions", () => {
    expect(LogActions.DEMO_VALIDATE).toBe("demo.validate");
    expect(LogActions.DEMO_SEND).toBe("demo.send");
    expect(LogActions.DEMO_STATUS).toBe("demo.status");
    expect(LogActions.DEMO_PAIRING).toBe("demo.pairing");
    expect(LogActions.DEMO_DISCONNECT).toBe("demo.disconnect");
  });

  it("should define all auth actions", () => {
    expect(LogActions.AUTH_SUCCESS).toBe("auth.success");
    expect(LogActions.AUTH_ERROR).toBe("auth.error");
  });

  it("should define trpc actions", () => {
    expect(LogActions.TRPC_REQUEST).toBe("trpc.request");
    expect(LogActions.TRPC_ERROR).toBe("trpc.error");
  });

  it("should have unique values (no duplicates)", () => {
    const values = Object.values(LogActions);
    const uniqueValues = new Set(values);
    expect(values.length).toBe(uniqueValues.size);
  });

  it("should work with LogAction type", () => {
    const action: LogAction = LogActions.DEVICE_CREATE;
    expect(action).toBe("device.create");
  });
});
