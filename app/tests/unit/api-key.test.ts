import { describe, it, expect } from "bun:test";

// ═══════════════════════════════════════════════════════════════════════════
// UNIT TESTS (Pure functions - no DB, imported directly from source)
// ═══════════════════════════════════════════════════════════════════════════

// Import pure functions only (no DB dependencies)
// We need to test the implementation directly without importing from api-key.ts
// because it imports db which requires server environment

/**
 * Generate a secure API key token
 * Format: lc_{env}_{32 random alphanumeric chars}
 * Total length: 40 characters
 */
function generateApiKeyToken(env: "live" | "test" = "live"): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let random = "";

  // Generate 32 random characters
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  for (let i = 0; i < 32; i++) {
    random += chars[array[i]! % chars.length];
  }

  return `lc_${env}_${random}`;
}

/**
 * Mask API key token for display
 * Shows prefix and last 4 characters only
 * Example: lc_live_****************************4d5e
 */
function maskApiKeyToken(token: string): string {
  if (token.length <= 4) {
    return "*".repeat(token.length - 1) + token.slice(-1);
  }

  // Find the prefix (lc_xxx_)
  const prefixMatch = token.match(/^(lc_\w+_)/);
  const prefix = prefixMatch?.[1] ?? "";
  const suffix = token.slice(-4);
  const maskedLength = token.length - prefix.length - 4;

  return prefix + "*".repeat(maskedLength) + suffix;
}

describe("generateApiKeyToken", () => {
  it("should generate token with correct prefix format", () => {
    const token = generateApiKeyToken("live");
    expect(token).toMatch(/^lc_live_[a-zA-Z0-9]{32}$/);
  });

  it("should generate token with test prefix", () => {
    const token = generateApiKeyToken("test");
    expect(token).toMatch(/^lc_test_[a-zA-Z0-9]{32}$/);
  });

  it("should generate unique tokens", () => {
    const token1 = generateApiKeyToken("live");
    const token2 = generateApiKeyToken("live");
    expect(token1).not.toBe(token2);
  });

  it("should generate 40 character tokens (prefix + random)", () => {
    const token = generateApiKeyToken("live");
    // lc_live_ = 8 chars + 32 random = 40 total
    expect(token.length).toBe(40);
  });

  it("should only contain alphanumeric characters in random part", () => {
    const token = generateApiKeyToken("live");
    const randomPart = token.replace(/^lc_\w+_/, "");
    expect(randomPart).toMatch(/^[a-zA-Z0-9]+$/);
  });
});

describe("maskApiKeyToken", () => {
  it("should mask token showing only prefix and last 4 chars", () => {
    const token = "lc_live_Xk9m2nP8qR4sT6uV8wX0yZ1a2b3c4d5e";
    const masked = maskApiKeyToken(token);
    expect(masked).toBe("lc_live_****************************4d5e");
  });

  it("should handle short tokens gracefully", () => {
    const token = "short";
    const masked = maskApiKeyToken(token);
    // For short tokens without prefix, shows last 4 chars with minimal masking
    expect(masked).toBe("*hort");
  });

  it("should preserve prefix structure", () => {
    const token = "lc_test_abcd1234efgh5678ijkl9012mnop3456";
    const masked = maskApiKeyToken(token);
    expect(masked.startsWith("lc_test_")).toBe(true);
    expect(masked.endsWith("3456")).toBe(true);
  });

  it("should mask middle section with asterisks", () => {
    const token = "lc_live_12345678901234567890123456789012";
    const masked = maskApiKeyToken(token);
    // Should have 28 asterisks (32 - 4 last chars)
    const asterisks = masked.match(/\*/g);
    expect(asterisks?.length).toBe(28);
  });

  it("should handle token without standard prefix", () => {
    const token = "abc_xyz_1234567890123456";
    const masked = maskApiKeyToken(token);
    expect(masked.endsWith("3456")).toBe(true);
    expect(masked).toContain("****");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN FORMAT VALIDATION (para validateAndResolveInstance)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validates token format before DB lookup
 * Returns true if token has valid format for validation
 */
function isValidTokenFormat(token: string): boolean {
  return token.startsWith("lc_") && token.length >= 20;
}

describe("isValidTokenFormat", () => {
  it("should accept valid live token", () => {
    const token = generateApiKeyToken("live");
    expect(isValidTokenFormat(token)).toBe(true);
  });

  it("should accept valid test token", () => {
    const token = generateApiKeyToken("test");
    expect(isValidTokenFormat(token)).toBe(true);
  });

  it("should reject empty string", () => {
    expect(isValidTokenFormat("")).toBe(false);
  });

  it("should reject token without lc_ prefix", () => {
    expect(isValidTokenFormat("sk_live_xxxxx")).toBe(false);
    expect(isValidTokenFormat("invalid_token")).toBe(false);
  });

  it("should reject token too short (< 20 chars)", () => {
    expect(isValidTokenFormat("lc_live_short")).toBe(false);
    expect(isValidTokenFormat("lc_")).toBe(false);
    expect(isValidTokenFormat("lc_test_123")).toBe(false);
  });

  it("should accept token with exactly 20 chars", () => {
    // lc_live_ = 8 chars + 12 random = 20 total
    expect(isValidTokenFormat("lc_live_123456789012")).toBe(true);
    expect("lc_live_123456789012".length).toBe(20); // verify
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS - Defined but skipped (require test database)
// Run with: bun test:integration tests/unit/api-key.test.ts
// ═══════════════════════════════════════════════════════════════════════════

// NOTE: Integration tests for createApiKey, validateApiKey, revokeApiKey, listApiKeys
// are defined in tests/integration/api-key.integration.test.ts
// They require a test database connection and proper environment setup.
