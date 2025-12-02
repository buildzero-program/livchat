# Plan 02 - Integração WuzAPI

## Status: Implementado

---

## 1. Fluxo Validado - Endpoints WuzAPI

### 1.1 Autenticação

**Header para Admin (criar/gerenciar instâncias):**
```
Authorization: {WUZAPI_ADMIN_TOKEN}
```

**Header para Usuário (operações da instância):**
```
Token: {instance_token}
```

---

### 1.2 Criar Instância

```bash
POST /admin/users
Authorization: {ADMIN_TOKEN}
Content-Type: application/json

{
  "name": "instance-name",
  "token": "unique_token_for_instance",
  "webhook": "https://your-webhook.com/endpoint",
  "events": "Message"
}
```

**Response (201):**
```json
{
  "code": 201,
  "data": {
    "id": "96a97e091f32fe974a5ff7c2b0f73186",
    "name": "instance-name",
    "token": "unique_token_for_instance",
    "events": "Message",
    "webhook": "",
    "hmac_key": false,
    "expiration": 0,
    "proxy_config": { "enabled": false, "proxy_url": "" },
    "s3_config": { "enabled": false, ... }
  },
  "success": true
}
```

---

### 1.3 Conectar Instância

```bash
POST /session/connect
Token: {instance_token}
Content-Type: application/json

{
  "Subscribe": ["Message"],
  "Immediate": false
}
```

**Response (200):**
```json
{
  "code": 200,
  "data": {
    "details": "Connected!",
    "events": "Message",
    "jid": "",
    "webhook": ""
  },
  "success": true
}
```

---

### 1.4 Gerar QR Code

```bash
GET /session/qr
Token: {instance_token}
```

**Response (200):**
```json
{
  "code": 200,
  "data": {
    "QRCode": "data:image/png;base64,iVBORw0KGgo..."
  },
  "success": true
}
```

---

### 1.5 Gerar Pairing Code (Alternativa ao QR)

```bash
POST /session/pairphone
Token: {instance_token}
Content-Type: application/json

{
  "Phone": "5511948182061"
}
```

**Response (200):**
```json
{
  "code": 200,
  "data": {
    "LinkingCode": "V3X5-4GXY"
  },
  "success": true
}
```

**Uso:** No WhatsApp > Dispositivos Vinculados > Vincular com número

---

### 1.6 Verificar Status da Conexão

```bash
GET /session/status
Token: {instance_token}
```

**Response (200) - Conectado:**
```json
{
  "code": 200,
  "data": {
    "connected": true,
    "loggedIn": true,
    "jid": "5511948182061:91@s.whatsapp.net",
    "id": "96a97e091f32fe974a5ff7c2b0f73186",
    "name": "livchat",
    "events": "Message",
    "webhook": "",
    "history": "0",
    "hmac_configured": false,
    "proxy_config": { "enabled": false },
    "s3_config": { "enabled": false }
  },
  "success": true
}
```

**Estados:**
- `connected: false` → Não conectado ao WhatsApp
- `connected: true, loggedIn: false` → Aguardando scan do QR/Pairing
- `connected: true, loggedIn: true` → Pronto para enviar/receber

---

### 1.7 Verificar Números no WhatsApp

```bash
POST /user/check
Token: {instance_token}
Content-Type: application/json

{
  "Phone": ["5511948182061", "558588644401"]
}
```

**Response (200):**
```json
{
  "code": 200,
  "data": {
    "Users": [
      {
        "IsInWhatsapp": true,
        "JID": "5511948182061@s.whatsapp.net",
        "Query": "5511948182061",
        "VerifiedName": "Pedro Nascimento"
      },
      {
        "IsInWhatsapp": true,
        "JID": "558588644401@s.whatsapp.net",
        "Query": "558588644401",
        "VerifiedName": ""
      }
    ]
  },
  "success": true
}
```


---

### 1.8 Enviar Mensagem de Texto

```bash
POST /chat/send/text
Token: {instance_token}
Content-Type: application/json

{
  "Phone": "558588644401",
  "Body": "Sua mensagem aqui"
}
```

**Response (200):**
```json
{
  "code": 200,
  "data": {
    "Details": "Sent",
    "Id": "3EB0BA2F798EAF24F0D527",
    "Timestamp": 1764683267
  },
  "success": true
}
```

