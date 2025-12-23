/**
 * Instance Resolver
 * Resolves which instance to use based on the `from` parameter
 */

import type { AllowedInstance } from "./types";

// Re-export for convenience
export type { AllowedInstance };

/**
 * Resolves an instance from the `from` parameter.
 *
 * Priority:
 * 1. Match by phone number (extracted from whatsappJid)
 * 2. Match by instance ID (UUID)
 *
 * @param from - Phone number or instance ID
 * @param allowedInstances - List of instances the API key can access
 * @returns The matched instance or null if not found
 */
export function resolveInstanceByFrom(
  from: string,
  allowedInstances: AllowedInstance[]
): AllowedInstance | null {
  if (!from || allowedInstances.length === 0) {
    return null;
  }

  // Normalize input: remove all non-digit characters for phone matching
  const normalizedFrom = from.replace(/\D/g, "");

  // 1. Try to match by phone number (whatsappJid)
  const byPhone = allowedInstances.find((inst) => {
    if (!inst.whatsappJid) return false;

    // Extract phone from JID: "5585912345678:23@s.whatsapp.net" -> "5585912345678"
    // JID format: phone[:device]@s.whatsapp.net
    const atIndex = inst.whatsappJid.indexOf("@");
    const beforeAt = atIndex > 0 ? inst.whatsappJid.slice(0, atIndex) : inst.whatsappJid;

    // Remove device suffix if present (e.g., ":23" for multi-device)
    const colonIndex = beforeAt.indexOf(":");
    const jidNumber = colonIndex > 0 ? beforeAt.slice(0, colonIndex) : beforeAt;

    // Match against normalized input (digits only)
    return jidNumber === normalizedFrom;
  });

  if (byPhone) {
    return byPhone;
  }

  // 2. Try to match by instance ID (exact match)
  const byId = allowedInstances.find((inst) => inst.id === from);

  return byId ?? null;
}
