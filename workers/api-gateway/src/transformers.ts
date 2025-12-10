/**
 * Transformers: Converte entre camelCase (API pública) e PascalCase (WuzAPI)
 *
 * - toCamelCase: Usado em RESPONSES (WuzAPI → Cliente)
 * - toPascalCase: Usado em REQUESTS (Cliente → WuzAPI)
 */

/**
 * Converte string de PascalCase para camelCase
 *
 * Exemplos:
 * - "Phone" → "phone"
 * - "IsInWhatsapp" → "isInWhatsapp"
 * - "JID" → "jid" (acronyms ficam minúsculos)
 */
export function pascalToCamel(str: string): string {
  if (!str) return str;

  // Caso especial: siglas curtas (JID, ID, QR) ficam todas minúsculas
  if (str === str.toUpperCase() && str.length <= 3) {
    return str.toLowerCase();
  }

  // Primeira letra minúscula, resto mantém
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Converte string de camelCase para PascalCase
 *
 * Exemplos:
 * - "phone" → "Phone"
 * - "isInWhatsapp" → "IsInWhatsapp"
 */
export function camelToPascal(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Verifica se uma chave deve ser preservada (não transformada)
 *
 * Algumas chaves são IDs ou dados, não nomes de campos:
 * - JIDs do WhatsApp: "5491122223333@s.whatsapp.net"
 * - Já estão em lowercase: "code", "success"
 */
function shouldPreserveKey(key: string): boolean {
  // JIDs do WhatsApp (contém @)
  if (key.includes('@')) return true;

  // Chaves que já são lowercase no WuzAPI
  if (key === 'code' || key === 'success' || key === 'data') return false;

  return false;
}

/**
 * Transforma objeto recursivamente de PascalCase para camelCase
 *
 * Usado para RESPONSES: WuzAPI → Cliente
 */
export function toCamelCase<T>(obj: T): T {
  // Null/undefined passam direto
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Arrays: transforma cada elemento
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item)) as T;
  }

  // Objetos: transforma chaves e valores recursivamente
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Preserva chaves especiais (JIDs, etc)
      const newKey = shouldPreserveKey(key) ? key : pascalToCamel(key);
      result[newKey] = toCamelCase(value);
    }

    return result as T;
  }

  // Primitivos passam direto
  return obj;
}

/**
 * Transforma objeto recursivamente de camelCase para PascalCase
 *
 * Usado para REQUESTS: Cliente → WuzAPI
 */
export function toPascalCase<T>(obj: T): T {
  // Null/undefined passam direto
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Arrays: transforma cada elemento
  if (Array.isArray(obj)) {
    return obj.map((item) => toPascalCase(item)) as T;
  }

  // Objetos: transforma chaves e valores recursivamente
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = camelToPascal(key);
      result[newKey] = toPascalCase(value);
    }

    return result as T;
  }

  // Primitivos passam direto
  return obj;
}
