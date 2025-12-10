import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// We'll test the getApiBaseUrl function
// Since it depends on window and process.env, we need to mock them

describe("getApiBaseUrl", () => {
  // Store original values
  const originalWindow = globalThis.window;
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    // Reset env
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    // Restore original values
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      // @ts-expect-error - cleaning up mock
      delete globalThis.window;
    }
  });

  describe("with NEXT_PUBLIC_API_URL set", () => {
    it("should return env var value when set", async () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.custom.com";

      // Re-import to get fresh module with new env
      const { getApiBaseUrl } = await import("~/lib/api-url");
      expect(getApiBaseUrl()).toBe("https://api.custom.com");
    });
  });

  describe("client-side detection", () => {
    it("should return localhost API for localhost hostname", async () => {
      // Mock window with localhost
      globalThis.window = {
        location: {
          hostname: "localhost",
          origin: "http://localhost:3000",
        },
      } as unknown as Window & typeof globalThis;

      const { getApiBaseUrl } = await import("~/lib/api-url");
      const result = getApiBaseUrl();
      expect(result).toBe("http://localhost:3000/api");
    });

    it("should return localhost API for 127.0.0.1 hostname", async () => {
      globalThis.window = {
        location: {
          hostname: "127.0.0.1",
          origin: "http://127.0.0.1:3000",
        },
      } as unknown as Window & typeof globalThis;

      const { getApiBaseUrl } = await import("~/lib/api-url");
      const result = getApiBaseUrl();
      expect(result).toBe("http://127.0.0.1:3000/api");
    });

    it("should return origin/api for vercel preview domains", async () => {
      globalThis.window = {
        location: {
          hostname: "livchat-abc123.vercel.app",
          origin: "https://livchat-abc123.vercel.app",
        },
      } as unknown as Window & typeof globalThis;

      const { getApiBaseUrl } = await import("~/lib/api-url");
      const result = getApiBaseUrl();
      expect(result).toBe("https://livchat-abc123.vercel.app/api");
    });

    it("should return production API for production hostname", async () => {
      globalThis.window = {
        location: {
          hostname: "livchat.ai",
          origin: "https://livchat.ai",
        },
      } as unknown as Window & typeof globalThis;

      const { getApiBaseUrl } = await import("~/lib/api-url");
      const result = getApiBaseUrl();
      expect(result).toBe("https://api.livchat.ai");
    });
  });

  describe("server-side fallback", () => {
    it("should return production API when window is undefined", async () => {
      // Remove window mock
      // @ts-expect-error - cleaning up mock
      delete globalThis.window;

      const { getApiBaseUrl } = await import("~/lib/api-url");
      const result = getApiBaseUrl();
      expect(result).toBe("https://api.livchat.ai");
    });
  });
});

describe("extractPhoneFromJid", () => {
  it("should extract phone number from JID", async () => {
    const { extractPhoneFromJid } = await import("~/lib/api-url");

    expect(extractPhoneFromJid("5585912345678@s.whatsapp.net")).toBe("5585912345678");
    expect(extractPhoneFromJid("5511999999999@s.whatsapp.net")).toBe("5511999999999");
  });

  it("should return empty string for undefined/null", async () => {
    const { extractPhoneFromJid } = await import("~/lib/api-url");

    expect(extractPhoneFromJid(undefined)).toBe("");
    expect(extractPhoneFromJid(null as unknown as string)).toBe("");
    expect(extractPhoneFromJid("")).toBe("");
  });

  it("should return original string if no @ found", async () => {
    const { extractPhoneFromJid } = await import("~/lib/api-url");

    expect(extractPhoneFromJid("5585912345678")).toBe("5585912345678");
  });
});
