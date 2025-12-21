# Plan-16.1: Share Link para Conexão Remota

**Data:** 2024-12-20
**Status:** 🚧 Em desenvolvimento
**Dependências:** Plan-16 (Página de Instâncias) ✅
**Referência:** BuildZero core-agent `/lib/connect/`

## Objetivo

Permitir que o usuário gere um link temporário (24h) para conectar uma instância WhatsApp remotamente, sem precisar estar logado no dashboard.

**Caso de uso:** Usuário quer que um colega/cliente conecte o WhatsApp dele. Gera um link, envia por mensagem, e a pessoa acessa para escanear o QR code.

## Arquitetura

### Fluxo Completo

```
PROPRIETÁRIO (Dashboard Autenticado)
├─ Clica "Gerar link" no InstanceFormDialog
├─ POST /api/connect/share { instanceId }
│   ├─ Valida auth (Clerk)
│   ├─ Valida instância pertence à org
│   ├─ Gera código 16 chars (nanoid)
│   ├─ Salva em Redis: "share:{code}" = { instanceId, orgId, userId }
│   ├─ TTL: 24 horas (auto-expira)
│   └─ Retorna { code, shareUrl, expiresAt }
├─ Copia URL para clipboard
└─ Exibe "Link copiado! Válido por 24h"

USUÁRIO REMOTO (Página Pública - Sem Auth)
├─ Acessa https://livchat.ai/connect/{code}
├─ GET /api/connect/{code}/status
│   ├─ Valida código em Redis
│   ├─ Se inválido/expirado → Erro
│   └─ Se válido → Retorna { instanceId, status }
├─ Exibe página com botão "Conectar WhatsApp"
├─ POST /api/connect/{code}/session
│   ├─ Valida código
│   ├─ Chama WuzAPI connect()
│   └─ Retorna { success }
├─ GET /api/connect/{code}/qr (polling)
│   ├─ Valida código
│   └─ Retorna { qrCode, pairingCode? }
├─ Exibe QR Code + Código de Pareamento
├─ Polling GET /api/connect/{code}/status (cada 2s)
│   └─ Quando status = "connected" → Sucesso
└─ Exibe "WhatsApp conectado!" + auto-fecha

REDIS (Automático)
└─ Deleta chave após 24h (TTL expirado)
```

### Decisões Técnicas

| Aspecto | Decisão | Justificativa |
|---------|---------|---------------|
| **Storage** | Upstash Redis | TTL automático, já configurado no .env |
| **Código** | 16 chars (nanoid) | Curto, fácil de compartilhar |
| **Expiração** | 24 horas | Seguro, tempo suficiente |
| **Auth página** | Nenhuma | Por design - link compartilhável |
| **Rate limit** | 5 links/hora/org | Evitar abuse |

## Schema

### Redis (Upstash)

```
Chave: "share:{code}"
Valor: JSON {
  instanceId: string,      // UUID da instância
  organizationId: string,  // UUID da org (para auditoria)
  createdByUserId: string, // UUID do user que criou
  createdAt: number,       // timestamp ms
}
TTL: 86400 segundos (24 horas)
```

**Não precisa tabela no PostgreSQL** - Redis com TTL é mais elegante.

## Arquivos a Criar

### 1. Lib de Share Codes

```
src/lib/connect/
├── index.ts           # Barrel export
├── share-code.ts      # generateShareCode, verifyShareCode, revokeShareCode
└── share-url.ts       # buildShareUrl, getShareBaseUrl
```

### 2. API Routes (Next.js App Router)

```
src/app/api/connect/
├── share/
│   └── route.ts       # POST - gera código (autenticado)
└── [code]/
    ├── status/
    │   └── route.ts   # GET - valida código + status instância
    ├── session/
    │   └── route.ts   # POST - inicia conexão, GET - obtém QR
    └── qr/
        └── route.ts   # GET - obtém QR code (alternativo)
```

### 3. Página Pública

```
src/app/connect/
└── [code]/
    └── page.tsx       # Página pública de conexão

src/components/connect/
└── public-connect-page.tsx  # UI da página
```

### 4. Modificações Existentes

```
src/components/instances/instance-form-dialog.tsx
└── Integrar ShareButton real (remover mock)
```

## Implementação Detalhada

### 1. Lib Share Code (`src/lib/connect/share-code.ts`)

