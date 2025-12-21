import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getShareBaseUrl, buildShareUrl } from "../../../../src/lib/connect/share-url";

/**
 * Tests for share-url.ts
 *
 * Tests URL building for different environments: production, ngrok, localhost.
 */

describe("Share URL Builder", () => {
  // Store original env values
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NGROK_DOMAIN;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe("getShareBaseUrl", () => {
    it("should return NEXT_PUBLIC_APP_URL when set", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.livchat.ai";

      const result = getShareBaseUrl();

      expect(result).toBe("https://app.livchat.ai");
    });

    it("should remove trailing slash from NEXT_PUBLIC_APP_URL", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.livchat.ai/";

      const result = getShareBaseUrl();

      expect(result).toBe("https://app.livchat.ai");
    });

    it("should return ngrok URL when NGROK_DOMAIN is set (no app url)", () => {
      process.env.NGROK_DOMAIN = "abc123.ngrok.io";

      const result = getShareBaseUrl();

      expect(result).toBe("https://abc123.ngrok.io");
    });

    it("should prefer NEXT_PUBLIC_APP_URL over NGROK_DOMAIN", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://production.app";
      process.env.NGROK_DOMAIN = "dev.ngrok.io";

      const result = getShareBaseUrl();

      expect(result).toBe("https://production.app");
    });

    it("should return localhost when no env vars set", () => {
      // Both are already deleted in beforeEach

      const result = getShareBaseUrl();

      expect(result).toBe("http://localhost:3000");
    });

    it("should handle subdomain ngrok URLs", () => {
      process.env.NGROK_DOMAIN = "livchat-dev.ngrok-free.app";

      const result = getShareBaseUrl();

      expect(result).toBe("https://livchat-dev.ngrok-free.app");
    });
  });

  describe("buildShareUrl", () => {
    it("should build full URL with code (localhost)", () => {
      // No env vars = localhost

      const result = buildShareUrl("abc123xyz456test");

      expect(result).toBe("http://localhost:3000/connect/abc123xyz456test");
    });

    it("should build full URL with code (production)", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.livchat.ai";

      const result = buildShareUrl("mycode12345678ab");

      expect(result).toBe("https://app.livchat.ai/connect/mycode12345678ab");
    });

    it("should build full URL with code (ngrok)", () => {
      process.env.NGROK_DOMAIN = "test123.ngrok.io";

      const result = buildShareUrl("sharelink1234567");

      expect(result).toBe("https://test123.ngrok.io/connect/sharelink1234567");
    });

    it("should handle short codes", () => {
      const result = buildShareUrl("abc");

      expect(result).toBe("http://localhost:3000/connect/abc");
    });

    it("should handle codes with special characters", () => {
      // nanoid can produce codes with - and _ characters
      const result = buildShareUrl("a-b_c123456789ab");

      expect(result).toBe("http://localhost:3000/connect/a-b_c123456789ab");
    });
  });
});