---

### 1.9 Desconectar (mantém sessão)

```bash
POST /session/disconnect
Token: {instance_token}
```

### 1.10 Logout (remove sessão, precisa re-escanear QR)

```bash
POST /session/logout
Token: {instance_token}
```

---

## 2. Arquitetura Proposta

### 2.1 Duas Instâncias WuzAPI

```
┌─────────────────────────────────────────────────────────────────┐
│                        LIVCHAT                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           INSTÂNCIA INTERNA (Validação)                 │   │
│  │                                                         │   │
│  │  Propósito: Verificar se números são WhatsApp válidos   │   │
│  │  Endpoint: POST /user/check                             │   │
│  │  Uso: Antes de criar instância do usuário               │   │
│  │  Token: WUZAPI_INTERNAL_TOKEN                           │   │
│  │                                                         │   │
│  │  Benefícios:                                            │   │
│  │  - Evita erros de envio para números inválidos          │   │
│  │  - Obtém nome verificado do contato                     │   │
│  │  - Não depende do usuário estar conectado               │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           INSTÂNCIAS PÚBLICAS (Usuários)                │   │
│  │                                                         │   │
│  │  Propósito: Conexão WhatsApp dos clientes               │   │
│  │  Fluxo:                                                 │   │
│  │    1. Usuário acessa landing page                       │   │
│  │    2. Clica "Testar agora"                              │   │
│  │    3. Sistema cria instância (POST /admin/users)        │   │
│  │    4. Conecta (POST /session/connect)                   │   │
│  │    5. Exibe QR ou Pairing Code                          │   │
│  │    6. Polling de status até loggedIn: true              │   │
│  │    7. Libera Test Panel para envio                      │   │
│  │                                                         │   │
│  │  Tokens: Gerados dinamicamente por sessão               │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Fluxo da Sessão Anônima (Landing Page)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Visitante  │     │   Next.js    │     │   WuzAPI     │
│   (Browser)  │     │   Backend    │     │   Server     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. Clica "Testar"  │                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ 2. Gera sessionId  │
       │                    │    + instanceToken │
       │                    │                    │
       │                    │ 3. POST /admin/users
       │                    │───────────────────>│
       │                    │                    │
       │                    │<───────────────────│
       │                    │    { id, token }   │
       │                    │                    │
       │                    │ 4. POST /session/connect
       │                    │───────────────────>│
       │                    │                    │
       │                    │ 5. GET /session/qr │
       │                    │   ou POST /pairphone
       │                    │───────────────────>│
       │                    │                    │
       │                    │<───────────────────│
       │                    │   { QRCode/Code }  │
       │                    │                    │
       │<───────────────────│                    │
       │  Exibe QR/Code     │                    │
       │                    │                    │
       │ 6. Polling status  │                    │
       │───────────────────>│                    │
       │                    │ GET /session/status│
       │                    │───────────────────>│
       │                    │                    │
       │                    │<───────────────────│
       │                    │ { loggedIn: true } │
       │                    │                    │
       │<───────────────────│                    │
       │  Libera Test Panel │                    │
       │                    │                    │
       │ 7. Envia mensagem  │                    │
       │───────────────────>│                    │
       │                    │ POST /chat/send/text
       │                    │───────────────────>│
       │                    │                    │
       │                    │<───────────────────│
       │                    │   { Sent, Id }     │
       │                    │                    │
       │<───────────────────│                    │
       │  Mostra sucesso    │                    │
       │                    │                    │
```

### 2.3 Validação de Número (Instância Interna)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Visitante  │     │   Next.js    │     │   WuzAPI     │
│              │     │   Backend    │     │  (Internal)  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ Digita número no   │                    │
       │ Test Panel         │                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ POST /user/check   │
       │                    │ (instância interna)│
       │                    │───────────────────>│
       │                    │                    │
       │                    │<───────────────────│
       │                    │ { IsInWhatsapp,    │
       │                    │   VerifiedName }   │
       │                    │                    │
       │<───────────────────│                    │
       │ Mostra status:     │                    │
       │ ✅ Válido (Nome)   │                    │
       │ ❌ Não é WhatsApp  │                    │
       │                    │                    │
