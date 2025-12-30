import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Re-export phone utilities for backward compatibility
// TODO: Update imports to use ~/lib/phone directly
export { formatPhone } from "./phone"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
