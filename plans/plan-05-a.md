# Plan 05-a: Normalização de API (PascalCase → camelCase)

## Status: 🟡 EM PROGRESSO

**Dependências:**
- ✅ Plan 05: API Gateway + API Keys (Worker deployado)
- ✅ Cloudflare Workers funcionando em `api.livchat.ai`

**Objetivo:**
Transformar requests/responses entre camelCase (API pública) e PascalCase (WuzAPI) para oferecer uma experiência de desenvolvedor profissional e alinhada com padrões REST.

---

## 1. Situação Atual

### 1.1 Fluxo Atual (SEM transformação)

```
Cliente                          Worker                         WuzAPI
   │                               │                               │
   │  POST /v1/messages/send       │                               │
   │  { "Phone": "xxx" }           │   (pass-through)              │
   │  ─────────────────────────────►  ─────────────────────────────►
   │                               │                               │
   │  { "code": 200,               │                               │
   │    "data": { "Id": "xxx" } }  │                               │
   │  ◄─────────────────────────────  ◄─────────────────────────────
```

**Problema:** Cliente precisa usar PascalCase (padrão Go), não camelCase (padrão JS/REST).

### 1.2 Fluxo Desejado (COM transformação)

```
Cliente                          Worker                         WuzAPI
   │                               │                               │
   │  POST /v1/messages/send       │                               │
   │  { "phone": "xxx" }           │   Transforma para PascalCase  │
   │  ─────────────────────────────►  { "Phone": "xxx" }           │
   │                               │  ─────────────────────────────►
   │                               │                               │
   │  { "code": 200,               │   Transforma para camelCase   │
   │    "data": { "id": "xxx" } }  │  { "code": 200,               │
   │  ◄─────────────────────────────    "data": { "Id": "xxx" } }  │
   │                               │  ◄─────────────────────────────
```

---

## 2. Arquitetura da Solução

### 2.1 Estrutura de Arquivos

```
workers/api-gateway/src/
├── index.ts              # Entry point (modificar)
├── router.ts             # Route mapping (modificar)
├── transformers.ts       # NOVO: Funções de transformação
├── auth.ts               # Auth (sem mudanças)
├── rate-limit.ts         # Rate limit (sem mudanças)
└── types.ts              # Types (sem mudanças)

workers/api-gateway/test/
├── index.spec.ts         # Testes existentes
└── transformers.spec.ts  # NOVO: Testes de transformação
```

### 2.2 Fluxo no Worker

```typescript
// router.ts - Novo fluxo
async function routeRequest(request, keyData, env) {
  // 1. Parse body
  const body = await request.json();

  // 2. Transforma camelCase → PascalCase
  const transformedBody = toPascalCase(body);

  // 3. Faz request para WuzAPI
  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: JSON.stringify(transformedBody),
  });

  // 4. Parse response
  const responseBody = await response.json();

  // 5. Transforma PascalCase → camelCase
  const normalizedBody = toCamelCase(responseBody);

  // 6. Retorna response transformada
  return new Response(JSON.stringify(normalizedBody), { ... });
}
```

---

## 3. Mapeamento Completo de Campos

### 3.1 Mensagens (Messages)

| WuzAPI (PascalCase) | LivChat API (camelCase) | Tipo |
|---------------------|-------------------------|------|
| `Phone` | `phone` | string |
| `Body` | `body` | string |
| `Id` | `id` | string |
| `LinkPreview` | `linkPreview` | boolean |
| `Image` | `image` | string (base64) |
| `Caption` | `caption` | string |
| `Document` | `document` | string (base64) |
| `FileName` | `fileName` | string |
| `Video` | `video` | string (base64) |
| `Audio` | `audio` | string (base64) |
| `Sticker` | `sticker` | string (base64) |
| `PackId` | `packId` | string |
| `PackName` | `packName` | string |
| `PackPublisher` | `packPublisher` | string |
| `Emojis` | `emojis` | string[] |
| `PngThumbnail` | `pngThumbnail` | string (base64) |
| `Latitude` | `latitude` | number |
| `Longitude` | `longitude` | number |
| `Name` | `name` | string |
| `Vcard` | `vcard` | string |
| `ChatPhone` | `chatPhone` | string |
| `SenderPhone` | `senderPhone` | string |

