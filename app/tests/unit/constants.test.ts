import { describe, it, expect } from "bun:test";
import { calculatePrice, PRICING } from "~/lib/constants";

// Note: formatPhone and maskPhone tests moved to tests/unit/lib/phone.test.ts

describe("calculatePrice", () => {
  it("should return 0 for 0 instances", () => {
    expect(calculatePrice(0)).toBe(0);
  });

  it("should return 0 for negative instances", () => {
    expect(calculatePrice(-1)).toBe(0);
  });

  it("should return minimum starter price for less than 5 instances", () => {
    expect(calculatePrice(1)).toBe(PRICING.STARTER_PRICE);
    expect(calculatePrice(3)).toBe(PRICING.STARTER_PRICE);
    expect(calculatePrice(4)).toBe(PRICING.STARTER_PRICE);
  });

  it("should return exact price for 5 instances", () => {
    expect(calculatePrice(5)).toBe(5 * PRICING.INSTANCE_PRICE);
  });

  it("should calculate price for more than 5 instances", () => {
    expect(calculatePrice(10)).toBe(10 * PRICING.INSTANCE_PRICE);
    expect(calculatePrice(20)).toBe(20 * PRICING.INSTANCE_PRICE);
  });
});
