import { createHmac, timingSafeEqual } from "crypto";

/**
 * Valida assinatura HMAC-SHA256 do WuzAPI
 *
 * O WuzAPI gera assinaturas usando:
 * - Algoritmo: HMAC-SHA256
 * - Payload: corpo bruto da requisição
 * - Formato: hexadecimal string
 * - Header: x-hmac-signature
 *
 * @param payload - corpo bruto da requisição (string ou Buffer)
 * @param secret - chave HMAC (WUZAPI_WEBHOOK_SECRET)
 * @param signature - valor do header x-hmac-signature
 * @returns true se a assinatura é válida, false caso contrário
 */
export function validateHmacSignature(
  payload: string | Buffer,
  secret: string,
  signature: string | null
): boolean {
  // Validações de entrada
  if (!signature || !secret) {
    return false;
  }

  // Gerar HMAC-SHA256 do payload
  const hmac = createHmac("sha256", secret);

  if (typeof payload === "string") {
    hmac.update(payload, "utf-8");
  } else {
    hmac.update(payload);
  }

  const expectedSignature = hmac.digest("hex");

  // Comparação timing-safe para evitar timing attacks
  // timingSafeEqual requer buffers de mesmo tamanho
  try {
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    // Se os tamanhos forem diferentes, a comparação falha
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    // Se a conversão para hex falhar (signature inválida), retorna false
    return false;
  }
}
