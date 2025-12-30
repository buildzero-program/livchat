// ===========================================
// LivChat.ai - Application Constants
// ===========================================

export const APP_NAME = "LivChat.ai";

// Device & Session
export const DEVICE_COOKIE_NAME = "livchat_device";
export const DEVICE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 dias em segundos
export const DEMO_MESSAGE_LIMIT = 50;
export const APP_TAGLINE = "Envie fácil. Escale rápido.";
export const APP_DESCRIPTION =
  "WhatsApp API para desenvolvedores, martech e AI agents.";

// Pricing
export const PRICING = {
  INSTANCE_PRICE: 89,
  STARTER_MIN_INSTANCES: 5,
  STARTER_PRICE: 445, // 89 * 5
  FREE_MESSAGES_PER_DAY: 50,
} as const;

// Rate Limits
export const RATE_LIMITS = {
  anonymous: {
    messagesPerDay: 50,
    requestsPerSecond: 1,
  },
  free: {
    messagesPerDay: 50,
    requestsPerSecond: 1,
  },
  starter: {
    messagesPerDay: -1, // unlimited
    requestsPerSecond: 10,
  },
  scale: {
    messagesPerDay: -1,
    requestsPerSecond: 50,
  },
} as const;

// Connection States
export const CONNECTION_STATE = {
  IDLE: "idle",
  SCANNING: "scanning",
  CONNECTED: "connected",
} as const;

export type ConnectionState =
  (typeof CONNECTION_STATE)[keyof typeof CONNECTION_STATE];

// Test Panel Tabs
export const TEST_PANEL_TABS = {
  MESSAGE: "message",
  MEDIA: "media",
  GROUPS: "groups",
  WEBHOOK: "webhook",
} as const;

export type TestPanelTab =
  (typeof TEST_PANEL_TABS)[keyof typeof TEST_PANEL_TABS];

// Code Languages
export const CODE_LANGUAGES = {
  NODE: "node",
  PYTHON: "python",
  PHP: "php",
} as const;

export type CodeLanguage =
  (typeof CODE_LANGUAGES)[keyof typeof CODE_LANGUAGES];

// Navigation Links
export const NAV_LINKS = [
  { label: "Recursos", href: "#features" },
  { label: "Preços", href: "#pricing" },
  { label: "Changelog", href: "/changelog" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Docs", href: "https://docs.livchat.ai" },
] as const;

// Social Links
export const SOCIAL_LINKS = {
  github: "https://github.com/livchat",
  twitter: "https://twitter.com/livchat",
  discord: "https://discord.gg/livchat",
} as const;

// Helper function to calculate price
export function calculatePrice(instances: number): number {
  if (instances <= 0) return 0;
  if (instances < PRICING.STARTER_MIN_INSTANCES) {
    return PRICING.STARTER_PRICE; // Minimum is 5 instances
  }
  return instances * PRICING.INSTANCE_PRICE;
}

// Phone utilities moved to ~/lib/phone.ts
// Re-export for backward compatibility
export { formatPhone, maskPhone } from "./phone";
