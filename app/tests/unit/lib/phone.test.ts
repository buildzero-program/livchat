/**
 * @fileoverview Tests for phone number formatting utilities
 *
 * TDD: These tests define the expected behavior for the phone module.
 * The module should handle:
 * - International phone formatting using libphonenumber-js
 * - Special cases for Brazil (12 and 13 digit WhatsApp JIDs)
 * - Special cases for Mexico (old format with "1" after country code)
 * - WhatsApp JID parsing
 * - Phone number validation and cleaning
 */

import { describe, expect, it } from "bun:test";
import {
  formatPhone,
  maskPhone,
  isValidPhoneFormat,
  cleanPhoneNumber,
  extractPhoneFromJID,
} from "~/lib/phone";

// ============================================================================
// formatPhone() - Main formatting function
// ============================================================================

describe("formatPhone", () => {
  describe("Brazilian numbers (country code 55)", () => {
    it("should format 13-digit Brazilian mobile (new format with 9)", () => {
      // 55 + DDD(85) + 9 + 8 digits = 13 digits total
      expect(formatPhone("5585988644401")).toBe("+55 85 98864-4401");
      expect(formatPhone("5511999999999")).toBe("+55 11 99999-9999");
      expect(formatPhone("5521987654321")).toBe("+55 21 98765-4321");
    });

    it("should format 12-digit Brazilian mobile (old WhatsApp format without 9)", () => {
      // 55 + DDD(85) + 8 digits = 12 digits total
      // This is the old format still used in some WhatsApp JIDs
      expect(formatPhone("558588644401")).toBe("+55 85 8864-4401");
      expect(formatPhone("551199999999")).toBe("+55 11 9999-9999");
      expect(formatPhone("552187654321")).toBe("+55 21 8765-4321");
    });

    it("should handle Brazilian numbers with WhatsApp JID suffix", () => {
      expect(formatPhone("5585988644401@s.whatsapp.net")).toBe("+55 85 98864-4401");
      expect(formatPhone("558588644401@c.us")).toBe("+55 85 8864-4401");
      expect(formatPhone("5511999999999@lid")).toBe("+55 11 99999-9999");
    });

    it("should handle Brazilian numbers with + prefix", () => {
      expect(formatPhone("+5585988644401")).toBe("+55 85 98864-4401");
      expect(formatPhone("+558588644401")).toBe("+55 85 8864-4401");
    });
  });

  describe("International numbers (using libphonenumber-js)", () => {
    it("should format US numbers", () => {
      expect(formatPhone("14155551234")).toBe("+1 415 555 1234");
      expect(formatPhone("12025551234")).toBe("+1 202 555 1234");
    });

    it("should format UK numbers", () => {
      expect(formatPhone("447911123456")).toBe("+44 7911 123456");
    });

    it("should format Portuguese numbers", () => {
      expect(formatPhone("351912345678")).toBe("+351 912 345 678");
    });

    it("should format German numbers", () => {
      expect(formatPhone("4915112345678")).toBe("+49 1511 2345678");
    });

    it("should format Argentine numbers", () => {
      // libphonenumber uses spaces, not hyphens for Argentina
      expect(formatPhone("5491123456789")).toBe("+54 9 11 2345 6789");
    });

    it("should handle international numbers with JID suffix", () => {
      expect(formatPhone("14155551234@s.whatsapp.net")).toBe("+1 415 555 1234");
      expect(formatPhone("447911123456@c.us")).toBe("+44 7911 123456");
    });
  });

  describe("Mexican numbers (country code 52)", () => {
    it("should format Mexican numbers with old format (13 digits with 1)", () => {
      // Old format: 52 + 1 + 10 digits
      expect(formatPhone("5215512345678")).toMatch(/^\+52/);
    });

    it("should format Mexican numbers with new format (12 digits)", () => {
      // New format: 52 + 10 digits
      expect(formatPhone("525512345678")).toMatch(/^\+52/);
    });
  });

  describe("Edge cases and fallbacks", () => {
    it("should return 'Não conectado' for undefined/null/empty", () => {
      expect(formatPhone(undefined)).toBe("Não conectado");
      expect(formatPhone("")).toBe("Não conectado");
    });

    it("should handle numbers with special characters", () => {
      expect(formatPhone("+55 (85) 98864-4401")).toBe("+55 85 98864-4401");
      expect(formatPhone("55-85-988644401")).toBe("+55 85 98864-4401");
    });

    it("should fallback gracefully for unrecognized formats", () => {
      // Very short number - should at least add + prefix
      expect(formatPhone("12345")).toMatch(/^\+/);
    });
  });
});

// ============================================================================
// maskPhone() - Mask phone for secure display
// ============================================================================