### 3.2 ContextInfo (Respostas/Citações)

| WuzAPI (PascalCase) | LivChat API (camelCase) | Tipo |
|---------------------|-------------------------|------|
| `ContextInfo` | `contextInfo` | object |
| `ContextInfo.StanzaId` | `contextInfo.stanzaId` | string |
| `ContextInfo.Participant` | `contextInfo.participant` | string |

### 3.3 Session

| WuzAPI (PascalCase) | LivChat API (camelCase) | Tipo |
|---------------------|-------------------------|------|
| `Subscribe` | `subscribe` | string[] |
| `Immediate` | `immediate` | boolean |
| `Connected` | `connected` | boolean |
| `LoggedIn` | `loggedIn` | boolean |
| `QRCode` | `qrCode` | string (base64) |
| `LinkingCode` | `linkingCode` | string |

### 3.4 Users/Contacts

| WuzAPI (PascalCase) | LivChat API (camelCase) | Tipo |
|---------------------|-------------------------|------|
| `IsInWhatsapp` | `isInWhatsapp` | boolean |
| `JID` | `jid` | string |
| `Query` | `query` | string |
| `VerifiedName` | `verifiedName` | string |
| `Devices` | `devices` | string[] |
| `PictureID` | `pictureId` | string |
| `Status` | `status` | string |
| `BusinessName` | `businessName` | string |
| `FirstName` | `firstName` | string |
| `Found` | `found` | boolean |
| `FullName` | `fullName` | string |
| `PushName` | `pushName` | string |

### 3.5 Groups

| WuzAPI (PascalCase) | LivChat API (camelCase) | Tipo |
|---------------------|-------------------------|------|
| `GroupJID` | `groupJid` | string |
| `IsAdmin` | `isAdmin` | boolean |
| `IsSuperAdmin` | `isSuperAdmin` | boolean |
| `AnnounceVersionID` | `announceVersionId` | string |
| `DisappearingTimer` | `disappearingTimer` | number |
| `GroupCreated` | `groupCreated` | string (ISO) |
| `IsAnnounce` | `isAnnounce` | boolean |
| `IsEphemeral` | `isEphemeral` | boolean |
| `IsLocked` | `isLocked` | boolean |
| `NameSetAt` | `nameSetAt` | string (ISO) |
| `NameSetBy` | `nameSetBy` | string |
| `OwnerJID` | `ownerJid` | string |
| `ParticipantVersionID` | `participantVersionId` | string |
| `Participants` | `participants` | object[] |
| `Topic` | `topic` | string |
| `TopicID` | `topicId` | string |
| `TopicSetAt` | `topicSetAt` | string (ISO) |
| `TopicSetBy` | `topicSetBy` | string |
| `InviteLink` | `inviteLink` | string |

### 3.6 Response Wrapper

| WuzAPI (PascalCase) | LivChat API (camelCase) | Tipo |
|---------------------|-------------------------|------|
| `code` | `code` | number (manter) |
| `success` | `success` | boolean (manter) |
| `data` | `data` | object (transformar internamente) |
| `Details` | `details` | string |
| `Timestamp` | `timestamp` | string (ISO) |
| `Users` | `users` | object[] |

---

## 4. Implementação com TDD

### Fase 1: Funções de Transformação

#### 4.1.1 Criar `transformers.ts`

```typescript
// workers/api-gateway/src/transformers.ts

/**
 * Converte string de PascalCase para camelCase
 * "Phone" → "phone"
 * "IsInWhatsapp" → "isInWhatsapp"
 * "JID" → "jid" (caso especial: siglas)
 */
export function pascalToCamel(str: string): string {
  if (!str) return str;

  // Caso especial: siglas como JID, ID ficam minúsculas
  if (str === str.toUpperCase() && str.length <= 3) {
    return str.toLowerCase();
  }

  // Primeira letra minúscula, resto mantém
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Converte string de camelCase para PascalCase
 * "phone" → "Phone"
 * "isInWhatsapp" → "IsInWhatsapp"
 */
export function camelToPascal(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Transforma objeto recursivamente de PascalCase para camelCase
 * Usado para RESPONSES (WuzAPI → Cliente)
 */
export function toCamelCase<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item)) as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = pascalToCamel(key);
      result[newKey] = toCamelCase(value);
    }

    return result as T;
  }

  return obj;
}

/**
 * Transforma objeto recursivamente de camelCase para PascalCase
 * Usado para REQUESTS (Cliente → WuzAPI)
 */
export function toPascalCase<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => toPascalCase(item)) as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = camelToPascal(key);
      result[newKey] = toPascalCase(value);
    }

    return result as T;
  }

  return obj;
}
```