```

---

## 3. Design da Interface de Conexão

### 3.1 Layout do Hero (QR + Pairing Code)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              ┌─────────────────────────┐                        │
│              │                         │                        │
│              │    [QR CODE REAL]       │  ← SEMPRE exibido      │
│              │                         │                        │
│              └─────────────────────────┘                        │
│                                                                 │
│              Escaneie com seu WhatsApp                          │
│                                                                 │
│         ─────────────── ou ───────────────                      │
│                                                                 │
│         Conecte pelo número:                                    │
│         [  +55 85 98864-4401        ] [Conectar ↵]              │
│                                                                 │
│         ┌─────────────────────────────────────┐                 │
│         │  Código: V3X5-4GXY                  │  ← Aparece      │
│         │                                     │    automaticamente│
│         │  WhatsApp > Dispositivos vinculados │    se válido    │
│         │  > Vincular com número              │                 │
│         └─────────────────────────────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Fluxo de Validação Inteligente ("Mágica")

```
USUÁRIO DIGITA NÚMERO
        │
        ▼
┌───────────────────┐
│ Debounce 500ms    │  ← Espera parar de digitar
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Formato válido?   │  ← Regex: 12-13 dígitos com código país
└───────────────────┘
        │
   SIM  │  NÃO → aguarda mais input
        ▼
┌───────────────────────────────────────┐
│ BACKGROUND: Verifica no WhatsApp      │
│                                       │
│ Se BR (55): checa AMBAS variantes     │
│   - Com 9:  55XX9XXXXXXXX             │
│   - Sem 9:  55XXXXXXXXXX              │
│                                       │
│ Se internacional: checa direto        │
└───────────────────────────────────────┘
        │
        ├──────────────────────────────────────┐
        │                                      │
        ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────┐
│ ÚNICO RESULTADO     │              │ AMBÍGUO ou INVÁLIDO │
│ (só com OU só sem 9)│              │                     │
└─────────────────────┘              └─────────────────────┘
        │                                      │
        ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────┐
│ MÁGICA: Gera code   │              │ Aguarda CLIQUE      │
│ automaticamente     │              │ no botão [Conectar] │
└─────────────────────┘              └─────────────────────┘
                                               │
                                               ▼
                                     ┌─────────────────────┐
                                     │ Após clique:        │
                                     │ - Ambíguo: usa o    │
                                     │   formato digitado  │
                                     │ - Inválido: erro    │
                                     └─────────────────────┘
```

### 3.3 Estados da UI

| Estado | Input | Indicador | Pairing Code | Botão |
|--------|-------|-----------|--------------|-------|
| IDLE | vazio/incompleto | — | oculto | disabled |
| VALIDATING | formato válido | ⏳ | oculto | disabled |
| VALID_UNIQUE | válido | ✅ | **EXIBIDO AUTO** | enabled |
| VALID_AMBIGUOUS | válido | ⚠️ (interno) | oculto | enabled |
| INVALID | inválido | — | oculto | enabled |
| ERROR | após clique | ❌ | oculto | enabled |

### 3.4 Lógica de Validação BR (9º Dígito)

```typescript
interface ValidationResult {
  status: 'valid_unique' | 'valid_ambiguous' | 'invalid';
  normalizedNumber: string | null;
  verifiedName: string | null;
  variants?: {
    with9: { exists: boolean; name: string | null };
    without9: { exists: boolean; name: string | null };
  };
}