```typescript
import { Redis } from "@upstash/redis";
import { nanoid } from "nanoid";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SHARE_PREFIX = "share:";
const SHARE_CODE_LENGTH = 16;
const TTL_SECONDS = 86400; // 24 horas

export interface ShareCodeData {
  instanceId: string;
  organizationId: string;
  createdByUserId: string;
  createdAt: number;
}

export async function generateShareCode(
  instanceId: string,
  organizationId: string,
  createdByUserId: string
): Promise<{ code: string; expiresAt: Date }> {
  const code = nanoid(SHARE_CODE_LENGTH);

  const data: ShareCodeData = {
    instanceId,
    organizationId,
    createdByUserId,
    createdAt: Date.now(),
  };

  await redis.setex(
    `${SHARE_PREFIX}${code}`,
    TTL_SECONDS,
    JSON.stringify(data)
  );

  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  return { code, expiresAt };
}

export async function verifyShareCode(code: string): Promise<ShareCodeData | null> {
  const raw = await redis.get(`${SHARE_PREFIX}${code}`);

  if (!raw) return null;

  // Redis pode retornar string ou objeto já parseado
  if (typeof raw === "string") {
    return JSON.parse(raw) as ShareCodeData;
  }

  return raw as ShareCodeData;
}

export async function revokeShareCode(code: string): Promise<boolean> {
  const result = await redis.del(`${SHARE_PREFIX}${code}`);
  return result > 0;
}
```

### 2. Lib Share URL (`src/lib/connect/share-url.ts`)

```typescript
export function getShareBaseUrl(): string {
  // Produção
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Desenvolvimento com NGROK (para testar em celular)
  if (process.env.NGROK_DOMAIN) {
    return `https://${process.env.NGROK_DOMAIN}`;
  }

  // Fallback local
  return "http://localhost:3000";
}

export function buildShareUrl(code: string): string {
  const baseUrl = getShareBaseUrl();
  return `${baseUrl}/connect/${code}`;
}
```

### 3. API Route POST /api/connect/share

```typescript
// src/app/api/connect/share/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { instances } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { generateShareCode, buildShareUrl } from "~/lib/connect";
import { syncUserFromClerk } from "~/server/lib/user";

