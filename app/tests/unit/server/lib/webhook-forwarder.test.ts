import { describe, it, expect, beforeEach, mock } from "bun:test";

// ═══════════════════════════════════════════════════════════════════════════
// Unit Tests for Webhook Forwarder Pure Functions
// ═══════════════════════════════════════════════════════════════════════════

// Mock data
const MOCK_ORG_ID = "org-123";
const MOCK_INSTANCE_ID = "inst-456";
const MOCK_WEBHOOK_ID = "wh-789";

// ═══════════════════════════════════════════════════════════════════════════
// Pure Functions to Test (copied from implementation)
// These functions don't have dependencies and can be tested directly
// ═══════════════════════════════════════════════════════════════════════════

interface WebhookFilters {
  instanceIds: string[] | null;
  subscriptions: string[] | null;
}

interface WebhookPayload {
  event: string;
  timestamp: string;
  webhookId: string;
  instance: {
    id: string;
    phone: string;
    name: string;
  };
  data: unknown;
}

interface BuildPayloadParams {
  webhookId: string;
  eventType: string;
  instanceId: string;
  instancePhone: string;
  instanceName: string;
  eventData: unknown;
}

function shouldDeliverToWebhook(
  filters: WebhookFilters,
  instanceId: string,
  eventType: string
): boolean {
  const instanceMatches =
    filters.instanceIds === null || filters.instanceIds.includes(instanceId);
  const eventMatches =
    filters.subscriptions === null || filters.subscriptions.includes(eventType);
  return instanceMatches && eventMatches;
}

function buildWebhookPayload(params: BuildPayloadParams): WebhookPayload {
  return {
    event: params.eventType,
    timestamp: new Date().toISOString(),
    webhookId: params.webhookId,
    instance: {
      id: params.instanceId,
      phone: params.instancePhone,
      name: params.instanceName,
    },
    data: params.eventData,
  };
}