async function validateBrazilianNumber(input: string): Promise<ValidationResult> {
  const clean = input.replace(/\D/g, '');

  // Verifica se é BR e mobile
  if (!clean.startsWith('55') || clean.length < 12 || clean.length > 13) {
    return validateInternational(clean);
  }

  const hasNine = clean.length === 13 && clean[4] === '9';

  // Gera variantes
  const with9 = hasNine ? clean : clean.slice(0, 4) + '9' + clean.slice(4);
  const without9 = hasNine ? clean.slice(0, 4) + clean.slice(5) : clean;

  // Verifica ambas em paralelo
  const [resultWith9, resultWithout9] = await Promise.all([
    checkWhatsApp(with9),
    checkWhatsApp(without9)
  ]);

  // Ambos existem = ambíguo
  if (resultWith9.exists && resultWithout9.exists) {
    return {
      status: 'valid_ambiguous',
      normalizedNumber: null, // Usuário decide ao clicar
      verifiedName: null,
      variants: {
        with9: { exists: true, name: resultWith9.name },
        without9: { exists: true, name: resultWithout9.name }
      }
    };
  }

  // Apenas um existe = único (MÁGICA!)
  if (resultWith9.exists) {
    return {
      status: 'valid_unique',
      normalizedNumber: with9,
      verifiedName: resultWith9.name
    };
  }

  if (resultWithout9.exists) {
    return {
      status: 'valid_unique',
      normalizedNumber: without9,
      verifiedName: resultWithout9.name
    };
  }

  // Nenhum existe
  return {
    status: 'invalid',
    normalizedNumber: null,
    verifiedName: null
  };
}
```

### 3.5 Regras de Decisão

| Cenário | Ação |
|---------|------|
| **Número único válido** | Gera pairing code automaticamente (mágica) |
| **Ambíguo (2 números BR)** | Aguarda clique, usa formato digitado pelo usuário |
| **Inválido** | Mostra erro após clique no botão |
| **Internacional** | Valida direto, se válido gera code auto |

---

## 4. Configuração Atual (Validada)

### 4.1 Variáveis de Ambiente (.env)

```env
# Server
WUZAPI_PORT=8080

# Admin Token
WUZAPI_ADMIN_TOKEN=19fb04327800b549a08bcf3442e285ae

# Encryption Key (32 caracteres)
WUZAPI_GLOBAL_ENCRYPTION_KEY=81326cb6f03eca97fd72902248f14dd0

# HMAC Key (mínimo 32 chars)
WUZAPI_GLOBAL_HMAC_KEY=022c4fba7ac7743f837f1c1279984e08dcd9da513ae2c18b

# Webhook
WEBHOOK_FORMAT=json
SESSION_DEVICE_NAME=LivChat
TZ=America/Sao_Paulo

# Database - Neon PostgreSQL
DB_USER=neondb_owner
DB_PASSWORD=npg_7xjdvD1omXfV
DB_NAME=neondb
DB_HOST=ep-wild-pine-ac3q5izv-pooler.sa-east-1.aws.neon.tech
DB_PORT=5432
DB_SSLMODE=require

# RabbitMQ - CloudAMQP (São Paulo)
RABBITMQ_URL=amqps://mesvtosg:j3EZKfHSYur50irfK-28Wg1AT3rzmkO3@jackal.rmq.cloudamqp.com/mesvtosg
RABBITMQ_QUEUE=whatsapp_events
```

### 4.2 Docker Compose (Local com Serverless)

```yaml
# docker-compose-local.yml
services:
  wuzapi:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${WUZAPI_PORT:-8080}:8080"
    env_file:
      - .env
    volumes:
      - wuzapi_sessions:/app/dbdata
    restart: unless-stopped

volumes:
  wuzapi_sessions:
```

### 4.3 Variáveis de Ambiente Next.js (app/.env.local)

```env
# WuzAPI
WUZAPI_URL=http://localhost:8080
WUZAPI_ADMIN_TOKEN=19fb04327800b549a08bcf3442e285ae