#### 4.1.2 Testes para `transformers.ts`

```typescript
// workers/api-gateway/test/transformers.spec.ts

import { describe, it, expect } from 'vitest';
import {
  pascalToCamel,
  camelToPascal,
  toCamelCase,
  toPascalCase,
} from '../src/transformers';

describe('transformers', () => {
  describe('pascalToCamel', () => {
    it('should convert simple PascalCase', () => {
      expect(pascalToCamel('Phone')).toBe('phone');
      expect(pascalToCamel('Body')).toBe('body');
      expect(pascalToCamel('Name')).toBe('name');
    });

    it('should convert multi-word PascalCase', () => {
      expect(pascalToCamel('IsInWhatsapp')).toBe('isInWhatsapp');
      expect(pascalToCamel('VerifiedName')).toBe('verifiedName');
      expect(pascalToCamel('LinkPreview')).toBe('linkPreview');
    });

    it('should handle acronyms (JID, ID)', () => {
      expect(pascalToCamel('JID')).toBe('jid');
      expect(pascalToCamel('ID')).toBe('id');
    });

    it('should handle empty/null', () => {
      expect(pascalToCamel('')).toBe('');
    });
  });

  describe('camelToPascal', () => {
    it('should convert simple camelCase', () => {
      expect(camelToPascal('phone')).toBe('Phone');
      expect(camelToPascal('body')).toBe('Body');
    });

    it('should convert multi-word camelCase', () => {
      expect(camelToPascal('isInWhatsapp')).toBe('IsInWhatsapp');
      expect(camelToPascal('verifiedName')).toBe('VerifiedName');
    });
  });

  describe('toCamelCase (object)', () => {
    it('should transform simple object', () => {
      const input = { Phone: '5511999999999', Body: 'Hello' };
      const expected = { phone: '5511999999999', body: 'Hello' };
      expect(toCamelCase(input)).toEqual(expected);
    });

    it('should transform nested object', () => {
      const input = {
        Phone: '5511999999999',
        ContextInfo: {
          StanzaId: 'xxx',
          Participant: 'yyy',
        },
      };
      const expected = {
        phone: '5511999999999',
        contextInfo: {
          stanzaId: 'xxx',
          participant: 'yyy',
        },
      };
      expect(toCamelCase(input)).toEqual(expected);
    });

    it('should transform array of objects', () => {
      const input = {
        Users: [
          { IsInWhatsapp: true, JID: 'xxx@s.whatsapp.net' },
          { IsInWhatsapp: false, JID: 'yyy@s.whatsapp.net' },
        ],
      };
      const expected = {
        users: [
          { isInWhatsapp: true, jid: 'xxx@s.whatsapp.net' },
          { isInWhatsapp: false, jid: 'yyy@s.whatsapp.net' },
        ],
      };
      expect(toCamelCase(input)).toEqual(expected);
    });

    it('should handle WuzAPI response format', () => {
      const input = {
        code: 200,
        success: true,
        data: {
          Details: 'Sent',
          Id: '90B2F8B13FAC8A9CF6B06E99C7834DC5',
          Timestamp: '2022-04-20T12:49:08-03:00',
        },
      };
      const expected = {
        code: 200,
        success: true,
        data: {
          details: 'Sent',
          id: '90B2F8B13FAC8A9CF6B06E99C7834DC5',
          timestamp: '2022-04-20T12:49:08-03:00',
        },
      };
      expect(toCamelCase(input)).toEqual(expected);
    });

    it('should handle null/undefined', () => {
      expect(toCamelCase(null)).toBeNull();
      expect(toCamelCase(undefined)).toBeUndefined();
    });

    it('should preserve primitive values', () => {
      expect(toCamelCase('string')).toBe('string');
      expect(toCamelCase(123)).toBe(123);
      expect(toCamelCase(true)).toBe(true);
    });
  });

  describe('toPascalCase (object)', () => {
    it('should transform simple object', () => {
      const input = { phone: '5511999999999', body: 'Hello' };
      const expected = { Phone: '5511999999999', Body: 'Hello' };
      expect(toPascalCase(input)).toEqual(expected);
    });

    it('should transform nested object', () => {
      const input = {
        phone: '5511999999999',
        contextInfo: {
          stanzaId: 'xxx',
          participant: 'yyy',
        },
      };
      const expected = {
        Phone: '5511999999999',
        ContextInfo: {
          StanzaId: 'xxx',
          Participant: 'yyy',
        },
      };
      expect(toPascalCase(input)).toEqual(expected);
    });

    it('should transform array of phones (common use case)', () => {
      const input = { phone: ['5511999999999', '5511888888888'] };
      const expected = { Phone: ['5511999999999', '5511888888888'] };
      expect(toPascalCase(input)).toEqual(expected);
    });

    it('should handle send message request', () => {
      const input = {
        phone: '5491155554444',
        body: 'Hello World',
        id: '90B2F8B13FAC8A9CF6B06E99C7834DC5',
      };
      const expected = {
        Phone: '5491155554444',
        Body: 'Hello World',
        Id: '90B2F8B13FAC8A9CF6B06E99C7834DC5',
      };
      expect(toPascalCase(input)).toEqual(expected);
    });

    it('should handle send image request', () => {
      const input = {
        phone: '5511999999999',
        caption: 'Look at this',
        image: 'data:image/jpeg;base64,xxx',
      };
      const expected = {
        Phone: '5511999999999',
        Caption: 'Look at this',
        Image: 'data:image/jpeg;base64,xxx',
      };
      expect(toPascalCase(input)).toEqual(expected);
    });
  });

  describe('real-world WuzAPI scenarios', () => {
    it('should transform check users response', () => {
      const wuzapiResponse = {
        code: 200,
        data: {
          Users: [
            {
              IsInWhatsapp: true,
              JID: '5491155554445@s.whatsapp.net',
              Query: '5491155554445',
              VerifiedName: 'Company Name',
            },
          ],
        },
        success: true,
      };

      const expected = {
        code: 200,
        data: {
          users: [
            {
              isInWhatsapp: true,
              jid: '5491155554445@s.whatsapp.net',
              query: '5491155554445',
              verifiedName: 'Company Name',
            },
          ],
        },
        success: true,
      };

      expect(toCamelCase(wuzapiResponse)).toEqual(expected);
    });

    it('should transform group info response', () => {
      const wuzapiResponse = {
        code: 200,
        data: {
          JID: '120362023605733675@g.us',
          Name: 'Super Group',
          OwnerJID: '5491155554444@s.whatsapp.net',
          GroupCreated: '2022-04-21T17:15:26-03:00',
          IsAnnounce: false,
          IsLocked: false,
          Participants: [
            {
              JID: '5491155554444@s.whatsapp.net',
              IsAdmin: true,
              IsSuperAdmin: true,
            },
          ],
        },
        success: true,
      };

      const result = toCamelCase(wuzapiResponse);

      expect(result.data.jid).toBe('120362023605733675@g.us');
      expect(result.data.name).toBe('Super Group');
      expect(result.data.ownerJid).toBe('5491155554444@s.whatsapp.net');
      expect(result.data.participants[0].isAdmin).toBe(true);
    });

    it('should transform session connect request', () => {
      const clientRequest = {
        subscribe: ['Message'],
        immediate: false,
      };

      const expected = {
        Subscribe: ['Message'],
        Immediate: false,
      };

      expect(toPascalCase(clientRequest)).toEqual(expected);
    });

    it('should transform mark read request', () => {
      const clientRequest = {
        id: ['AABBCCDD112233', 'IIOOPPLL43332'],
        chatPhone: '5491155553934',
        senderPhone: '5491155553935',
      };

      const expected = {
        Id: ['AABBCCDD112233', 'IIOOPPLL43332'],
        ChatPhone: '5491155553934',
        SenderPhone: '5491155553935',
      };

      expect(toPascalCase(clientRequest)).toEqual(expected);
    });
  });
});
```

