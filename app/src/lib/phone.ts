/**
 * @fileoverview Centralized phone number utilities
 *
 * This module handles all phone number formatting, validation, and parsing.
 * It uses libphonenumber-js for international formatting with special handling
 * for Brazil and Mexico due to WhatsApp JID format inconsistencies.
 *
 * @see https://support.gupshup.io/hc/en-us/articles/4407840924953
 * @see https://en.wikipedia.org/wiki/Telephone_numbers_in_Brazil
 */

import { parsePhoneNumber } from "libphonenumber-js";

// ============================================================================
// Constants
// ============================================================================

const WHATSAPP_JID_REGEX = /@.*$/;
const DIGITS_ONLY_REGEX = /\D/g;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Remove WhatsApp JID suffix and non-digit characters
 */
function sanitizePhone(phone: string): string {
  return phone.replace(WHATSAPP_JID_REGEX, "").replace(DIGITS_ONLY_REGEX, "");
}

/**
 * Format Brazilian phone number
 *
 * Brazil has a special case: In 2010, ANATEL added a 9th digit to mobile numbers.
 * However, WhatsApp JIDs may still contain the old 8-digit format for numbers
 * registered before the transition (especially outside SP/RJ/ES regions).
 *
 * Formats:
 * - 13 digits (55 + DD + 9XXXXXXXX): New format → +55 DD XXXXX-XXXX
 * - 12 digits (55 + DD + XXXXXXXX): Old WhatsApp format → +55 DD XXXX-XXXX
 */
function formatBrazilianPhone(digits: string): string {
  // 13 digits: 55 + DDD(2) + 9XXXXXXXX (new format with 9)
  if (digits.length === 13) {
    const ddd = digits.slice(2, 4);
    const firstPart = digits.slice(4, 9); // 5 digits (includes the 9)
    const secondPart = digits.slice(9); // 4 digits
    return `+55 ${ddd} ${firstPart}-${secondPart}`;
  }

  // 12 digits: 55 + DDD(2) + XXXXXXXX (old format without 9)
  if (digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const firstPart = digits.slice(4, 8); // 4 digits
    const secondPart = digits.slice(8); // 4 digits
    return `+55 ${ddd} ${firstPart}-${secondPart}`;
  }

  // For other lengths, try libphonenumber
  try {
    const parsed = parsePhoneNumber(`+${digits}`);
    if (parsed) {
      return parsed.formatInternational();
    }
  } catch {
    // Fall through to basic format
  }

  return `+${digits}`;
}

/**
 * Format Mexican phone number
 *
 * Mexico had a similar issue: the "1" after country code was removed in 2019,
 * but WhatsApp may still have old JIDs with the "1".
 *
 * @see https://support.gupshup.io/hc/en-us/articles/4413210201625
 */
function formatMexicanPhone(digits: string): string {
  // Remove the "1" if present after country code (old format)
  // 521XXXXXXXXXX (13 digits) → 52XXXXXXXXXX (12 digits)
  let normalizedDigits = digits;
  if (digits.length === 13 && digits.startsWith("521")) {
    normalizedDigits = "52" + digits.slice(3);
  }

  // Try libphonenumber with normalized number
  try {
    const parsed = parsePhoneNumber(`+${normalizedDigits}`);
    if (parsed) {
      return parsed.formatInternational();
    }
  } catch {
    // Fall through to basic format
  }

  return `+${normalizedDigits}`;
}

/**
 * Format international phone number using libphonenumber-js
 */