# Instância Interna (para validação de números)
WUZAPI_INTERNAL_TOKEN=internal_validation_token_2024
```

---

## 5. Arquitetura tRPC + Sessão Compartilhada

### 5.1 Modelo de Sessão (Demo)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SESSÃO ÚNICA COMPARTILHADA                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Visitante A ──┐                                                │
│                │      ┌─────────────┐     ┌─────────────┐      │
│  Visitante B ──┼─────►│   Next.js   │────►│   WuzAPI    │      │
│                │      │   (tRPC)    │     │ (instância  │      │
│  Visitante C ──┘      └─────────────┘     │    fixa)    │      │
│                                           └─────────────┘      │
│                                                                 │
│  • Todos veem o mesmo estado                                    │
│  • Se conectado → TestPanel disponível                          │
│  • Se não → QR Code + opção pairing code                        │
│  • Instância fixa: WUZAPI_DEMO_TOKEN                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 tRPC Router Structure

```typescript
// server/api/routers/demo.ts
export const demoRouter = createTRPCRouter({
  // Retorna status atual + QR se não conectado
  status: publicProcedure.query(async () => {
    // GET /session/status
    // Se não conectado, também busca QR
    return { connected, loggedIn, qrCode?, jid? }
  }),

  // Gera pairing code para número
  pairing: publicProcedure
    .input(z.object({ phone: z.string() }))
    .mutation(async ({ input }) => {
      // POST /session/pairphone
      return { pairingCode }
    }),

  // Valida número(s) no WhatsApp (instância interna)
  validate: publicProcedure
    .input(z.object({ phone: z.string() }))
    .mutation(async ({ input }) => {
      // Lógica BR: checa com/sem 9
      // POST /user/check (instância interna)
      return { status, normalizedNumber, verifiedName }
    }),

  // Envia mensagem de teste
  send: publicProcedure
    .input(z.object({ phone: z.string(), message: z.string() }))
    .mutation(async ({ input }) => {
      // POST /chat/send/text
      return { success, messageId }
    }),

  // Desconecta (logout)
  disconnect: publicProcedure.mutation(async () => {
    // POST /session/logout
    return { success }
  }),
});
```

### 5.3 Frontend Polling (React Query)

```typescript
// hooks/useDemo.ts
export function useDemo() {
  const utils = api.useUtils();

  // Polling de status (2s enquanto não conectado)
  const status = api.demo.status.useQuery(undefined, {
    refetchInterval: (data) =>
      data?.loggedIn ? false : 2000,  // Para quando conectar
  });

  // Mutations
  const pairing = api.demo.pairing.useMutation({
    onSuccess: () => utils.demo.status.invalidate(),
  });

  const validate = api.demo.validate.useMutation();

  const send = api.demo.send.useMutation();

  const disconnect = api.demo.disconnect.useMutation({
    onSuccess: () => utils.demo.status.invalidate(),
  });

  return { status, pairing, validate, send, disconnect };
}
```

### 5.4 Variáveis de Ambiente Atualizadas

```env
# app/.env.local

# WuzAPI Server
WUZAPI_URL=http://localhost:8080

# Instância Demo (fixa, compartilhada)
WUZAPI_DEMO_TOKEN=demo_livchat_2024

# Instância Interna (validação de números)
WUZAPI_INTERNAL_TOKEN=internal_validation_2024
```

---

## 6. Próximos Passos (TDD)

### Fase 1: Backend - tRPC Router Demo ✅
- [x] Criar `server/api/routers/demo.ts`
- [x] `demo.status` - Retorna status + QR se não conectado
- [x] `demo.pairing` - Gera pairing code para número
- [x] `demo.send` - Envia mensagem de teste
- [x] `demo.disconnect` - Desconecta (logout)
- [x] Testes unitários para cada procedure

### Fase 2: Backend - Validação de Números ✅
- [x] `demo.validate` - Verificar número no WhatsApp
- [x] Lógica de validação BR (checar ambas variantes com/sem 9)
- [x] Retornar status: `valid_unique` | `valid_ambiguous` | `invalid`
- [x] Testes para cenários BR e internacionais

### Fase 3: Frontend - Hook useDemo ✅
- [x] Criar `hooks/useDemo.ts`
- [x] Polling de status com React Query (2s)
- [x] Parar polling quando conectado
- [x] Expor mutations: pairing, validate, send, disconnect

### Fase 4: Frontend - Conexão QR ✅
- [x] Substituir QR mockado por real no Hero
- [x] Estados visuais: IDLE → SCANNING → CONNECTED
- [x] Transição automática para TestPanel quando conectado

### Fase 5: Frontend - Pairing Code (Mágica) ✅
- [x] Input de número abaixo do QR
- [x] Debounce 500ms + validação em background
- [x] Exibição automática se `valid_unique`
- [x] Aguardar clique se `valid_ambiguous`
- [x] Erro se inválido

### Fase 6: Frontend - Test Panel ✅
- [x] Conectar envio real com `demo.send`
- [x] Validação de número destino
- [x] Feedback visual sucesso/erro
- [x] Botão desconectar funcional

---

## 7. Observações Técnicas

### 7.1 Rate Limits
- Erro 479 = rate limit temporário do WhatsApp
- Implementar retry com backoff exponencial
- Cache de validações por 24h

### 7.2 Sessão WhatsApp
- `disconnect` mantém sessão (não precisa re-escanear)
- `logout` remove sessão (precisa novo QR)
- Sessões persistem no volume Docker

### 7.3 Encoding de Payload
- Usar `printf` com pipe para evitar problemas de encoding
- Ou usar arquivo JSON temporário
- Content-Type sempre `application/json`

---

## 8. Roadmap Futuro (Ideias)

### 8.1 Multi-tenant com Sessões Anônimas

```
┌─────────────────────────────────────────────────────────────────┐
│  SESSÃO ANÔNIMA COM COOKIE                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Visitante acessa → Cookie httpOnly com sessionId (UUID)        │
│                   → Cada sessionId = 1 instância WuzAPI         │
│                   → Refresh mantém sessão (cookie persiste)     │
│                   → Expira após 24h de inatividade              │
│                                                                 │
│  Migração para conta:                                           │
│  Sessão anônima → Usuário cria conta → Sessão "promovida"       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Pool de Instâncias (Performance)