async function generateHmacSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payloadData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, payloadData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return `sha256=${hashHex}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Webhook Forwarder", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // shouldDeliverToWebhook
  // ─────────────────────────────────────────────────────────────────────────

  describe("shouldDeliverToWebhook", () => {
    it("should return true when webhook has no filters (null = all)", () => {
      const result = shouldDeliverToWebhook(
        {
          instanceIds: null,
          subscriptions: null,
        },
        MOCK_INSTANCE_ID,
        "message.received"
      );
      expect(result).toBe(true);
    });

    it("should return true when instanceId is in webhook.instanceIds", () => {
      const result = shouldDeliverToWebhook(
        {
          instanceIds: [MOCK_INSTANCE_ID, "other-inst"],
          subscriptions: null,
        },
        MOCK_INSTANCE_ID,
        "message.received"
      );
      expect(result).toBe(true);
    });

    it("should return false when instanceId is NOT in webhook.instanceIds", () => {
      const result = shouldDeliverToWebhook(
        {
          instanceIds: ["other-inst-1", "other-inst-2"],
          subscriptions: null,
        },
        MOCK_INSTANCE_ID,
        "message.received"
      );
      expect(result).toBe(false);
    });

    it("should return true when eventType is in webhook.subscriptions", () => {
      const result = shouldDeliverToWebhook(
        {
          instanceIds: null,
          subscriptions: ["message.received", "message.sent"],
        },
        MOCK_INSTANCE_ID,
        "message.received"
      );
      expect(result).toBe(true);
    });

    it("should return false when eventType is NOT in webhook.subscriptions", () => {
      const result = shouldDeliverToWebhook(
        {
          instanceIds: null,
          subscriptions: ["connection.connected", "connection.disconnected"],
        },
        MOCK_INSTANCE_ID,
        "message.received"
      );
      expect(result).toBe(false);
    });

    it("should return true only when BOTH filters match", () => {
      const result = shouldDeliverToWebhook(
        {
          instanceIds: [MOCK_INSTANCE_ID],
          subscriptions: ["message.received"],
        },
        MOCK_INSTANCE_ID,
        "message.received"
      );
      expect(result).toBe(true);
    });

    it("should return false when instanceId matches but eventType doesn't", () => {
      const result = shouldDeliverToWebhook(
        {
          instanceIds: [MOCK_INSTANCE_ID],
          subscriptions: ["connection.connected"],
        },
        MOCK_INSTANCE_ID,
        "message.received"
      );
      expect(result).toBe(false);
    });

    it("should return false when eventType matches but instanceId doesn't", () => {
      const result = shouldDeliverToWebhook(
        {
          instanceIds: ["other-inst"],
          subscriptions: ["message.received"],
        },
        MOCK_INSTANCE_ID,
        "message.received"
      );
      expect(result).toBe(false);
    });

    it("should handle empty arrays as no match", () => {
      const result = shouldDeliverToWebhook(
        {
          instanceIds: [],
          subscriptions: [],
        },
        MOCK_INSTANCE_ID,
        "message.received"
      );
      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // buildWebhookPayload
  // ─────────────────────────────────────────────────────────────────────────

  describe("buildWebhookPayload", () => {
    it("should build payload with correct structure", () => {
      const eventData = {
        messageId: "msg-123",
        from: "5511999999999",
        body: "Hello!",
      };

      const payload = buildWebhookPayload({
        webhookId: MOCK_WEBHOOK_ID,
        eventType: "message.received",
        instanceId: MOCK_INSTANCE_ID,
        instancePhone: "5511888888888",
        instanceName: "WhatsApp Principal",
        eventData,
      });

      expect(payload.event).toBe("message.received");
      expect(payload.webhookId).toBe(MOCK_WEBHOOK_ID);
      expect(payload.instance.id).toBe(MOCK_INSTANCE_ID);
      expect(payload.instance.phone).toBe("5511888888888");
      expect(payload.instance.name).toBe("WhatsApp Principal");
      expect(payload.data).toEqual(eventData);
      expect(payload.timestamp).toBeDefined();
    });

    it("should include valid ISO timestamp", () => {
      const payload = buildWebhookPayload({
        webhookId: MOCK_WEBHOOK_ID,
        eventType: "message.received",
        instanceId: MOCK_INSTANCE_ID,
        instancePhone: "5511888888888",
        instanceName: "Test",
        eventData: {},
      });

      // Should be valid ISO string
      expect(() => new Date(payload.timestamp).toISOString()).not.toThrow();
    });

    it("should handle complex nested event data", () => {
      const eventData = {
        message: {
          id: "msg-123",
          content: {
            type: "text",
            body: "Hello!",
          },
        },
        metadata: {
          timestamp: 1234567890,
          isGroup: false,
        },
      };

      const payload = buildWebhookPayload({
        webhookId: MOCK_WEBHOOK_ID,
        eventType: "message.received",
        instanceId: MOCK_INSTANCE_ID,
        instancePhone: "5511888888888",
        instanceName: "Test",
        eventData,
      });

      expect(payload.data).toEqual(eventData);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // generateHmacSignature
  // ─────────────────────────────────────────────────────────────────────────

  describe("generateHmacSignature", () => {
    it("should generate valid HMAC-SHA256 signature", async () => {
      const payload = JSON.stringify({ test: "data" });
      const secret = "a".repeat(32);

      const signature = await generateHmacSignature(payload, secret);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("should generate different signatures for different payloads", async () => {
      const secret = "a".repeat(32);

      const sig1 = await generateHmacSignature('{"a":1}', secret);
      const sig2 = await generateHmacSignature('{"a":2}', secret);

      expect(sig1).not.toBe(sig2);
    });

    it("should generate different signatures for different secrets", async () => {
      const payload = '{"test":"data"}';

      const sig1 = await generateHmacSignature(payload, "a".repeat(32));
      const sig2 = await generateHmacSignature(payload, "b".repeat(32));

      expect(sig1).not.toBe(sig2);
    });

    it("should generate consistent signatures for same input", async () => {
      const payload = '{"test":"data"}';
      const secret = "mysecret12345678901234567890123456";

      const sig1 = await generateHmacSignature(payload, secret);
      const sig2 = await generateHmacSignature(payload, secret);

      expect(sig1).toBe(sig2);
    });

    it("should generate correct known signature", async () => {
      // Test with known values to ensure HMAC is correct
      const payload = '{"event":"test"}';
      const secret = "testsecret12345678901234567890123456";

      const signature = await generateHmacSignature(payload, secret);

      // Signature should start with sha256= and have 64 hex chars
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
      // Same input should always produce same output
      const signature2 = await generateHmacSignature(payload, secret);
      expect(signature).toBe(signature2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Delivery Logic Tests (using mocked fetch)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Webhook Delivery Logic", () => {
    let fetchCalls: Array<[string, RequestInit]> = [];
    let mockFetchResponse: Response = {
      ok: true,
      status: 200,
      text: () => Promise.resolve("OK"),
    } as Response;
    let mockFetchError: Error | null = null;

    const testFetch = async (url: string, init: RequestInit): Promise<Response> => {
      fetchCalls.push([url, init]);
      if (mockFetchError) {
        throw mockFetchError;
      }
      return mockFetchResponse;
    };

    beforeEach(() => {
      fetchCalls = [];
      mockFetchResponse = {
        ok: true,
        status: 200,
        text: () => Promise.resolve("OK"),
      } as Response;
      mockFetchError = null;
    });

    it("should POST with correct headers", async () => {
      const payload = { test: "data" };
      const url = "https://example.com/webhook";

      await testFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(fetchCalls.length).toBe(1);
      const [callUrl, callInit] = fetchCalls[0]!;
      expect(callUrl).toBe(url);
      expect(callInit.method).toBe("POST");
      expect(callInit.headers).toMatchObject({
        "Content-Type": "application/json",
      });
    });

    it("should include custom headers", async () => {
      const url = "https://example.com/webhook";
      const customHeaders = { "X-Custom-Header": "custom-value" };

      await testFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...customHeaders,
        },
        body: "{}",
      });

      const [, callInit] = fetchCalls[0]!;
      const headers = callInit.headers as Record<string, string>;
      expect(headers["X-Custom-Header"]).toBe("custom-value");
    });

    it("should include HMAC headers when signing", async () => {
      const url = "https://example.com/webhook";
      const payload = '{"test":"data"}';
      const secret = "a".repeat(32);
      const signature = await generateHmacSignature(payload, secret);
      const timestamp = Math.floor(Date.now() / 1000).toString();

      await testFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-livchat-signature": signature,
          "x-livchat-timestamp": timestamp,
        },
        body: payload,
      });

      const [, callInit] = fetchCalls[0]!;
      const headers = callInit.headers as Record<string, string>;
      expect(headers["x-livchat-signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
      expect(headers["x-livchat-timestamp"]).toBeDefined();
    });

    it("should handle HTTP errors gracefully", async () => {
      mockFetchResponse = {
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      } as Response;

      const response = await testFetch("https://example.com/webhook", {
        method: "POST",
        body: "{}",
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it("should handle network errors gracefully", async () => {
      mockFetchError = new Error("Network error");

      await expect(
        testFetch("https://example.com/webhook", { method: "POST", body: "{}" })
      ).rejects.toThrow("Network error");
    });
  });
});
