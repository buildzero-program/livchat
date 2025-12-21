/**
 * WuzAPI Client
 * Abstrai as chamadas para a API do WuzAPI
 */

// Types
export interface WuzAPIStatusData {
  connected: boolean;
  loggedIn: boolean;
  jid?: string;
  id?: string;
  name?: string; // Instance name in WuzAPI (e.g., "livchat_xxx")
  pushName?: string; // Real WhatsApp user name (e.g., "Pedro Nascimento")
  events?: string;
  webhook?: string;
  qrcode?: string; // QR code is included in status response when not logged in
}

export interface WuzAPIQRData {
  QRCode: string;
}

export interface WuzAPIPairingData {
  LinkingCode: string;
}

export interface WuzAPISendData {
  Details: string;
  Id: string;
  Timestamp: number;
}

export interface WuzAPICheckUser {
  Query: string;
  IsInWhatsapp: boolean;
  JID: string;
  VerifiedName: string;
}

export interface WuzAPICheckData {
  Users: WuzAPICheckUser[];
}

export interface WuzAPIAvatarData {
  url?: string;
  id?: string;
  type?: string;
  hash?: string;
  direct_path?: string;
}

export interface WuzAPIResponse<T> {
  code: number;
  success: boolean;
  data: T;
}

export interface WuzAPIConfig {
  baseUrl: string;
  token: string;
}

export class WuzAPIClient {
  private baseUrl: string;
  private token: string;

  constructor(config: WuzAPIConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<WuzAPIResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      Token: this.token,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`WuzAPI error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<WuzAPIResponse<T>>;
  }

  /**
   * GET /session/status
   * Retorna o status da conexão
   */
  async getStatus(): Promise<WuzAPIResponse<WuzAPIStatusData>> {
    return this.request<WuzAPIStatusData>("/session/status", {
      method: "GET",
    });
  }

  /**
   * GET /session/qr
   * Retorna o QR code para conexão
   */
  async getQR(): Promise<WuzAPIResponse<WuzAPIQRData>> {
    return this.request<WuzAPIQRData>("/session/qr", {
      method: "GET",
    });
  }

  /**
   * POST /session/pairphone
   * Gera pairing code para número
   */
  async getPairingCode(phone: string): Promise<WuzAPIResponse<WuzAPIPairingData>> {
    return this.request<WuzAPIPairingData>("/session/pairphone", {
      method: "POST",
      body: JSON.stringify({ Phone: phone }),
    });
  }

  /**
   * POST /chat/send/text
   * Envia mensagem de texto
   */
  async sendText(phone: string, body: string): Promise<WuzAPIResponse<WuzAPISendData>> {
    return this.request<WuzAPISendData>("/chat/send/text", {
      method: "POST",
      body: JSON.stringify({ Phone: phone, Body: body }),
    });
  }

  /**
   * POST /user/check
   * Verifica se números estão no WhatsApp
   */
  async checkNumbers(phones: string[]): Promise<WuzAPIResponse<WuzAPICheckData>> {
    return this.request<WuzAPICheckData>("/user/check", {
      method: "POST",
      body: JSON.stringify({ Phone: phones }),
    });
  }

  /**
   * POST /session/logout
   * Desconecta e remove a sessão
   */
  async logout(): Promise<WuzAPIResponse<{ Details: string }>> {
    return this.request<{ Details: string }>("/session/logout", {
      method: "POST",
    });
  }

  /**
   * POST /session/connect
   * Conecta a instância ao WhatsApp
   */
  async connect(events: string[] = ["Message"]): Promise<WuzAPIResponse<{ details: string; events: string; jid: string; webhook: string }>> {
    return this.request<{ details: string; events: string; jid: string; webhook: string }>("/session/connect", {
      method: "POST",
      body: JSON.stringify({ Subscribe: events, Immediate: false }),
    });
  }

  /**
   * POST /user/avatar
   * Fetches the profile picture URL for a WhatsApp number
   * Note: Despite docs saying GET, WuzAPI actually uses POST
   */
  async getAvatar(jid: string): Promise<WuzAPIResponse<WuzAPIAvatarData>> {
    const phone = jid.replace(/@s\.whatsapp\.net$/, "").replace(/:\d+$/, "");
    return this.request<WuzAPIAvatarData>("/user/avatar", {
      method: "POST",
      body: JSON.stringify({ Phone: phone, Preview: false }),
    });
  }
}

// Factory function para criar cliente com config do env
export function createWuzAPIClient(config: WuzAPIConfig): WuzAPIClient {
  return new WuzAPIClient(config);
}

// Interface para criação de instância
export interface WuzAPICreateInstanceData {
  id: string;
  name: string;
  token: string;
  events: string;
  webhook: string;
}

// Interface para instância listada
export interface WuzAPIInstanceData {
  id: string;
  name: string;
  token: string;
  connected: boolean;
  loggedIn: boolean;
  jid: string;
  events: string;
}

/**
 * Lista todas as instâncias WuzAPI (usa Admin API)
 */
export async function listWuzAPIInstances(
  baseUrl: string,
  adminToken: string
): Promise<WuzAPIResponse<WuzAPIInstanceData[]>> {
  const response = await fetch(`${baseUrl}/admin/users`, {
    method: "GET",
    headers: {
      Authorization: adminToken,
    },
  });

  if (!response.ok) {
    throw new Error(`WuzAPI admin error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<WuzAPIResponse<WuzAPIInstanceData[]>>;
}

/**
 * Cria uma nova instância WuzAPI (usa Admin API)
 * Requer WUZAPI_ADMIN_TOKEN
 */
export async function createWuzAPIInstance(
  baseUrl: string,
  adminToken: string,
  instanceName: string,
  instanceToken: string,
  events: string = "Message"
): Promise<WuzAPIResponse<WuzAPICreateInstanceData>> {
  const response = await fetch(`${baseUrl}/admin/users`, {
    method: "POST",
    headers: {
      Authorization: adminToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: instanceName,
      token: instanceToken,
      events: events,
    }),
  });

  if (!response.ok) {
    throw new Error(`WuzAPI admin error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<WuzAPIResponse<WuzAPICreateInstanceData>>;
}
