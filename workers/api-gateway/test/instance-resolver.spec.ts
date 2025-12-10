import { describe, it, expect } from "bun:test";
import { resolveInstanceByFrom, type AllowedInstance } from "../src/instance-resolver";

describe("resolveInstanceByFrom", () => {
  const mockInstances: AllowedInstance[] = [
    {
      id: "uuid-1",
      whatsappJid: "5585912345678@s.whatsapp.net",
      providerToken: "token1",
    },
    {
      id: "uuid-2",
      whatsappJid: "5511987654321@s.whatsapp.net",
      providerToken: "token2",
    },
    {
      id: "uuid-3",
      whatsappJid: null, // Instance without connected WhatsApp
      providerToken: "token3",
    },
  ];

  describe("resolve by phone number", () => {
    it("should resolve by exact phone number", () => {
      const result = resolveInstanceByFrom("5585912345678", mockInstances);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("uuid-1");
      expect(result?.providerToken).toBe("token1");
    });

    it("should resolve second instance by phone", () => {
      const result = resolveInstanceByFrom("5511987654321", mockInstances);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("uuid-2");
    });

    it("should handle phone with formatting characters", () => {
      // Phone with +, spaces, and dashes
      const result = resolveInstanceByFrom("+55 85 91234-5678", mockInstances);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("uuid-1");
    });

    it("should handle phone with parentheses and country code", () => {
      const result = resolveInstanceByFrom("+55 (85) 91234-5678", mockInstances);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("uuid-1");
    });
  });

  describe("resolve by instance ID", () => {
    it("should resolve by UUID instance ID", () => {
      const result = resolveInstanceByFrom("uuid-2", mockInstances);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("uuid-2");
      expect(result?.providerToken).toBe("token2");
    });

    it("should resolve instance without whatsappJid by ID", () => {
      const result = resolveInstanceByFrom("uuid-3", mockInstances);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("uuid-3");
      expect(result?.providerToken).toBe("token3");
    });
  });

  describe("not found cases", () => {
    it("should return null for unknown phone number", () => {
      const result = resolveInstanceByFrom("5500000000000", mockInstances);
      expect(result).toBeNull();
    });

    it("should return null for unknown instance ID", () => {
      const result = resolveInstanceByFrom("uuid-unknown", mockInstances);
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = resolveInstanceByFrom("", mockInstances);
      expect(result).toBeNull();
    });

    it("should return null for empty instances array", () => {
      const result = resolveInstanceByFrom("5585912345678", []);
      expect(result).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should prefer phone match over ID match if both could match", () => {
      // This tests the priority: phone > ID
      const instancesWithNumericId: AllowedInstance[] = [
        {
          id: "5585912345678", // ID that looks like a phone number
          whatsappJid: "5511111111111@s.whatsapp.net",
          providerToken: "token-a",
        },
        {
          id: "uuid-b",
          whatsappJid: "5585912345678@s.whatsapp.net", // Actual phone match
          providerToken: "token-b",
        },
      ];

      const result = resolveInstanceByFrom("5585912345678", instancesWithNumericId);
      // Should match by phone (uuid-b), not by ID (5585912345678)
      expect(result?.id).toBe("uuid-b");
    });

    it("should handle JID without @s.whatsapp.net", () => {
      const instancesWithOddJid: AllowedInstance[] = [
        {
          id: "uuid-1",
          whatsappJid: "5585912345678", // No @s.whatsapp.net suffix
          providerToken: "token1",
        },
      ];

      const result = resolveInstanceByFrom("5585912345678", instancesWithOddJid);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("uuid-1");
    });
  });
});