```
┌─────────────────────────────────────────────────────────────────┐
│  POOL DE INSTÂNCIAS PRÉ-CRIADAS                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [inst-01: livre] [inst-02: ocupada] [inst-03: livre]          │
│                                                                 │
│  Visitante chega → Aloca instância do pool (instant!)           │
│  Visitante sai   → Devolve ao pool após timeout                 │
│                                                                 │
│  Benefício: Zero latência de criação                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Validação Distribuída (Anti Rate-Limit)

```
┌─────────────────────────────────────────────────────────────────┐
│  VALIDAÇÃO VIA USUÁRIOS CONECTADOS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Em vez de 1 instância interna fazendo todos os /user/check:    │
│                                                                 │
│  [User-A conectado] ─┐                                          │
│  [User-B conectado] ─┼──► Round-robin /user/check               │
│  [User-C conectado] ─┘    (distribuído, sem ban)                │
│                                                                 │
│  Cada usuário contribui com ~1 check/minuto                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 Real-time com PartyKit (Vercel-compatible)

```
┌─────────────────────────────────────────────────────────────────┐
│  ARQUITETURA COM PARTYKIT                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐  │
│  │ Browser │◄───►│PartyKit │◄────│ Next.js │◄────│ WuzAPI  │  │
│  │  (WS)   │     │ (edge)  │     │ (Vercel)│     │(webhook)│  │
│  └─────────┘     └─────────┘     └─────────┘     └─────────┘  │
│                                                                 │
│  Fluxo:                                                         │
│  1. WuzAPI envia webhook para Next.js                           │
│  2. Next.js publica evento no PartyKit                          │
│  3. PartyKit faz broadcast via WebSocket                        │
│  4. Browser recebe em real-time (sem polling!)                  │
│                                                                 │
│  Eventos real-time:                                             │
│  - QR escaneado (connected)                                     │
│  - Mensagem recebida                                            │
│  - Desconexão                                                   │
│                                                                 │
│  Nota: Vercel não suporta WebSocket nativo, PartyKit resolve    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Apêndice A: Melhorias Pendentes (v2)

### A.1 Criação Automática de Instância Demo

**Problema Atual:**
- O sistema assume que já existe uma instância WuzAPI configurada
- Se não existir, o QR code não é exibido (erro 401/500)
- O usuário precisa criar manualmente via admin API

**Solução Proposta:**

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUXO DE CRIAÇÃO AUTOMÁTICA DE INSTÂNCIA                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuário acessa landing page                                 │
│  2. Frontend chama demo.status                                  │
│  3. Backend verifica se instância demo existe:                  │
│     - SIM → retorna status + QR se não logado                   │
│     - NÃO → cria instância automaticamente:                     │
│       a. POST /admin/users (criar instância)                    │
│       b. POST /session/connect (conectar)                       │
│       c. GET /session/qr (obter QR)                             │
│       d. Retorna QR para frontend                               │
│                                                                 │
│  4. Instância criada é COMPARTILHADA (todos veem mesmo QR)      │
│  5. Depois de conectada, todos podem enviar mensagens           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementação:**

```typescript
// demo.ts - novo fluxo de status
status: publicProcedure.query(async () => {
  const client = getDemoClient();

  try {
    const status = await client.getStatus();
    // Instância existe, continua normalmente...
  } catch (error) {
    if (error.status === 401) {
      // Instância não existe, criar automaticamente
      await createDemoInstance();
      // Tentar novamente
      return await getDemoStatus();
    }
    throw error;
  }
});