export async function POST(request: Request) {
  try {
    // 1. Verificar autenticação
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Sincronizar usuário
    const user = await syncUserFromClerk(clerkId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    // 3. Extrair instanceId
    const body = await request.json();
    const { instanceId } = body;

    if (!instanceId) {
      return NextResponse.json(
        { error: "instanceId is required" },
        { status: 400 }
      );
    }

    // 4. Verificar se instância existe e pertence à org
    const instance = await db.query.instances.findFirst({
      where: and(
        eq(instances.id, instanceId),
        eq(instances.organizationId, user.organizationId)
      ),
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      );
    }

    // 5. Gerar código
    const { code, expiresAt } = await generateShareCode(
      instanceId,
      user.organizationId,
      user.id
    );

    // 6. Construir URL
    const shareUrl = buildShareUrl(code);

    return NextResponse.json({
      code,
      shareUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Error generating share code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### 4. API Route GET /api/connect/[code]/status

```typescript
// src/app/api/connect/[code]/status/route.ts
import { NextResponse } from "next/server";
import { verifyShareCode } from "~/lib/connect";
import { db } from "~/server/db";
import { instances } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { WuzAPIClient } from "~/server/lib/wuzapi";
import { env } from "~/env";

interface RouteParams {
  params: Promise<{ code: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { code } = await params;

    // 1. Verificar código
    const data = await verifyShareCode(code);

    if (!data) {
      return NextResponse.json(
        { error: "Link inválido ou expirado" },
        { status: 401 }
      );
    }

    // 2. Buscar instância
    const instance = await db.query.instances.findFirst({
      where: eq(instances.id, data.instanceId),
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instância não encontrada" },
        { status: 404 }
      );
    }

    // 3. Obter status do WuzAPI
    const client = new WuzAPIClient({
      baseUrl: env.WUZAPI_URL,
      token: instance.providerToken,
    });

    let status = "disconnected";
    let phoneNumber: string | null = null;

    try {
      const wuzStatus = await client.getStatus();
      if (wuzStatus.data.loggedIn) {
        status = "connected";
        phoneNumber = wuzStatus.data.jid ?? null;
      } else if (wuzStatus.data.connected) {
        status = "connecting";
      }
    } catch {
      // WuzAPI não disponível, mantém disconnected
    }

    return NextResponse.json({
      instanceId: data.instanceId,
      instanceName: instance.name,
      status,
      phoneNumber,
    });
  } catch (error) {
    console.error("Error checking share code status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### 5. API Route POST/GET /api/connect/[code]/session

```typescript
// src/app/api/connect/[code]/session/route.ts
import { NextResponse } from "next/server";
import { verifyShareCode } from "~/lib/connect";
import { db } from "~/server/db";
import { instances } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { WuzAPIClient } from "~/server/lib/wuzapi";
import { env } from "~/env";

interface RouteParams {
  params: Promise<{ code: string }>;
}

// POST - Inicia sessão de conexão
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { code } = await params;

    // 1. Verificar código
    const data = await verifyShareCode(code);
    if (!data) {
      return NextResponse.json(
        { error: "Link inválido ou expirado" },
        { status: 401 }
      );
    }

    // 2. Buscar instância
    const instance = await db.query.instances.findFirst({
      where: eq(instances.id, data.instanceId),
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instância não encontrada" },
        { status: 404 }
      );
    }

    // 3. Iniciar conexão no WuzAPI
    const client = new WuzAPIClient({
      baseUrl: env.WUZAPI_URL,
      token: instance.providerToken,
    });

    await client.connect(["Message", "ReadReceipt", "Connected"]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error starting session:", error);
    return NextResponse.json(
      { error: "Falha ao iniciar conexão" },
      { status: 500 }
    );
  }
}

// GET - Obtém QR code
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { code } = await params;

    // 1. Verificar código
    const data = await verifyShareCode(code);
    if (!data) {
      return NextResponse.json(
        { error: "Link inválido ou expirado" },
        { status: 401 }
      );
    }

    // 2. Buscar instância
    const instance = await db.query.instances.findFirst({
      where: eq(instances.id, data.instanceId),
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instância não encontrada" },
        { status: 404 }
      );
    }

    // 3. Obter QR code do WuzAPI
    const client = new WuzAPIClient({
      baseUrl: env.WUZAPI_URL,
      token: instance.providerToken,
    });

    const status = await client.getStatus();

    return NextResponse.json({
      qrCode: status.data.qrcode ?? null,
      connected: status.data.connected,
      loggedIn: status.data.loggedIn,
    });
  } catch (error) {
    console.error("Error getting QR code:", error);
    return NextResponse.json(
      { error: "Falha ao obter QR code" },
      { status: 500 }
    );
  }
}
```

### 6. Página Pública `/connect/[code]`

```typescript
// src/app/connect/[code]/page.tsx
import { PublicConnectPage } from "~/components/connect/public-connect-page";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function ConnectPage({ params }: PageProps) {
  const { code } = await params;
  return <PublicConnectPage code={code} />;
}

export const metadata = {
  title: "Conectar WhatsApp - LivChat",
  description: "Escaneie o QR code para conectar seu WhatsApp",
};
```

### 7. Componente PublicConnectPage

```typescript
// src/components/connect/public-connect-page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, AlertCircle, Smartphone, QrCode } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type PageState = "loading" | "ready" | "connecting" | "success" | "error";

interface PublicConnectPageProps {
  code: string;
}

export function PublicConnectPage({ code }: PublicConnectPageProps) {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [instanceName, setInstanceName] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  // Verificar código ao montar
  useEffect(() => {
    checkStatus();
  }, [code]);

  const checkStatus = async () => {
    try {
      const response = await fetch(`/api/connect/${code}/status`);
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error ?? "Link inválido ou expirado");
        setPageState("error");
        return;
      }

      setInstanceName(data.instanceName);

      if (data.status === "connected") {
        setPageState("success");
      } else {
        setPageState("ready");
      }
    } catch {
      setErrorMessage("Erro ao verificar link");
      setPageState("error");
    }
  };

  const startConnection = async () => {
    setPageState("connecting");

    try {
      // Iniciar sessão
      const sessionResponse = await fetch(`/api/connect/${code}/session`, {
        method: "POST",
      });

      if (!sessionResponse.ok) {
        const data = await sessionResponse.json();
        setErrorMessage(data.error ?? "Falha ao iniciar conexão");
        setPageState("error");
        return;
      }

      // Aguardar um pouco e buscar QR
      await new Promise((r) => setTimeout(r, 2000));
      await fetchQrCode();

      // Iniciar polling de status
      startStatusPolling();
    } catch {
      setErrorMessage("Erro ao conectar");
      setPageState("error");
    }
  };

  const fetchQrCode = async () => {
    try {
      const response = await fetch(`/api/connect/${code}/session`);
      const data = await response.json();

      if (data.loggedIn) {
        setPageState("success");
        return;
      }

      if (data.qrCode) {
        setQrCode(data.qrCode);
      }
    } catch {
      // Ignora erro, vai tentar novamente
    }
  };

  const startStatusPolling = useCallback(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/connect/${code}/status`);
        const data = await response.json();

        if (data.status === "connected") {
          clearInterval(interval);
          setPageState("success");
        }
      } catch {
        // Ignora erro de polling
      }
    }, 2000);

    // Auto-refresh QR a cada 15s
    const qrInterval = setInterval(fetchQrCode, 15000);

    // Limpar após 5 minutos (timeout)
    setTimeout(() => {
      clearInterval(interval);
      clearInterval(qrInterval);
    }, 300000);

    return () => {
      clearInterval(interval);
      clearInterval(qrInterval);
    };
  }, [code]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-card border rounded-xl p-8 shadow-lg">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">Conectar WhatsApp</h1>
            {instanceName && (
              <p className="text-sm text-muted-foreground mt-1">
                {instanceName}
              </p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {/* Loading */}
            {pageState === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 text-center"
              >
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-4">
                  Verificando link...
                </p>
              </motion.div>
            )}

            {/* Ready */}
            {pageState === "ready" && (
              <motion.div
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-6">
                  Clique para gerar o QR code e conectar seu WhatsApp
                </p>
                <Button onClick={startConnection} size="lg">
                  Conectar WhatsApp
                </Button>
              </motion.div>
            )}

            {/* Connecting - QR Code */}
            {pageState === "connecting" && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* QR Code */}
                <div className="relative w-48 h-48 bg-white rounded-xl overflow-hidden mx-auto">
                  {qrCode ? (
                    <img
                      src={qrCode}
                      alt="QR Code WhatsApp"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  Abra o WhatsApp → Menu → Dispositivos vinculados → Vincular
                </p>

                {/* Pairing Code */}
                {pairingCode && (
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-xl font-mono font-bold text-center text-primary tracking-[0.3em]">
                      {pairingCode}
                    </p>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Ou use este código no WhatsApp
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Aguardando conexão...</span>
                </div>
              </motion.div>
            )}

            {/* Success */}
            {pageState === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4"
                >
                  <Check className="h-8 w-8 text-green-500" />
                </motion.div>
                <h3 className="text-lg font-semibold mb-1">
                  WhatsApp Conectado!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Você pode fechar esta página.
                </p>
              </motion.div>
            )}

            {/* Error */}
            {pageState === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold mb-1">
                  Link inválido
                </h3>
                <p className="text-sm text-muted-foreground">
                  {errorMessage}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Powered by LivChat.ai
        </p>
      </motion.div>
    </div>
  );
}
```

## Testes TDD

### 1. Testes da Lib share-code.ts

```typescript
// tests/unit/connect/share-code.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("generateShareCode", () => {
  it("should generate a 16-character code");
  it("should store data in Redis with 24h TTL");
  it("should include all required fields in stored data");
  it("should return expiration date ~24h from now");
});

describe("verifyShareCode", () => {
  it("should return data for valid code");
  it("should return null for non-existent code");
  it("should handle already-parsed JSON from Redis");
});

describe("revokeShareCode", () => {
  it("should delete code from Redis");
  it("should return true when code existed");
  it("should return false when code did not exist");
});
```

### 2. Testes das API Routes

```typescript
// tests/unit/connect/api-share.test.ts
describe("POST /api/connect/share", () => {
  it("should return 401 if not authenticated");
  it("should return 400 if instanceId is missing");
  it("should return 404 if instance does not exist");
  it("should return 404 if instance belongs to different org");
  it("should generate and return share code for valid request");
  it("should include complete share URL");
  it("should include expiration time (24 hours)");
});

describe("GET /api/connect/[code]/status", () => {
  it("should return 401 for invalid code");
  it("should return 401 for expired code");
  it("should return instance status for valid code");
  it("should return connected status when WuzAPI says loggedIn");
});

describe("POST /api/connect/[code]/session", () => {
  it("should return 401 for invalid code");
  it("should start WuzAPI connection for valid code");
});

describe("GET /api/connect/[code]/session", () => {
  it("should return 401 for invalid code");
  it("should return QR code from WuzAPI");
});
```

## Checklist de Implementação

- [ ] **Lib Share Code**
  - [ ] Criar `src/lib/connect/share-code.ts`
  - [ ] Criar `src/lib/connect/share-url.ts`
  - [ ] Criar `src/lib/connect/index.ts`
  - [ ] Testes unitários

- [ ] **API Routes**
  - [ ] `POST /api/connect/share`
  - [ ] `GET /api/connect/[code]/status`
  - [ ] `POST /api/connect/[code]/session`
  - [ ] `GET /api/connect/[code]/session`
  - [ ] Testes unitários

- [ ] **Página Pública**
  - [ ] `src/app/connect/[code]/page.tsx`
  - [ ] `src/components/connect/public-connect-page.tsx`
  - [ ] Layout responsivo
  - [ ] Estados: loading, ready, connecting, success, error

- [ ] **Integração Dashboard**
  - [ ] Modificar `InstanceFormDialog` para usar API real
  - [ ] Remover `generateMockShareCode()`
  - [ ] Chamar `POST /api/connect/share`
  - [ ] Copiar URL para clipboard

- [ ] **Testes E2E**
  - [ ] Fluxo completo de share
  - [ ] Página pública com código válido
  - [ ] Página pública com código inválido

## Estimativa

| Fase | Complexidade | Estimativa |
|------|--------------|------------|
| Lib share-code | Baixa | 1h |
| API Routes | Média | 2h |
| Página Pública | Média | 2h |
| Integração Dialog | Baixa | 30min |
| Testes | Média | 2h |

**Total:** ~8 horas