### Fase 2: Integração no Router

#### 4.2.1 Modificar `router.ts`

```typescript
// workers/api-gateway/src/router.ts

import { toCamelCase, toPascalCase } from './transformers';

export async function routeRequest(
  request: Request,
  keyData: ApiKeyData,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const route = ROUTES[url.pathname];

  if (!route) {
    return errorResponse(404, `Endpoint not found: ${url.pathname}`);
  }

  if (!route.methods.includes(request.method)) {
    return errorResponse(405, `Method ${request.method} not allowed`);
  }

  // Verificar scope
  if (!hasScope(keyData.scopes, route.scope)) {
    return errorResponse(403, `Missing required scope: ${route.scope}`);
  }

  // Determinar backend URL
  const backendUrl = route.backend === 'wuzapi' ? env.WUZAPI_URL : env.VERCEL_URL;
  const targetUrl = `${backendUrl}${route.path}${url.search}`;

  // Preparar headers
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  if (route.backend === 'wuzapi') {
    headers.set('Token', keyData.providerToken);
  }

  headers.set('X-API-Key-ID', keyData.id);
  headers.set('X-Organization-ID', keyData.organizationId ?? '');
  if (keyData.instanceId) {
    headers.set('X-Instance-ID', keyData.instanceId);
  }

  // ═══════════════════════════════════════════════════════════════
  // TRANSFORMAÇÃO DE REQUEST (camelCase → PascalCase)
  // ═══════════════════════════════════════════════════════════════
  let body: string | null = null;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const jsonBody = await request.json();
      const transformedBody = toPascalCase(jsonBody);
      body = JSON.stringify(transformedBody);
    } catch {
      // Body vazio ou não-JSON, passa sem transformar
      body = await request.text();
    }
  }

  // Fazer request para backend
  const backendResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  // ═══════════════════════════════════════════════════════════════
  // TRANSFORMAÇÃO DE RESPONSE (PascalCase → camelCase)
  // ═══════════════════════════════════════════════════════════════
  const contentType = backendResponse.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const jsonResponse = await backendResponse.json();
      const transformedResponse = toCamelCase(jsonResponse);

      return new Response(JSON.stringify(transformedResponse), {
        status: backendResponse.status,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // Fallback: retorna response original
      return backendResponse;
    }
  }

  // Non-JSON response (ex: QR code image), passa direto
  return backendResponse;
}
```

