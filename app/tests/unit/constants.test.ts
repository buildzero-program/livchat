import { describe, it, expect } from "bun:test";
import {
  calculatePrice,
  formatPhone,
  maskPhone,
  PRICING,
} from "~/lib/constants";

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

describe("formatPhone", () => {
  it("should format 13-digit Brazilian phone (with 9)", () => {
    expect(formatPhone("5511999999999")).toBe("+55 11 99999-9999");
  });

  it("should format 12-digit Brazilian phone (without 9)", () => {
    expect(formatPhone("551199999999")).toBe("+55 11 9999-9999");
  });

  it("should return original for invalid length", () => {
    expect(formatPhone("123")).toBe("123");
    expect(formatPhone("")).toBe("");
  });

  it("should handle phone with special characters", () => {
    expect(formatPhone("+55 (11) 99999-9999")).toBe("+55 11 99999-9999");
  });
});

describe("maskPhone", () => {
  it("should mask Brazilian phone number", () => {
    expect(maskPhone("5511999999999")).toBe("+55 11 9****-****");
  });

  it("should mask 11-digit phone", () => {
    expect(maskPhone("11999999999")).toBe("+55 11 9****-****");
  });

  it("should return original for short numbers", () => {
    expect(maskPhone("123456")).toBe("123456");
  });
});
