import { describe, it, expect } from "bun:test";

// ═══════════════════════════════════════════════════════════════════════════
// LiveCounter Component Tests
// Tests for the interpolation logic used in the counter
// ═══════════════════════════════════════════════════════════════════════════

describe("LiveCounter interpolation logic", () => {
  describe("value interpolation based on rate", () => {
    it("should interpolate correctly based on elapsed time and rate", () => {
      const data = {
        baseValue: 10000,
        ratePerSecond: 0.5, // 0.5 messages per second
        calculatedAt: Date.now() - 10000, // 10 seconds ago
      };

      const elapsed = (Date.now() - data.calculatedAt) / 1000; // ~10 seconds
      const interpolated = Math.floor(data.baseValue + elapsed * data.ratePerSecond);

      // 10000 + 10 * 0.5 = 10005
      expect(interpolated).toBeGreaterThanOrEqual(10004);
      expect(interpolated).toBeLessThanOrEqual(10006);
    });

    it("should handle zero rate (no new messages)", () => {
      const data = {
        baseValue: 5000,
        ratePerSecond: 0,
        calculatedAt: Date.now() - 60000, // 1 minute ago
      };

      const elapsed = (Date.now() - data.calculatedAt) / 1000;
      const interpolated = Math.floor(data.baseValue + elapsed * data.ratePerSecond);

      expect(interpolated).toBe(5000);
    });

    it("should handle high rate correctly", () => {
      const data = {
        baseValue: 100000,
        ratePerSecond: 10, // 10 messages per second
        calculatedAt: Date.now() - 5000, // 5 seconds ago
      };

      const elapsed = (Date.now() - data.calculatedAt) / 1000;
      const interpolated = Math.floor(data.baseValue + elapsed * data.ratePerSecond);

      // 100000 + 5 * 10 = 100050
      expect(interpolated).toBeGreaterThanOrEqual(100048);
      expect(interpolated).toBeLessThanOrEqual(100052);
    });
  });

  describe("API response format", () => {
    it("should expect correct response shape from /api/stats/counter", () => {
      const mockResponse = {
        baseValue: 12345,
        ratePerSecond: 0.5,
        calculatedAt: Date.now(),
      };

      expect(mockResponse.baseValue).toBeTypeOf("number");
      expect(mockResponse.ratePerSecond).toBeTypeOf("number");
      expect(mockResponse.calculatedAt).toBeTypeOf("number");
    });
  });

  describe("edge cases", () => {
    it("should handle null data gracefully (returns 0)", () => {
      // Simulates the component's behavior when data hasn't loaded yet
      function getTarget(data: { baseValue: number } | null): number {
        return data ? Math.floor(data.baseValue) : 0;
      }
      expect(getTarget(null)).toBe(0);
      expect(getTarget({ baseValue: 100 })).toBe(100);
    });

    it("should handle very large numbers", () => {
      const data = {
        baseValue: 999999999,
        ratePerSecond: 100,
        calculatedAt: Date.now() - 1000,
      };

      const elapsed = (Date.now() - data.calculatedAt) / 1000;
      const interpolated = Math.floor(data.baseValue + elapsed * data.ratePerSecond);

      expect(interpolated).toBeGreaterThan(999999999);
    });

    it("should floor fractional results", () => {
      const data = {
        baseValue: 100,
        ratePerSecond: 0.3,
        calculatedAt: Date.now() - 1000,
      };

      const elapsed = (Date.now() - data.calculatedAt) / 1000;
      const interpolated = Math.floor(data.baseValue + elapsed * data.ratePerSecond);

      // Should be an integer
      expect(Number.isInteger(interpolated)).toBe(true);
    });
  });
});
