/**
 * Share URL Builder
 *
 * Constrói URLs de compartilhamento com suporte a diferentes ambientes:
 * - Produção: NEXT_PUBLIC_APP_URL
 * - Desenvolvimento com NGROK: NGROK_DOMAIN
 * - Local: localhost:3000
 */

/**
 * Obtém a URL base para share links.
 * Prioridade: NEXT_PUBLIC_APP_URL > NGROK_DOMAIN > localhost
 */
export function getShareBaseUrl(): string {
  // Produção
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""); // Remove trailing slash
  }

  // Desenvolvimento com NGROK (para testar em celular)
  if (process.env.NGROK_DOMAIN) {
    return `https://${process.env.NGROK_DOMAIN}`;
  }

  // Fallback local
  return "http://localhost:3000";
}

/**
 * Constrói a URL completa de compartilhamento.
 *
 * @param code - Código de 16 caracteres
 * @returns URL completa: https://app.com/connect/{code}
 */
export function buildShareUrl(code: string): string {
  const baseUrl = getShareBaseUrl();
  return `${baseUrl}/connect/${code}`;
}
