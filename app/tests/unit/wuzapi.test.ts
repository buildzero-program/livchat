import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { WuzAPIClient, type WuzAPIAvatarData } from "~/server/lib/wuzapi";

describe("WuzAPIClient.getAvatar", () => {
  let client: WuzAPIClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    client = new WuzAPIClient({
      baseUrl: "http://localhost:8080",
      token: "test-token",
    });
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should return url when avatar exists", async () => {
    const mockResponse: { code: number; success: boolean; data: WuzAPIAvatarData } = {
      code: 200,
      success: true,
      data: {
        url: "https://pps.whatsapp.net/v/t61.24694-24/abc123.jpg",
        id: "5511999999999",
      },
    };

    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)
    ) as unknown as typeof fetch;

    const result = await client.getAvatar("5511999999999@s.whatsapp.net");

    expect(result.success).toBe(true);
    expect(result.data.url).toBe("https://pps.whatsapp.net/v/t61.24694-24/abc123.jpg");
    expect(result.data.id).toBe("5511999999999");
  });

  it("should return empty url when user has no avatar", async () => {
    const mockResponse: { code: number; success: boolean; data: WuzAPIAvatarData } = {
      code: 200,
      success: true,
      data: {
        url: "",
        id: "5511999999999",
      },
    };

    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)
    ) as unknown as typeof fetch;

    const result = await client.getAvatar("5511999999999@s.whatsapp.net");

    expect(result.success).toBe(true);
    expect(result.data.url).toBe("");
  });

  it("should use POST method with JSON body", async () => {
    const mockResponse = {
      code: 200,
      success: true,
      data: { url: "https://example.com/avatar.jpg" },
    };

    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;
    global.fetch = mock((url: string, options?: RequestInit) => {
      capturedUrl = url;
      capturedOptions = options;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);
    }) as unknown as typeof fetch;

    await client.getAvatar("5511999999999@s.whatsapp.net");

    expect(capturedUrl).toBe("http://localhost:8080/user/avatar");
    expect(capturedOptions?.method).toBe("POST");
    expect(capturedOptions?.body).toBe(JSON.stringify({ Phone: "5511999999999", Preview: false }));
  });

  it("should strip JID suffix and device ID from phone", async () => {
    const mockResponse = {
      code: 200,
      success: true,
      data: { url: "https://example.com/avatar.jpg" },
    };

    let capturedBody = "";
    global.fetch = mock((_url: string, options?: RequestInit) => {
      capturedBody = options?.body as string;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);
    }) as unknown as typeof fetch;

    // Test with device ID (e.g., 558588644401:9@s.whatsapp.net)
    await client.getAvatar("558588644401:9@s.whatsapp.net");

    const parsed = JSON.parse(capturedBody) as { Phone: string };
    expect(parsed.Phone).toBe("558588644401");
  });

  it("should handle plain phone number without @s.whatsapp.net", async () => {
    const mockResponse = {
      code: 200,
      success: true,
      data: { url: "https://example.com/avatar.jpg" },
    };

    let capturedBody = "";
    global.fetch = mock((_url: string, options?: RequestInit) => {
      capturedBody = options?.body as string;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);
    }) as unknown as typeof fetch;

    await client.getAvatar("5511999999999");

    const parsed = JSON.parse(capturedBody) as { Phone: string };
    expect(parsed.Phone).toBe("5511999999999");
  });

  it("should throw error on API failure", async () => {
    global.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response)
    ) as unknown as typeof fetch;

    expect(client.getAvatar("5511999999999")).rejects.toThrow("WuzAPI error: 500 Internal Server Error");
  });
});
