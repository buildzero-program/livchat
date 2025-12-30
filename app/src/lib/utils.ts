import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parsePhoneNumber } from "libphonenumber-js"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format phone number for display (supports international numbers)
 * Input: "5511999999999" → Output: "+55 11 99999-9999"
 * Input: "14155551234" → Output: "+1 415 555 1234"
 * Input: "447911123456" → Output: "+44 7911 123456"
 */
export function formatPhone(phone: string | undefined): string {
  if (!phone) return "Não conectado";

  // Remove WhatsApp JID suffix if present (@s.whatsapp.net, @c.us, etc)
  const cleanPhone = phone.replace(/@.*$/, "");

  // Ensure it starts with + for parsing
  const phoneWithPlus = cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`;

  try {
    const parsed = parsePhoneNumber(phoneWithPlus);
    if (parsed) {
      return parsed.formatInternational();
    }
  } catch {
    // Fallback: basic formatting if parsing fails
  }

  // Fallback: add + prefix if not present
  return cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`;
}

/**
 * Get human-readable status text for an instance
 */
export function getInstanceStatusText(
  status: "online" | "connecting" | "offline",
  messagesUsed: number
): string {
  const parts: string[] = [];
  switch (status) {
    case "online": parts.push("Online"); break;
    case "connecting": parts.push("Conectando..."); break;
    case "offline": parts.push("Offline"); break;
  }
  if (messagesUsed > 0) {
    parts.push(`${messagesUsed} msgs`);
  }
  return parts.join(" · ");
}