function formatInternationalPhone(digits: string): string {
  try {
    const parsed = parsePhoneNumber(`+${digits}`);
    if (parsed) {
      return parsed.formatInternational();
    }
  } catch {
    // Fall through to basic format
  }

  return `+${digits}`;
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Format phone number for display (supports international numbers)
 *
 * Handles WhatsApp JID formats and special cases for Brazil and Mexico.
 * Uses libphonenumber-js for standard international formatting.
 *
 * @example
 * formatPhone("5585988644401")      // → "+55 85 98864-4401" (Brazil new)
 * formatPhone("558588644401")       // → "+55 85 8864-4401"  (Brazil old)
 * formatPhone("14155551234")        // → "+1 415 555 1234"   (USA)
 * formatPhone("447911123456")       // → "+44 7911 123456"   (UK)
 * formatPhone("5511999999999@s.whatsapp.net") // → "+55 11 99999-9999"
 */
export function formatPhone(phone: string | undefined): string {
  if (!phone) return "Não conectado";

  const digits = sanitizePhone(phone);

  if (!digits) return "Não conectado";

  // Special handling for Brazil (country code 55)
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return formatBrazilianPhone(digits);
  }

  // Special handling for Mexico (country code 52)
  if (digits.startsWith("52") && digits.length >= 12 && digits.length <= 13) {
    return formatMexicanPhone(digits);
  }

  // For all other countries, use libphonenumber-js
  return formatInternationalPhone(digits);
}

/**
 * Mask phone number for secure display
 *
 * Shows country code and area code, hides the rest with asterisks.
 *
 * @example
 * maskPhone("5585988644401") // → "+55 85 9****-****"
 * maskPhone("558588644401")  // → "+55 85 ****-****"
 * maskPhone("14155551234")   // → "+1 415 ***-****"
 */
export function maskPhone(phone: string | undefined): string {
  if (!phone) return "Não conectado";

  const digits = sanitizePhone(phone);

  if (!digits) return "Não conectado";

  // Brazilian numbers
  if (digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);

    // 13 digits (with 9)
    if (digits.length === 13) {
      return `+55 ${ddd} 9****-****`;
    }

    // 12 digits (without 9)
    if (digits.length === 12) {
      return `+55 ${ddd} ****-****`;
    }

    // Other Brazilian formats
    return `+55 ${ddd} ****-****`;
  }

  // International numbers - show country code and mask the rest
  try {
    const parsed = parsePhoneNumber(`+${digits}`);
    if (parsed) {
      const countryCode = parsed.countryCallingCode;
      const national = parsed.nationalNumber;
      const visiblePart = national.slice(0, 3);
      const maskedPart = "*".repeat(Math.max(0, national.length - 3));
      return `+${countryCode} ${visiblePart}${maskedPart}`;
    }
  } catch {
    // Fall through to basic masking
  }

  // Fallback: show first 4 digits, mask the rest
  const visible = digits.slice(0, 4);
  const masked = "*".repeat(Math.max(0, digits.length - 4));
  return `+${visible}${masked}`;
}

/**
 * Validate if string has a valid phone number format
 *
 * Checks if the cleaned phone has 10-15 digits (international standard).
 *
 * @example
 * isValidPhoneFormat("+55 85 98864-4401") // → true
 * isValidPhoneFormat("123456789")         // → false (too short)
 */
export function isValidPhoneFormat(phone: string | undefined): boolean {
  if (!phone) return false;

  const digits = sanitizePhone(phone);
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Remove all non-digit characters from phone string
 *
 * Also removes WhatsApp JID suffix.
 *
 * @example
 * cleanPhoneNumber("+55 85 98864-4401") // → "5585988644401"
 * cleanPhoneNumber("5585988644401@s.whatsapp.net") // → "5585988644401"
 */
export function cleanPhoneNumber(phone: string): string {
  return sanitizePhone(phone);
}

/**
 * Extract phone number from WhatsApp JID
 *
 * @example
 * extractPhoneFromJID("5585988644401@s.whatsapp.net") // → "5585988644401"
 * extractPhoneFromJID("5585988644401@c.us")          // → "5585988644401"
 * extractPhoneFromJID("5585988644401")               // → "5585988644401"
 */
export function extractPhoneFromJID(jid: string | undefined): string | undefined {
  if (!jid) return undefined;

  // Remove JID suffix
  const withoutDomain = jid.split("@")[0];
  if (!withoutDomain) return undefined;

  // Extract digits
  const match = withoutDomain.match(/^(\d+)/);
  if (!match?.[1]) return undefined;

  return match[1];
}
