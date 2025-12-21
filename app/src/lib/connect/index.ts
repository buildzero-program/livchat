/**
 * Connect Library
 *
 * Utilitários para share links de conexão remota de WhatsApp.
 */

export {
  generateShareCode,
  verifyShareCode,
  revokeShareCode,
  type ShareCodeData,
} from "./share-code";

export { getShareBaseUrl, buildShareUrl } from "./share-url";