### Fase 3: Testes de Integração

#### 4.3.1 Testes End-to-End do Router

```typescript
// workers/api-gateway/test/router.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('router with transformations', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should transform request body from camelCase to PascalCase', async () => {
    // Setup
    mockFetch.mockResolvedValueOnce(new Response(
      JSON.stringify({ code: 200, success: true, data: { Id: 'xxx' } }),
      { headers: { 'Content-Type': 'application/json' } }
    ));

    // Request com camelCase
    const request = new Request('https://api.livchat.ai/v1/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '5511999999999',
        body: 'Hello World',
      }),
    });

    // ... executa routeRequest ...

    // Verifica que fetch foi chamado com PascalCase
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          Phone: '5511999999999',
          Body: 'Hello World',
        }),
      })
    );
  });

  it('should transform response body from PascalCase to camelCase', async () => {
    // Setup: WuzAPI retorna PascalCase
    mockFetch.mockResolvedValueOnce(new Response(
      JSON.stringify({
        code: 200,
        success: true,
        data: {
          Details: 'Sent',
          Id: '90B2F8B13FAC8A9CF6B06E99C7834DC5',
          Timestamp: '2022-04-20T12:49:08-03:00',
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    ));

    // ... executa routeRequest ...
    // ... obtém response ...

    // Verifica que response está em camelCase
    const responseBody = await response.json();
    expect(responseBody).toEqual({
      code: 200,
      success: true,
      data: {
        details: 'Sent',
        id: '90B2F8B13FAC8A9CF6B06E99C7834DC5',
        timestamp: '2022-04-20T12:49:08-03:00',
      },
    });
  });

  it('should handle GET requests (no body transformation)', async () => {
    mockFetch.mockResolvedValueOnce(new Response(
      JSON.stringify({
        code: 200,
        data: { Connected: true, LoggedIn: true },
        success: true,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    ));

    // GET request (sem body)
    const request = new Request('https://api.livchat.ai/v1/session/status', {
      method: 'GET',
    });

    // ... executa ...

    // Response deve estar em camelCase
    const responseBody = await response.json();
    expect(responseBody.data.connected).toBe(true);
    expect(responseBody.data.loggedIn).toBe(true);
  });

  it('should pass through non-JSON responses (e.g., QR code)', async () => {
    const qrCodeBuffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG header
    mockFetch.mockResolvedValueOnce(new Response(
      qrCodeBuffer,
      { headers: { 'Content-Type': 'image/png' } }
    ));

    // ... executa ...

    // Response deve ser passada sem transformação
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });
});
```