async function createDemoInstance() {
  const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
  const demoToken = process.env.WUZAPI_DEMO_TOKEN;

  // 1. Criar instância
  await fetch(`${WUZAPI_URL}/admin/users`, {
    method: 'POST',
    headers: { Authorization: adminToken },
    body: JSON.stringify({
      name: 'demo',
      token: demoToken,
      events: 'Message',
    }),
  });

  // 2. Conectar
  await fetch(`${WUZAPI_URL}/session/connect`, {
    method: 'POST',
    headers: { Token: demoToken },
    body: JSON.stringify({ Subscribe: ['Message'], Immediate: false }),
  });
}
```

**Variáveis de Ambiente Necessárias:**
```env
WUZAPI_ADMIN_TOKEN=xxx    # Para criar instâncias
WUZAPI_DEMO_TOKEN=xxx     # Token da instância demo
```

---

### A.2 Bug na Normalização de Números BR

**Problema Atual:**
- Usuário digita `+55 85 8864-4401` (número que EXISTE)
- Sistema verifica AMBAS variantes em paralelo: com 9 e sem 9
- Se a variante COM 9 existir, usa ela automaticamente
- Mensagem é enviada para `5585988644401` (pessoa DIFERENTE!)
- Completamente quebrado - "corrige" algo que já estava certo

**Comportamento Atual (ERRADO):**
```typescript
// Verifica ambas variantes em paralelo
const [resultWith9, resultWithout9] = await Promise.all([...]);

// Se COM 9 existir, usa COM 9 (mesmo que SEM 9 também exista!)
if (with9Exists) {
  return { normalizedNumber: variants.with9 }; // ERRADO!
}
```

**Solução Correta:**

A normalização só deve acontecer se o número digitado **LITERALMENTE NÃO EXISTIR**.

```typescript
async function validateBrazilianNumber(input: string): Promise<ValidationResult> {
  const clean = input.replace(/\D/g, '');

  // PASSO 1: Verificar o número EXATAMENTE como digitado
  const exactResult = await checkWhatsApp(clean);

  if (exactResult.exists) {
    // Número existe como digitado - NÃO MODIFICAR
    return {
      status: 'valid_unique',
      normalizedNumber: clean, // Usar exatamente o que foi digitado
      verifiedName: exactResult.name,
    };
  }

  // PASSO 2: Número não existe - tentar variante BR (com/sem 9)
  if (isBrazilianNumber(clean)) {
    const variant = getAlternativeVariant(clean); // com ou sem 9
    const variantResult = await checkWhatsApp(variant);

    if (variantResult.exists) {
      // Variante existe - avisar usuário
      return {
        status: 'valid_variant', // Novo status!
        normalizedNumber: variant,
        originalNumber: clean,
        verifiedName: variantResult.name,
        message: `Número não encontrado, mas ${formatPhone(variant)} existe`,
      };
    }
  }

  // PASSO 3: Nenhuma variante existe
  return {
    status: 'invalid',
    normalizedNumber: null,
    verifiedName: null,
  };
}
```

**Fluxo Correto:**
```
Usuário digita: 558588644401

1. Verifica 558588644401 no WhatsApp
   - SE EXISTE → usa 558588644401 (fim!)
   - SE NÃO EXISTE → continua...

2. Gera variante: 5585988644401 (com 9)
   - SE EXISTE → retorna com aviso "você quis dizer...?"
   - SE NÃO EXISTE → inválido
