# Plan 05-B: Instance Identification & Dynamic API URLs

## Resumo Executivo

### Problema Identificado

O LivChat possui um **gap arquitetural crítico**: organizações com múltiplas instâncias WhatsApp não conseguem especificar de qual número enviar mensagens. A API seleciona automaticamente a instância mais recentemente conectada.

### Comparação WuzAPI vs LivChat

| Aspecto | WuzAPI (Original) | LivChat (Atual) |
|---------|-------------------|-----------------|
| Relação Token:Instância | **1:1** (fixo) | **N:1** (após claim) |
| Identificação | Token = Instância | Token → Org → Auto-select |
| Controle do cliente | Total | **Nenhum** |

### Impacto

- Empresas multi-número não conseguem escolher departamento de origem
- Destinatário pode receber de números diferentes sem controle
- Impossível garantir compliance de origem
- Sem load balancing controlado pelo cliente

---

## Solução Proposta

### Novo Parâmetro: `from`

```json
{
  "phone": "558588644401",
  "body": "Olá! Teste de integração LivChat",
  "from": "5585912345678"
}
```

### Resolução por Prioridade

1. **Número WhatsApp**: `from: "5585912345678"` → Busca `whatsappJid LIKE '5585912345678@%'`
2. **Instance ID (UUID)**: `from: "uuid-xxx"` → Busca `instance.id = 'uuid-xxx'`
3. **Fallback**: Sem `from` → Comportamento atual (mais recente conectada)

---

## Escopo de Mudanças

### Problema 1: URLs Hardcoded no Frontend

**Arquivo**: `app/src/components/marketing/test-panel.tsx`

```typescript
// ATUAL (linha 144) - Hardcoded
const curlExample = `curl -X POST https://api.livchat.ai/v1/messages/send ...`

// PROPOSTO - Dinâmico
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : 'https://api.livchat.ai');
```

**Arquivo**: `app/src/lib/mock-data.ts` (linha 278) - Mesmo problema

### Problema 2: Parâmetro `from` Ausente

#### Endpoints Afetados (TODOS - 24 endpoints)

**Mensagens (10)**
- POST `/v1/messages/send`
- POST `/v1/messages/send/image`
- POST `/v1/messages/send/document`
- POST `/v1/messages/send/audio`
- POST `/v1/messages/send/video`
- POST `/v1/messages/send/location`
- POST `/v1/messages/send/contact`
- POST `/v1/messages/send/sticker`
- POST `/v1/messages/react`
- POST `/v1/messages/read`

**Contatos (4)**
- POST `/v1/contacts/check`
- POST `/v1/contacts/info`
- GET `/v1/contacts/avatar`
- GET `/v1/contacts/list`

**Sessão (5)**
- GET `/v1/session/status`
- GET `/v1/session/qr`
- POST `/v1/session/connect`
- POST `/v1/session/disconnect`
- POST `/v1/session/logout`

**Grupos (4)**
- GET `/v1/groups/list`
- GET `/v1/groups/info`
- POST `/v1/groups/create`
- GET `/v1/groups/invite-link`

**Webhook (1)**
- GET/POST `/v1/webhook`

---

## Arquitetura da Solução

### Fluxo Atual (Problemático)

```
Request → API Gateway → validate-key → Auto-select instance → WuzAPI
                                              ↑
                                    Sem controle do cliente
```

### Fluxo Proposto

```
Request {from: "5585..."} → API Gateway → validate-key(from) → Resolve instance → WuzAPI
                                                    ↑
                                          Cliente especifica
```

---

## Implementação Detalhada

### Fase 1: Ambiente Dinâmico no Frontend

#### 1.1 Criar variável de ambiente

**Arquivo**: `app/src/env.js`

```javascript
// Adicionar no client schema
NEXT_PUBLIC_API_URL: z.string().url().optional(),
```

**Arquivo**: `.env.example`

```env
# API URL (opcional, usa domínio atual se não definido)
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
```

#### 1.2 Criar helper para API URL

**Arquivo**: `app/src/lib/api-url.ts` (NOVO)

```typescript
export function getApiBaseUrl(): string {
  // 1. Variável de ambiente tem prioridade
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // 2. Client-side: detectar ambiente
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Localhost = dev
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${window.location.origin}/api`;
    }

    // Preview/staging
    if (hostname.includes('vercel.app')) {
      return `${window.location.origin}/api`;
    }

    // Produção
    return 'https://api.livchat.ai';
  }

  // 3. Server-side fallback
  return 'https://api.livchat.ai';
}
```

#### 1.3 Atualizar TestPanel

**Arquivo**: `app/src/components/marketing/test-panel.tsx`

```typescript
import { getApiBaseUrl } from "~/lib/api-url";

// Linha ~144: Adicionar from e URL dinâmica
const apiBaseUrl = getApiBaseUrl();
const fromNumber = jid ? jid.split('@')[0] : '';

const curlExample = `curl -X POST ${apiBaseUrl}/v1/messages/send \\
  -H "Authorization: Bearer ${apiKey || "seu_token_aqui"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "${cleanedPhone || "5511999999999"}",
    "body": "${message.slice(0, 50)}${message.length > 50 ? "..." : ""}",
    "from": "${fromNumber}"
  }'`;
