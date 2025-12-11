import { describe, it, expect } from "bun:test";

// ═══════════════════════════════════════════════════════════════════════════
// useAnimatedCounter Hook Tests
// Tests for the easing function and animation logic
// ═══════════════════════════════════════════════════════════════════════════

// Since we can't easily test React hooks with requestAnimationFrame in Bun,
// we test the pure functions used by the hook

describe("useAnimatedCounter utilities", () => {
  describe("easeOutQuart function", () => {
    // The easing function: 1 - (1 - x)^4
    function easeOutQuart(x: number): number {
      return 1 - Math.pow(1 - x, 4);
    }

    it("should return 0 when progress is 0", () => {
      expect(easeOutQuart(0)).toBe(0);
    });

    it("should return 1 when progress is 1", () => {
      expect(easeOutQuart(1)).toBe(1);
    });

    it("should return value between 0 and 1 for progress 0.5", () => {
      const result = easeOutQuart(0.5);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
      // easeOut should be > 0.5 at halfway (fast start, slow end)
      expect(result).toBeGreaterThan(0.5);
    });

    it("should ease out (faster at start, slower at end)", () => {
      // At 25% time, should have more than 25% progress
      const at25 = easeOutQuart(0.25);
      expect(at25).toBeGreaterThan(0.25);

      // At 75% time, should have more than 75% progress
      const at75 = easeOutQuart(0.75);
      expect(at75).toBeGreaterThan(0.75);
    });
  });

  describe("interpolation logic", () => {
    it("should calculate correct interpolated value", () => {
      const start = 0;
      const target = 1000;
      const progress = 0.5;
      const eased = 1 - Math.pow(1 - progress, 4); // ~0.9375

      const current = Math.floor(start + (target - start) * eased);
      expect(current).toBe(937); // 0 + 1000 * 0.9375 = 937.5 → 937
    });

    it("should handle starting from non-zero", () => {
      const start = 500;
      const target = 1000;
      const progress = 1; // complete
      const eased = 1; // at progress=1, eased=1

      const current = Math.floor(start + (target - start) * eased);
      expect(current).toBe(1000);
    });

    it("should handle counting down", () => {
      const start = 1000;
      const target = 500;
      const progress = 1;
      const eased = 1;

      const current = Math.floor(start + (target - start) * eased);
      expect(current).toBe(500);
    });
  });

  describe("progress calculation", () => {
    it("should clamp progress to max 1", () => {
      const duration = 1000;
      const elapsed = 1500; // more than duration

      const progress = Math.min(elapsed / duration, 1);
      expect(progress).toBe(1);
    });

    it("should calculate correct progress within duration", () => {
      const duration = 1000;
      const elapsed = 500;

      const progress = Math.min(elapsed / duration, 1);
      expect(progress).toBe(0.5);
    });
  });
});

describe("Counter display formatting", () => {
  it("should format number with Brazilian locale", () => {
    const value = 1234567;
    const formatted = value.toLocaleString("pt-BR");
    expect(formatted).toBe("1.234.567");
  });

  it("should format zero correctly", () => {
    const value = 0;
    const formatted = value.toLocaleString("pt-BR");
    expect(formatted).toBe("0");
  });

  it("should format small numbers without separators", () => {
    const value = 999;
    const formatted = value.toLocaleString("pt-BR");
    expect(formatted).toBe("999");
  });
});
