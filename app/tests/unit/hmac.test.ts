import { describe, it, expect } from "bun:test";
import { createHmac } from "crypto";

// Helper function que vamos testar (será criada em src/server/lib/hmac.ts)
// Por enquanto, importamos diretamente para o teste funcionar
import { validateHmacSignature } from "../../src/server/lib/hmac";

describe("HMAC Signature Validation", () => {
  const TEST_SECRET = "022c4fba7ac7743f837f1c1279984e08dcd9da513ae2c18b";

  // Helper para gerar assinatura válida (simula o que WuzAPI faz)
  function generateValidSignature(payload: string, secret: string): string {
    return createHmac("sha256", secret).update(payload, "utf-8").digest("hex");
  }

  describe("validateHmacSignature", () => {
    it("should return true for valid signature", () => {
      const payload = JSON.stringify({
        userID: "test-user",
        type: "Message",
        event: { Info: {}, Message: {} },
      });
      const validSignature = generateValidSignature(payload, TEST_SECRET);

      const result = validateHmacSignature(payload, TEST_SECRET, validSignature);

      expect(result).toBe(true);
    });

    it("should return false for invalid signature", () => {
      const payload = JSON.stringify({ userID: "test-user" });
      const invalidSignature = "invalid_signature_here_1234567890abcdef";

      const result = validateHmacSignature(payload, TEST_SECRET, invalidSignature);

      expect(result).toBe(false);
    });

    it("should return false for tampered payload", () => {
      const originalPayload = JSON.stringify({ userID: "test-user" });
      const tamperedPayload = JSON.stringify({ userID: "attacker" });
      const signature = generateValidSignature(originalPayload, TEST_SECRET);

      const result = validateHmacSignature(tamperedPayload, TEST_SECRET, signature);

      expect(result).toBe(false);
    });

    it("should return false for null signature", () => {
      const payload = JSON.stringify({ userID: "test-user" });

      const result = validateHmacSignature(payload, TEST_SECRET, null);

      expect(result).toBe(false);
    });

    it("should return false for empty signature", () => {
      const payload = JSON.stringify({ userID: "test-user" });

      const result = validateHmacSignature(payload, TEST_SECRET, "");

      expect(result).toBe(false);
    });

    it("should return false for empty secret", () => {
      const payload = JSON.stringify({ userID: "test-user" });
      const signature = generateValidSignature(payload, TEST_SECRET);

      const result = validateHmacSignature(payload, "", signature);

      expect(result).toBe(false);
    });

    it("should return false for wrong secret", () => {
      const payload = JSON.stringify({ userID: "test-user" });
      const signature = generateValidSignature(payload, TEST_SECRET);
      const wrongSecret = "wrong_secret_key_here_1234567890";

      const result = validateHmacSignature(payload, wrongSecret, signature);

      expect(result).toBe(false);
    });

    it("should handle Buffer payload", () => {
      const payload = Buffer.from(JSON.stringify({ userID: "test-user" }));
      const signature = generateValidSignature(payload.toString(), TEST_SECRET);

      const result = validateHmacSignature(payload, TEST_SECRET, signature);

      expect(result).toBe(true);
    });

    it("should handle special characters in payload", () => {
      const payload = JSON.stringify({
        userID: "test-user",
        message: "Hello! 👋 Olá! こんにちは",
      });
      const signature = generateValidSignature(payload, TEST_SECRET);

      const result = validateHmacSignature(payload, TEST_SECRET, signature);

      expect(result).toBe(true);
    });

    it("should handle large payload", () => {
      const largeData = "x".repeat(100000);
      const payload = JSON.stringify({ userID: "test-user", data: largeData });
      const signature = generateValidSignature(payload, TEST_SECRET);

      const result = validateHmacSignature(payload, TEST_SECRET, signature);

      expect(result).toBe(true);
    });

    it("should be timing-safe (reject signature of different length)", () => {
      const payload = JSON.stringify({ userID: "test-user" });
      const shortSignature = "abc123"; // Too short

      const result = validateHmacSignature(payload, TEST_SECRET, shortSignature);

      expect(result).toBe(false);
    });
  });
});
