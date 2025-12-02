import { describe, it, expect } from "bun:test";
import {
  MOCK_FEATURES,
  MOCK_PLANS,
  MOCK_TESTIMONIALS,
  MOCK_COMPANIES,
  MOCK_CODE_EXAMPLES,
  MOCK_TECH_BADGES,
  mockSendMessage,
  mockGetQrCode,
  mockCheckConnection,
} from "~/lib/mock-data";

describe("MOCK_FEATURES", () => {
  it("should have 8 features", () => {
    expect(MOCK_FEATURES).toHaveLength(8);
  });

  it("should have required properties on each feature", () => {
    MOCK_FEATURES.forEach((feature) => {
      expect(feature).toHaveProperty("icon");
      expect(feature).toHaveProperty("title");
      expect(feature).toHaveProperty("description");
      expect(typeof feature.title).toBe("string");
      expect(typeof feature.description).toBe("string");
    });
  });
});

describe("MOCK_PLANS", () => {
  it("should have 3 plans", () => {
    expect(MOCK_PLANS).toHaveLength(3);
  });

  it("should have one recommended plan", () => {
    const recommended = MOCK_PLANS.filter((p) => p.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0]?.name).toBe("Pro");
  });

  it("should have required properties on each plan", () => {
    MOCK_PLANS.forEach((plan) => {
      expect(plan).toHaveProperty("name");
      expect(plan).toHaveProperty("price");
      expect(plan).toHaveProperty("features");
      expect(plan).toHaveProperty("cta");
      expect(Array.isArray(plan.features)).toBe(true);
    });
  });
});

describe("MOCK_TESTIMONIALS", () => {
  it("should have 3 testimonials", () => {
    expect(MOCK_TESTIMONIALS).toHaveLength(3);
  });

  it("should have required properties", () => {
    MOCK_TESTIMONIALS.forEach((t) => {
      expect(t).toHaveProperty("name");
      expect(t).toHaveProperty("role");
      expect(t).toHaveProperty("company");
      expect(t).toHaveProperty("quote");
    });
  });
});

describe("MOCK_CODE_EXAMPLES", () => {
  it("should have node, python, and php examples", () => {
    expect(MOCK_CODE_EXAMPLES).toHaveProperty("node");
    expect(MOCK_CODE_EXAMPLES).toHaveProperty("python");
    expect(MOCK_CODE_EXAMPLES).toHaveProperty("php");
  });

  it("should have code property in each example", () => {
    Object.values(MOCK_CODE_EXAMPLES).forEach((example) => {
      expect(example).toHaveProperty("code");
      expect(typeof example.code).toBe("string");
      expect(example.code.length).toBeGreaterThan(0);
    });
  });
});

describe("mockSendMessage", () => {
  it("should return success response", async () => {
    const response = await mockSendMessage("5511999999999", "Hello");

    expect(response.success).toBe(true);
    expect(response.status).toBe("sent");
    expect(response.messageId).toMatch(/^msg_/);
    expect(response.timestamp).toBeDefined();
  });

  it("should return valid ISO timestamp", async () => {
    const response = await mockSendMessage("5511999999999", "Test");
    const date = new Date(response.timestamp);

    expect(date.toISOString()).toBe(response.timestamp);
  });

  it("should generate unique messageIds", async () => {
    const [r1, r2] = await Promise.all([
      mockSendMessage("5511999999999", "msg1"),
      mockSendMessage("5511999999999", "msg2"),
    ]);

    expect(r1.messageId).not.toBe(r2.messageId);
  });
});

describe("mockGetQrCode", () => {
  it("should return a string", async () => {
    const qr = await mockGetQrCode();
    expect(typeof qr).toBe("string");
  });
});

describe("mockCheckConnection", () => {
  it("should return connected status", async () => {
    const status = await mockCheckConnection();

    expect(status.connected).toBe(true);
    expect(status.phone).toBeDefined();
  });
});