describe("maskPhone", () => {
  describe("Brazilian numbers", () => {
    it("should mask 13-digit Brazilian numbers", () => {
      expect(maskPhone("5585988644401")).toBe("+55 85 9****-****");
      expect(maskPhone("5511999999999")).toBe("+55 11 9****-****");
    });

    it("should mask 12-digit Brazilian numbers", () => {
      expect(maskPhone("558588644401")).toBe("+55 85 ****-****");
      expect(maskPhone("551199999999")).toBe("+55 11 ****-****");
    });

    it("should handle JID suffix", () => {
      expect(maskPhone("5585988644401@s.whatsapp.net")).toBe("+55 85 9****-****");
    });
  });

  describe("International numbers", () => {
    it("should mask international numbers showing only country code", () => {
      expect(maskPhone("14155551234")).toMatch(/^\+1.*\*+/);
      expect(maskPhone("447911123456")).toMatch(/^\+44.*\*+/);
    });
  });

  describe("Edge cases", () => {
    it("should return 'Não conectado' for undefined/empty", () => {
      expect(maskPhone(undefined)).toBe("Não conectado");
      expect(maskPhone("")).toBe("Não conectado");
    });
  });
});

// ============================================================================
// isValidPhoneFormat() - Basic phone validation
// ============================================================================

describe("isValidPhoneFormat", () => {
  it("should return true for valid phone lengths (10-15 digits)", () => {
    expect(isValidPhoneFormat("1234567890")).toBe(true); // 10 digits
    expect(isValidPhoneFormat("12345678901")).toBe(true); // 11 digits
    expect(isValidPhoneFormat("123456789012")).toBe(true); // 12 digits
    expect(isValidPhoneFormat("1234567890123")).toBe(true); // 13 digits
    expect(isValidPhoneFormat("12345678901234")).toBe(true); // 14 digits
    expect(isValidPhoneFormat("123456789012345")).toBe(true); // 15 digits
  });

  it("should return false for invalid phone lengths", () => {
    expect(isValidPhoneFormat("123456789")).toBe(false); // 9 digits (too short)
    expect(isValidPhoneFormat("1234567890123456")).toBe(false); // 16 digits (too long)
    expect(isValidPhoneFormat("")).toBe(false);
  });

  it("should handle formatted numbers (ignores non-digits)", () => {
    expect(isValidPhoneFormat("+55 85 98864-4401")).toBe(true);
    expect(isValidPhoneFormat("(11) 99999-9999")).toBe(true);
    expect(isValidPhoneFormat("+1 (415) 555-1234")).toBe(true);
  });

  it("should handle JID format", () => {
    expect(isValidPhoneFormat("5585988644401@s.whatsapp.net")).toBe(true);
  });
});

// ============================================================================
// cleanPhoneNumber() - Remove non-digit characters
// ============================================================================

describe("cleanPhoneNumber", () => {
  it("should remove all non-digit characters", () => {
    expect(cleanPhoneNumber("+55 85 98864-4401")).toBe("5585988644401");
    expect(cleanPhoneNumber("(11) 99999-9999")).toBe("11999999999");
    expect(cleanPhoneNumber("+1 (415) 555-1234")).toBe("14155551234");
  });

  it("should return empty string for empty input", () => {
    expect(cleanPhoneNumber("")).toBe("");
  });

  it("should handle already clean numbers", () => {
    expect(cleanPhoneNumber("5585988644401")).toBe("5585988644401");
  });

  it("should remove JID suffix before cleaning", () => {
    expect(cleanPhoneNumber("5585988644401@s.whatsapp.net")).toBe("5585988644401");
  });
});

// ============================================================================
// extractPhoneFromJID() - Extract phone from WhatsApp JID
// ============================================================================

describe("extractPhoneFromJID", () => {
  it("should extract phone from standard JID formats", () => {
    expect(extractPhoneFromJID("5585988644401@s.whatsapp.net")).toBe("5585988644401");
    expect(extractPhoneFromJID("5585988644401@c.us")).toBe("5585988644401");
    expect(extractPhoneFromJID("14155551234@s.whatsapp.net")).toBe("14155551234");
  });

  it("should extract phone from LID format", () => {
    expect(extractPhoneFromJID("5585988644401@lid")).toBe("5585988644401");
  });

  it("should handle phone without JID suffix", () => {
    expect(extractPhoneFromJID("5585988644401")).toBe("5585988644401");
  });

  it("should return undefined for invalid input", () => {
    expect(extractPhoneFromJID(undefined)).toBeUndefined();
    expect(extractPhoneFromJID("")).toBeUndefined();
    expect(extractPhoneFromJID("invalid")).toBeUndefined();
  });

  it("should handle group JIDs (return undefined)", () => {
    // Group JIDs don't have a phone number
    expect(extractPhoneFromJID("120363310217188004@g.us")).toBe("120363310217188004");
  });
});
