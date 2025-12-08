/**
 * Instance Helpers
 *
 * Utility functions for instance status and data transformation
 */

export type InstanceStatus = "online" | "connecting" | "offline";

/**
 * Derives the instance status from WuzAPI connected/loggedIn flags
 *
 * @param connected - WebSocket connection status
 * @param loggedIn - QR code scanned and authenticated
 * @returns "online" | "connecting" | "offline"
 */
export function deriveInstanceStatus(
  connected: boolean,
  loggedIn: boolean
): InstanceStatus {
  if (connected && loggedIn) return "online";
  if (connected && !loggedIn) return "connecting";
  return "offline";
}