---

## 5. Checklist de Implementação

### Fase 1: Funções de Transformação ✅
- [ ] Criar `workers/api-gateway/src/transformers.ts`
- [ ] Implementar `pascalToCamel(str)`
- [ ] Implementar `camelToPascal(str)`
- [ ] Implementar `toCamelCase(obj)` (recursivo)
- [ ] Implementar `toPascalCase(obj)` (recursivo)
- [ ] Criar `workers/api-gateway/test/transformers.spec.ts`
- [ ] Testes para strings simples
- [ ] Testes para objetos aninhados
- [ ] Testes para arrays
- [ ] Testes para casos especiais (JID, ID)
- [ ] Testes para cenários reais WuzAPI
- [ ] Rodar testes: `bun test`

### Fase 2: Integração no Router
- [ ] Modificar `router.ts` para importar transformers
- [ ] Adicionar transformação de request body
- [ ] Adicionar transformação de response body
- [ ] Manter passthrough para non-JSON (imagens, etc)
- [ ] Testes de integração

### Fase 3: Deploy e Validação
- [ ] Deploy para Cloudflare: `bun run deploy`
- [ ] Testar endpoint real com cURL
- [ ] Validar transformação bidirecional
- [ ] Atualizar documentação

---

## 6. Exemplos de Uso (Pós-Implementação)

### Request (Cliente envia camelCase)

```bash
curl -X POST https://api.livchat.ai/v1/messages/send \
  -H "Authorization: Bearer lc_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511999999999",
    "body": "Hello World!",
    "linkPreview": true
  }'
```

### Response (Cliente recebe camelCase)

```json
{
  "code": 200,
  "success": true,
  "data": {
    "details": "Sent",
    "id": "90B2F8B13FAC8A9CF6B06E99C7834DC5",
    "timestamp": "2024-01-15T10:30:00-03:00"
  }
}
```

### Interno (Worker transforma para WuzAPI)

```json
// Request para WuzAPI (PascalCase)
{
  "Phone": "5511999999999",
  "Body": "Hello World!",
  "LinkPreview": true
}

// Response do WuzAPI (PascalCase)
{
  "code": 200,
  "success": true,
  "data": {
    "Details": "Sent",
    "Id": "90B2F8B13FAC8A9CF6B06E99C7834DC5",
    "Timestamp": "2024-01-15T10:30:00-03:00"
  }
}
```

---

## 7. Considerações de Performance

- **Overhead mínimo**: Transformação é O(n) onde n = número de campos
- **Apenas JSON**: Non-JSON responses passam direto
- **Lazy parsing**: Só parseia body se necessário
- **No caching**: Transformação é stateless, não precisa cache

---

## 8. Critérios de Sucesso

1. ✅ Todos os testes passando
2. ✅ Requests em camelCase aceitos
3. ✅ Responses em camelCase retornados
4. ✅ Non-JSON (imagens) funcionando
5. ✅ Performance: < 5ms overhead
6. ✅ Zero breaking changes para WuzAPI interno