```

**Princípio:** Nunca "corrigir" um número que já funciona.

---

### A.3 Persistência de Estado no Navegador

**Problema Atual:**
- Ao recarregar página, sempre mostra loading → QR → TestPanel
- Flash visual ruim quando já está conectado
- Não lembra estado anterior

**Solução Proposta:**

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUXO COM PERSISTÊNCIA LOCAL                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Página carrega                                              │
│  2. Verifica localStorage:                                      │
│     - lastState: { loggedIn, jid }                              │
│                                                                 │
│  3. Se lastState.loggedIn:                                      │
│     → Renderiza TestPanel imediatamente (otimista)              │
│     → Faz query ao backend em background                        │
│     → Se backend disser desconectado → troca para QrCard        │
│                                                                 │
│  4. Se !lastState.loggedIn:                                     │
│     → Mostra QrCard imediatamente                               │
│     → Polling busca QR code real                                │
│                                                                 │
│  5. Após resposta do backend:                                   │
│     → Atualiza localStorage com novo estado                     │
│     → Corrige UI se estado mudou                                │
│                                                                 │
│  6. No logout:                                                  │
│     → Limpa localStorage                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Por que SEM TTL?**
- O usuário pode ficar conectado por dias, semanas, meses
- O cache local é apenas para evitar flash visual no reload
- O backend SEMPRE é consultado para validar o estado real
- Se o backend disser que está desconectado, atualizamos o cache
- TTL curto (5min) forçaria flash visual desnecessário

**Implementação no Hook:**

```typescript
// hooks/useDemo.ts
const STORAGE_KEY = 'livchat_demo_state';

interface CachedState {
  loggedIn: boolean;
  jid?: string;
}

export function useDemo(): UseDemoReturn {
  // Estado otimista do localStorage (sem TTL!)
  const [optimisticState, setOptimisticState] = useState<CachedState | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) return null;
      return JSON.parse(cached) as CachedState;
    } catch {
      return null;
    }
  });

  const statusQuery = api.demo.status.useQuery(undefined, {
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.loggedIn) return 2000;
      return 10000;
    },
    onSuccess: (data) => {
      // Atualiza cache local com estado real do backend
      const newState: CachedState = {
        loggedIn: data.loggedIn,
        jid: data.jid,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      setOptimisticState(newState);
    },
  });

  // Usa estado otimista enquanto carrega
  const isLoggedIn = statusQuery.isLoading && optimisticState
    ? optimisticState.loggedIn
    : statusQuery.data?.loggedIn ?? false;

  // No logout, limpar cache
  const disconnectMutation = api.demo.disconnect.useMutation({
    onSuccess: () => {
      localStorage.removeItem(STORAGE_KEY);
      setOptimisticState(null);
      void statusQuery.refetch();
    },
  });

  return {
    isConnected: statusQuery.data?.connected ?? optimisticState?.loggedIn ?? false,
    isLoggedIn,
    // ... resto
  };
}
```

**Benefícios:**
- Zero flash visual quando já conectado
- UX muito mais fluida
- Funciona para sessões de qualquer duração (dias, meses)
- Backend sempre valida e corrige se necessário
- Logout limpa cache corretamente

---

### A.4 Checklist de Implementação

**Fase 1: Criação Automática de Instância**
- [ ] Adicionar função `createDemoInstance()` no backend
- [ ] Modificar `demo.status` para criar instância se não existir
- [ ] Adicionar tratamento de erro 401
- [ ] Adicionar método `connect()` no WuzAPIClient
- [ ] Testes para criação automática

**Fase 2: Correção de Normalização BR**
- [ ] Refatorar `demo.validate` para verificar número EXATO primeiro
- [ ] Só tentar variante se número exato não existir
- [ ] Adicionar status `valid_variant` para quando usar variante
- [ ] Mostrar aviso na UI "você quis dizer X?"
- [ ] Testes para todos os cenários:
  - Número exato existe → usar exato
  - Número exato não existe, variante existe → avisar e usar variante
  - Nenhum existe → inválido

**Fase 3: Persistência de Estado**
- [ ] Implementar cache no localStorage (sem TTL)
- [ ] Estado otimista no useDemo
- [ ] Sincronização com backend
- [ ] Limpar cache em logout
- [ ] Testes para persistência

---

### 8.5 Limites e Monetização

```
┌─────────────────────────────────────────────────────────────────┐
│  TIERS DE USO                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FREE (Anônimo):                                                │
│  - 10 mensagens/dia                                             │
│  - Sessão expira em 1h                                          │
│  - Sem histórico                                                │
│                                                                 │
│  STARTER (Conta):                                               │
│  - 100 mensagens/dia                                            │
│  - Sessão persistente                                           │
│  - Histórico 7 dias                                             │
│                                                                 │
│  PRO (Pago):                                                    │
│  - Mensagens ilimitadas                                         │
│  - Múltiplas instâncias                                         │
│  - Webhooks personalizados                                      │
│  - API access                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
