import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format Brazilian phone number for display
 * Input: "5511999999999" → Output: "+55 11 99999-9999"
 */
export function formatPhone(phone: string | undefined): string {
  if (!phone) return "Não conectado";
  if (phone.length >= 12) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  return phone;
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
