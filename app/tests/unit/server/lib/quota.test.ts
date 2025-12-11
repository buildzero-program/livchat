import { describe, it, expect, beforeEach, mock } from "bun:test";

// ═══════════════════════════════════════════════════════════════════════════
// Mock Redis before importing quota
// ═══════════════════════════════════════════════════════════════════════════

const mockIncr = mock(() => Promise.resolve(1));
const mockGet = mock(() => Promise.resolve(null as number | null));
const mockExpireat = mock(() => Promise.resolve(1));

// Mock the redis module
mock.module("~/server/lib/redis", () => ({
  redis: {
    incr: mockIncr,
    get: mockGet,
    expireat: mockExpireat,
  },
  isRedisAvailable: () => true,
  getRedis: () => ({
    incr: mockIncr,
    get: mockGet,
    expireat: mockExpireat,
  }),
}));

// Import after mocking
import { useQuota, getQuotaUsage } from "~/server/lib/quota";

// ═══════════════════════════════════════════════════════════════════════════
// Quota System Tests (INCR-first approach)
// ═══════════════════════════════════════════════════════════════════════════

describe("Quota System", () => {
  beforeEach(() => {
    mockIncr.mockClear();
    mockGet.mockClear();
    mockExpireat.mockClear();
  });

  describe("useQuota (INCR-first)", () => {
    it("should allow first message (count=1, limit=50)", async () => {
      mockIncr.mockResolvedValueOnce(1);

      const result = await useQuota("instance-123", 50);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(49);
    });

    it("should allow message at limit (count=50, limit=50)", async () => {
      mockIncr.mockResolvedValueOnce(50);

      const result = await useQuota("instance-123", 50);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(50);
      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(0);
    });

    it("should block message over limit (count=51, limit=50)", async () => {
      mockIncr.mockResolvedValueOnce(51);

      const result = await useQuota("instance-123", 50);

      expect(result.allowed).toBe(false);
      expect(result.used).toBe(51);
      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(0);
    });

    it("should set TTL on first message of the day", async () => {
      mockIncr.mockResolvedValueOnce(1);

      await useQuota("instance-123", 50);

      expect(mockExpireat).toHaveBeenCalled();
    });

    it("should NOT set TTL on subsequent messages", async () => {
      mockIncr.mockResolvedValueOnce(10); // Not first message

      await useQuota("instance-123", 50);

      expect(mockExpireat).not.toHaveBeenCalled();
    });

    it("should handle large limits (PRO plan)", async () => {
      mockIncr.mockResolvedValueOnce(2500);

      const result = await useQuota("instance-123", 5000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2500);
    });

    it("should handle unlimited (-1 treated as very high)", async () => {
      mockIncr.mockResolvedValueOnce(999999);

      // With limit of -1, we need special handling
      // For now, treat as a very high limit
      const result = await useQuota("instance-123", Number.MAX_SAFE_INTEGER);

      expect(result.allowed).toBe(true);
    });
  });

  describe("getQuotaUsage", () => {
    it("should return 0 when no usage", async () => {
      mockGet.mockResolvedValueOnce(null);

      const usage = await getQuotaUsage("instance-123");

      expect(usage).toBe(0);
    });

    it("should return current count", async () => {
      mockGet.mockResolvedValueOnce(25);

      const usage = await getQuotaUsage("instance-123");

      expect(usage).toBe(25);
    });

    it("should return count at limit", async () => {
      mockGet.mockResolvedValueOnce(50);

      const usage = await getQuotaUsage("instance-123");

      expect(usage).toBe(50);
    });
  });

  describe("Edge cases", () => {
    it("should handle concurrent requests (simulated)", async () => {
      // Simulate two concurrent INCR calls
      mockIncr.mockResolvedValueOnce(49);
      mockIncr.mockResolvedValueOnce(50);

      const [result1, result2] = await Promise.all([
        useQuota("instance-123", 50),
        useQuota("instance-123", 50),
      ]);

      // Both should be allowed (Redis INCR is atomic)
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it("should handle race at limit", async () => {
      mockIncr.mockResolvedValueOnce(50);
      mockIncr.mockResolvedValueOnce(51);

      const [result1, result2] = await Promise.all([
        useQuota("instance-123", 50),
        useQuota("instance-123", 50),
      ]);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(false);
    });
  });
});