```

#### 1.4 Atualizar mock-data.ts

**Arquivo**: `app/src/lib/mock-data.ts`

```typescript
// Linha ~278: Remover URL hardcoded ou manter como exemplo estático
export const MOCK_CURL_EXAMPLE = `curl -X POST https://api.livchat.ai/v1/messages/send \\
  -H "Authorization: Bearer lc_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "body": "Olá! Teste de integração",
    "from": "5585912345678"
  }'`;
```

---

### Fase 2: Parâmetro `from` no API Gateway

#### 2.1 Atualizar tipos

**Arquivo**: `workers/api-gateway/src/types.ts`

```typescript
export interface ApiKeyData {
  id: string;
  organizationId: string | null;
  instanceId: string | null;
  providerToken: string;
  scopes: string[];
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
  isActive: boolean;
  // NOVO: Lista de instâncias permitidas para esta key
  allowedInstances?: Array<{
    id: string;
    whatsappJid: string | null;
    providerToken: string;
  }>;
}

// NOVO: Request com from
export interface RequestWithFrom {
  from?: string; // Número WhatsApp ou Instance ID
  [key: string]: unknown;
}
```

#### 2.2 Atualizar router.ts

**Arquivo**: `workers/api-gateway/src/router.ts`

```typescript
// Após linha 200, adicionar extração do from
let resolvedProviderToken = keyData.providerToken;
let resolvedInstanceId = keyData.instanceId;

