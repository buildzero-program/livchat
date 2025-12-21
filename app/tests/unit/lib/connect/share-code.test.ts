import { describe, it, expect, beforeEach, mock } from "bun:test";

/**
 * Tests for share-code.ts
 *
 * Mocks Redis to test share code generation, verification, and revocation.
 */

// Mock storage to simulate Redis
let mockStorage: Map<string, { value: string; expiresAt: number }>;

// Mock redis module
mock.module("~/server/lib/redis", () => ({
  isRedisAvailable: () => true,
  redis: {
    setex: async (key: string, seconds: number, value: string) => {
      mockStorage.set(key, {
        value,
        expiresAt: Date.now() + seconds * 1000,
      });
      return "OK";
    },
    get: async <T>(key: string): Promise<T | null> => {
      const item = mockStorage.get(key);
      if (!item) return null;
      if (Date.now() > item.expiresAt) {
        mockStorage.delete(key);
        return null;
      }
      return JSON.parse(item.value) as T;
    },
    del: async (key: string): Promise<number> => {
      if (mockStorage.has(key)) {
        mockStorage.delete(key);
        return 1;
      }
      return 0;
    },
  },
}));

// Import after mocking
import {
  generateShareCode,
  verifyShareCode,
  revokeShareCode,
  type ShareCodeData,
} from "../../../../src/lib/connect/share-code";

describe("Share Code Management", () => {
  beforeEach(() => {
    mockStorage = new Map();
  });

  describe("generateShareCode", () => {
    it("should generate a 16-character code", async () => {
      const result = await generateShareCode(
        "instance-123",
        "org-456",
        "user-789"
      );

      expect(result.code).toHaveLength(16);
      expect(typeof result.code).toBe("string");
    });

    it("should return expiration date ~24h in future", async () => {
      const before = Date.now();
      const result = await generateShareCode(
        "instance-123",
        "org-456",
        "user-789"
      );
      const after = Date.now();

      const expectedMin = before + 86400 * 1000 - 1000; // 24h - 1s tolerance
      const expectedMax = after + 86400 * 1000 + 1000; // 24h + 1s tolerance

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it("should store data in Redis with share: prefix", async () => {
      const result = await generateShareCode(
        "instance-123",
        "org-456",
        "user-789"
      );

      const stored = mockStorage.get(`share:${result.code}`);
      expect(stored).toBeDefined();

      const data = JSON.parse(stored!.value) as ShareCodeData;
      expect(data.instanceId).toBe("instance-123");
      expect(data.organizationId).toBe("org-456");
      expect(data.createdByUserId).toBe("user-789");
      expect(data.createdAt).toBeGreaterThan(0);
    });

    it("should generate unique codes", async () => {
      const codes = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const result = await generateShareCode(
          "instance-123",
          "org-456",
          "user-789"
        );
        codes.add(result.code);
      }

      // All 100 codes should be unique
      expect(codes.size).toBe(100);
    });
  });

  describe("verifyShareCode", () => {
    it("should return data for valid code", async () => {
      const { code } = await generateShareCode(
        "instance-abc",
        "org-def",
        "user-ghi"
      );

      const result = await verifyShareCode(code);

      expect(result).not.toBeNull();
      expect(result!.instanceId).toBe("instance-abc");
      expect(result!.organizationId).toBe("org-def");
      expect(result!.createdByUserId).toBe("user-ghi");
    });

    it("should return null for non-existent code", async () => {
      const result = await verifyShareCode("nonexistent12345");

      expect(result).toBeNull();
    });

    it("should return null for empty code", async () => {
      const result = await verifyShareCode("");

      expect(result).toBeNull();
    });

    it("should preserve createdAt timestamp", async () => {
      const before = Date.now();
      const { code } = await generateShareCode(
        "instance-123",
        "org-456",
        "user-789"
      );
      const after = Date.now();

      const result = await verifyShareCode(code);

      expect(result!.createdAt).toBeGreaterThanOrEqual(before);
      expect(result!.createdAt).toBeLessThanOrEqual(after);
    });
  });

  describe("revokeShareCode", () => {
    it("should return true when revoking existing code", async () => {
      const { code } = await generateShareCode(
        "instance-123",
        "org-456",
        "user-789"
      );

      const result = await revokeShareCode(code);

      expect(result).toBe(true);
    });

    it("should return false when revoking non-existent code", async () => {
      const result = await revokeShareCode("nonexistent12345");

      expect(result).toBe(false);
    });

    it("should make code unverifiable after revocation", async () => {
      const { code } = await generateShareCode(
        "instance-123",
        "org-456",
        "user-789"
      );

      // Verify it exists first
      const beforeRevoke = await verifyShareCode(code);
      expect(beforeRevoke).not.toBeNull();

      // Revoke
      await revokeShareCode(code);

      // Should now be null
      const afterRevoke = await verifyShareCode(code);
      expect(afterRevoke).toBeNull();
    });

    it("should return false on second revocation of same code", async () => {
      const { code } = await generateShareCode(
        "instance-123",
        "org-456",
        "user-789"
      );

      const first = await revokeShareCode(code);
      const second = await revokeShareCode(code);

      expect(first).toBe(true);
      expect(second).toBe(false);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle multiple codes for same instance", async () => {
      const code1 = await generateShareCode(
        "instance-123",
        "org-456",
        "user-789"
      );
      const code2 = await generateShareCode(
        "instance-123",
        "org-456",
        "user-789"
      );

      // Both should be valid
      const data1 = await verifyShareCode(code1.code);
      const data2 = await verifyShareCode(code2.code);

      expect(data1).not.toBeNull();
      expect(data2).not.toBeNull();
      expect(code1.code).not.toBe(code2.code);
    });

    it("should handle revoking one code without affecting others", async () => {
      const code1 = await generateShareCode(
        "instance-123",
        "org-456",
        "user-789"
      );
      const code2 = await generateShareCode(
        "instance-123",
        "org-456",
        "user-789"
      );

      // Revoke first code
      await revokeShareCode(code1.code);

      // Second code should still work
      const data2 = await verifyShareCode(code2.code);
      expect(data2).not.toBeNull();

      // First code should be gone
      const data1 = await verifyShareCode(code1.code);
      expect(data1).toBeNull();
    });
  });
});
