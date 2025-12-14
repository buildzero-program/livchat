/**
 * AST Client (Agent Service Toolkit)
 * Abstrai as chamadas para a API do AST para workflows e threads
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ASTWorkflow {
  workflow_id: string;
  name: string;
  description: string | null;
  model_name: string;
  system_prompt: string;
  max_tokens: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ASTMessage {
  role: "human" | "assistant" | "system";
  content: string;
}

export interface ASTInvokeRequest {
  message: string;
  thread_id?: string;
}

export interface ASTInvokeResponse {
  response: string;
  thread_id: string;
  messages: ASTMessage[];
}

export interface ASTStreamChunk {
  type: "token" | "messages";
  content?: string;
  messages?: ASTMessage[];
  thread_id?: string;
}

export interface ASTConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface ASTError {
  detail: string;
}

// =============================================================================
// CLIENT CLASS
// =============================================================================

export class ASTClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: ASTConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.apiKey = config.apiKey;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      ...this.getHeaders(),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({
        detail: `AST error: ${response.status} ${response.statusText}`,
      }))) as ASTError;
      throw new Error(error.detail || `AST error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // ===========================================================================
  // WORKFLOWS
  // ===========================================================================

  /**
   * GET /workflows
   * Lista todos os workflows ativos
   */
  async listWorkflows(): Promise<ASTWorkflow[]> {
    return this.request<ASTWorkflow[]>("/workflows", {
      method: "GET",
    });
  }

  /**
   * GET /workflows/:id
   * Retorna um workflow pelo ID
   */
  async getWorkflow(workflowId: string): Promise<ASTWorkflow> {
    return this.request<ASTWorkflow>(`/workflows/${workflowId}`, {
      method: "GET",
    });
  }

  // ===========================================================================
  // INVOKE (Sync)
  // ===========================================================================

  /**
   * POST /workflows/:id/invoke
   * Invoca um workflow de forma síncrona
   */
  async invoke(
    workflowId: string,
    request: ASTInvokeRequest
  ): Promise<ASTInvokeResponse> {
    return this.request<ASTInvokeResponse>(`/workflows/${workflowId}/invoke`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // ===========================================================================
  // STREAM (SSE)
  // ===========================================================================

  /**
   * POST /workflows/:id/stream
   * Invoca um workflow com streaming via SSE
   * Retorna um ReadableStream de chunks
   */
  async stream(
    workflowId: string,
    request: ASTInvokeRequest
  ): Promise<ReadableStream<ASTStreamChunk>> {
    const url = `${this.baseUrl}/workflows/${workflowId}/stream`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({
        detail: `AST stream error: ${response.status} ${response.statusText}`,
      }))) as ASTError;
      throw new Error(error.detail || `AST stream error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body for streaming");
    }

    const decoder = new TextDecoder();

    return new ReadableStream<ASTStreamChunk>({
      async pull(controller) {
        const { done, value } = await reader.read();

        if (done) {
          controller.close();
          return;
        }

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const chunk = JSON.parse(data) as ASTStreamChunk;
              controller.enqueue(chunk);
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      },
      cancel() {
        reader.cancel();
      },
    });
  }

  // ===========================================================================
  // HEALTH
  // ===========================================================================

  /**
   * GET /health
   * Verifica se o AST está online
   */
  async health(): Promise<{ status: string }> {
    return this.request<{ status: string }>("/health", {
      method: "GET",
    });
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Cria um cliente AST com a configuração fornecida
 */
export function createASTClient(config: ASTConfig): ASTClient {
  return new ASTClient(config);
}
