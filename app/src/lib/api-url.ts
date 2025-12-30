// ===========================================
// LivChat.ai - Dynamic API URL Helper
// ===========================================

/**
 * Checks if running in production environment.
 * Detection based on hostname (client-side) or env var (server-side).
 */
export function isProduction(): boolean {
  // Client-side: check hostname
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    return hostname === "livchat.ai" || hostname === "www.livchat.ai";
  }
  // Server-side: check NODE_ENV
  return process.env.NODE_ENV === "production";
}

/**
 * Returns the API base URL based on environment.
 * Priority:
 * 1. NEXT_PUBLIC_API_URL env var (if set)
 * 2. Client-side detection (localhost, vercel preview, production)
 * 3. Server-side fallback (production)
 */
export function getApiBaseUrl(): string {
  // 1. Environment variable has priority
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // 2. Client-side: detect environment from window
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    // Localhost = dev environment
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${window.location.origin}/api`;
    }

    // Vercel preview deployments
    if (hostname.includes("vercel.app")) {
      return `${window.location.origin}/api`;
    }

    // Production - use dedicated API subdomain
    return "https://api.livchat.ai";
  }

  // 3. Server-side fallback (SSR, API routes)
  return "https://api.livchat.ai";
}

/**
 * Extracts phone number from WhatsApp JID.
 * Example: "5585912345678@s.whatsapp.net" -> "5585912345678"
 */
export function extractPhoneFromJid(jid: string | undefined | null): string {
  if (!jid) return "";
  const atIndex = jid.indexOf("@");
  return atIndex > 0 ? jid.slice(0, atIndex) : jid;
}