if (request.method !== "GET" && request.method !== "HEAD") {
  try {
    const jsonBody = await request.clone().json() as RequestWithFrom;

    // Se from especificado, resolver instância
    if (jsonBody.from && keyData.allowedInstances?.length) {
      const resolved = resolveInstanceByFrom(jsonBody.from, keyData.allowedInstances);
      if (resolved) {
        resolvedProviderToken = resolved.providerToken;
        resolvedInstanceId = resolved.id;
      } else {
        return new Response(
          JSON.stringify({
            error: { code: 403, message: "Instance not found or not authorized" }
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Remover 'from' do body antes de enviar ao WuzAPI
    const { from, ...bodyWithoutFrom } = jsonBody;
    const transformedBody = toPascalCase(bodyWithoutFrom);
    body = JSON.stringify(transformedBody);
  } catch {
    body = await request.text();
  }
}

// Usar token resolvido
headers.set("Token", resolvedProviderToken);
```

#### 2.3 Helper para resolver instância

**Arquivo**: `workers/api-gateway/src/instance-resolver.ts` (NOVO)

```typescript
interface AllowedInstance {
  id: string;
  whatsappJid: string | null;
  providerToken: string;
}

export function resolveInstanceByFrom(
  from: string,
  allowedInstances: AllowedInstance[]
): AllowedInstance | null {
  // Normalizar input (remover caracteres não numéricos se for número)
  const normalizedFrom = from.replace(/\D/g, '');

  // 1. Tentar match por número WhatsApp (whatsappJid)
  const byPhone = allowedInstances.find(inst => {
    if (!inst.whatsappJid) return false;
    const jidNumber = inst.whatsappJid.split('@')[0];
    return jidNumber === normalizedFrom || jidNumber === from;
  });

  if (byPhone) return byPhone;

  // 2. Tentar match por Instance ID (UUID)
  const byId = allowedInstances.find(inst => inst.id === from);

  return byId || null;
}
```

---

### Fase 3: Backend - Validate Key com Instâncias

#### 3.1 Atualizar endpoint validate-key

**Arquivo**: `app/src/app/api/internal/validate-key/route.ts`

```typescript
import { validateAndResolveInstance, getOrganizationInstances } from "~/server/lib/api-key";

export async function POST(request: NextRequest) {
  // ... validação existente ...

  const result = await validateAndResolveInstance(body.key);

  if (!result) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  // NOVO: Buscar todas as instâncias permitidas para esta key
  let allowedInstances: Array<{id: string; whatsappJid: string | null; providerToken: string}> = [];

  if (result.organizationId) {
    // Key claimed: pode usar qualquer instância da org
    allowedInstances = await getOrganizationInstances(result.organizationId);
  } else if (result.instanceId) {
    // Key orphan: só pode usar sua própria instância
    allowedInstances = [{
      id: result.instanceId,
      whatsappJid: result.whatsappJid ?? null,
      providerToken: result.providerToken,
    }];
  }

  return NextResponse.json({
    id: result.keyId,
    organizationId: result.organizationId,
    instanceId: result.instanceId,
    providerToken: result.providerToken,
    scopes: result.scopes,
    rateLimitRequests: result.rateLimitRequests,
    rateLimitWindowSeconds: result.rateLimitWindowSeconds,
    isActive: true,
    // NOVO
    allowedInstances,
  });
}
```

#### 3.2 Nova função getOrganizationInstances

**Arquivo**: `app/src/server/lib/api-key.ts`

```typescript
export async function getOrganizationInstances(
  organizationId: string
): Promise<Array<{ id: string; whatsappJid: string | null; providerToken: string }>> {
  const orgInstances = await db.query.instances.findMany({
    where: and(
      eq(instances.organizationId, organizationId),
      eq(instances.status, "connected") // Só instâncias conectadas
    ),
    columns: {
      id: true,
      whatsappJid: true,
      providerToken: true,
    },
  });

  return orgInstances;
}
```

#### 3.3 Atualizar ValidatedApiKey type

**Arquivo**: `app/src/server/lib/api-key.ts`

```typescript
export interface ValidatedApiKey {
  keyId: string;
  organizationId: string | null;
  instanceId: string;
  providerToken: string;
  whatsappJid?: string | null; // NOVO
  scopes: string[];
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
}
```

---

### Fase 4: Documentação da API

#### 4.1 Atualizar send-text.mdx

**Arquivo**: `api-docs/api-reference/messages/send-text.mdx`

```mdx
---
title: Send Text Message
api: POST /v1/messages/send
description: "Send a text message to a WhatsApp number"
---

## Request Body

<ParamField body="phone" type="string" required>
  Recipient phone number in international format without `+`
</ParamField>

<ParamField body="body" type="string" required>
  Message text content
</ParamField>

<ParamField body="from" type="string">
  **Optional.** Sender instance identifier. Can be:
  - WhatsApp phone number (e.g., `5585912345678`)
  - Instance UUID

  If not specified, uses the most recently connected instance.

  **Required for multi-instance organizations** to specify which number sends the message.
</ParamField>

<RequestExample>
```bash cURL
curl -X POST https://api.livchat.ai/v1/messages/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511999999999",
    "body": "Hello from LivChat!",
    "from": "5585912345678"
  }'
```
</RequestExample>
```

#### 4.2 Criar página de documentação sobre Multi-Instance

**Arquivo**: `api-docs/multi-instance.mdx` (NOVO)

```mdx
---
title: Multi-Instance Support
description: "Managing multiple WhatsApp numbers with a single API key"
---

# Multi-Instance Support

Organizations with multiple WhatsApp numbers can control which instance sends each message using the `from` parameter.

## How It Works

When your organization has multiple connected WhatsApp instances:

1. **Without `from`**: API selects the most recently connected instance
2. **With `from`**: API uses the specified instance

## Specifying the Sender

The `from` parameter accepts:

| Format | Example | Description |
|--------|---------|-------------|
| Phone number | `5585912345678` | WhatsApp number without `+` or `@` |
| Instance ID | `uuid-xxx-xxx` | Internal instance identifier |

## Example

```bash
# Send from specific number
curl -X POST https://api.livchat.ai/v1/messages/send \
  -H "Authorization: Bearer lc_live_xxx" \
  -d '{
    "phone": "5511999999999",
    "body": "Message from Sales",
    "from": "5585912345678"
  }'
```

## Listing Available Instances

Use the `/v1/instances` endpoint to list all instances available for your API key:

```bash
curl https://api.livchat.ai/v1/instances \
  -H "Authorization: Bearer lc_live_xxx"
```

Response:
```json
{
  "instances": [
    { "id": "uuid-1", "phone": "5585912345678", "name": "Sales" },
    { "id": "uuid-2", "phone": "5511987654321", "name": "Support" }
  ]
}
```
```

---

## Testes

### Testes Unitários

**Arquivo**: `workers/api-gateway/src/__tests__/instance-resolver.test.ts`

```typescript
import { resolveInstanceByFrom } from '../instance-resolver';

describe('resolveInstanceByFrom', () => {
  const instances = [
    { id: 'uuid-1', whatsappJid: '5585912345678@s.whatsapp.net', providerToken: 'token1' },
    { id: 'uuid-2', whatsappJid: '5511987654321@s.whatsapp.net', providerToken: 'token2' },
  ];

  it('should resolve by phone number', () => {
    const result = resolveInstanceByFrom('5585912345678', instances);
    expect(result?.id).toBe('uuid-1');
  });

  it('should resolve by instance ID', () => {
    const result = resolveInstanceByFrom('uuid-2', instances);
    expect(result?.id).toBe('uuid-2');
  });

  it('should return null for unknown from', () => {
    const result = resolveInstanceByFrom('unknown', instances);
    expect(result).toBeNull();
  });

  it('should handle phone with formatting', () => {
    const result = resolveInstanceByFrom('+55 85 91234-5678', instances);
    expect(result?.id).toBe('uuid-1');
  });
});
```

### Testes de Integração

```typescript
describe('API with from parameter', () => {
  it('should send from specified instance', async () => {
    const response = await fetch('/v1/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer lc_live_test_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: '5511999999999',
        body: 'Test message',
        from: '5585912345678',
      }),
    });

    expect(response.status).toBe(200);
    // Verificar que foi enviado da instância correta
  });

  it('should reject unauthorized instance', async () => {
    const response = await fetch('/v1/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer lc_live_test_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: '5511999999999',
        body: 'Test message',
        from: '5500000000000', // Instância não autorizada
      }),
    });

    expect(response.status).toBe(403);
  });
});
```

---

## Checklist de Implementação

### Fase 1: Frontend (URLs dinâmicas)
- [ ] Criar `app/src/lib/api-url.ts`
- [ ] Adicionar `NEXT_PUBLIC_API_URL` em `env.js`
- [ ] Atualizar `test-panel.tsx` com URL dinâmica e `from`
- [ ] Atualizar `mock-data.ts`
- [ ] Testar em localhost e preview

### Fase 2: API Gateway
- [ ] Criar `instance-resolver.ts`
- [ ] Atualizar `types.ts` com novos tipos
- [ ] Atualizar `router.ts` para extrair e usar `from`
- [ ] Atualizar `auth.ts` para passar `allowedInstances`
- [ ] Testes unitários

### Fase 3: Backend (Vercel)
- [ ] Atualizar `validate-key/route.ts`
- [ ] Criar `getOrganizationInstances()` em `api-key.ts`
- [ ] Atualizar tipos `ValidatedApiKey`
- [ ] Testes de integração

### Fase 4: Documentação
- [ ] Atualizar `send-text.mdx` com parâmetro `from`
- [ ] Atualizar todos os outros endpoints de mensagem
- [ ] Criar `multi-instance.mdx`
- [ ] Atualizar `authentication.mdx` com info sobre multi-instance

### Fase 5: Endpoint de Listagem (Opcional)
- [ ] Criar `GET /v1/instances` no API Gateway
- [ ] Documentar endpoint

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Breaking change para clientes existentes | Baixa | Médio | `from` é opcional, fallback mantém comportamento atual |
| Performance (query adicional) | Média | Baixo | Cache de instâncias no KV por 5min |
| Segurança (acesso a instância não autorizada) | Média | Alto | Validar `from` contra `allowedInstances` |
| Complexidade no gateway | Baixa | Médio | Código isolado em `instance-resolver.ts` |

---

## Estimativa de Esforço

| Fase | Complexidade | Tempo Estimado |
|------|--------------|----------------|
| Frontend (URLs) | Baixa | 2-3 horas |
| API Gateway | Média | 4-6 horas |
| Backend | Média | 3-4 horas |
| Documentação | Baixa | 2-3 horas |
| Testes | Média | 3-4 horas |
| **Total** | | **14-20 horas** |

---

## Decisões Pendentes

1. **Criar endpoint `/v1/instances`?** - Útil para clientes listarem instâncias disponíveis
2. **Suportar alias/nome da instância?** - Ex: `from: "vendas"` além de número/UUID
3. **Cache de instâncias no KV?** - Reduz latência mas adiciona complexidade de invalidação
4. **Header X-From como alternativa?** - Alguns clientes preferem headers a body params
