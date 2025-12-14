# Plan: Logger Estruturado para LivChat

> **Status:** PRONTO PARA IMPLEMENTAR
> **Objetivo:** Logs estruturados, desacoplados, prontos para escala
> **Provider atual:** Sentry (com opção de migrar para Axiom)

---

## 1. Contexto e Decisões

### 1.1 Problema Atual

Logs atuais são strings soltas:
```
[demo.status] Created NEW instance for device c301833b...
```

**Limitações:**
- Impossível filtrar por deviceId/userId no dashboard
- Sem métricas de tempo (quanto demora cada operação?)
- Sem correlação entre eventos
- Difícil debugar com milhares de usuários

### 1.2 Decisões Tomadas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| **Provider** | Sentry (atual) | Já configurado, errors + logs + replays |
| **Formato** | JSON estruturado | Filtrável no Sentry dashboard |
| **Acoplamento** | Interface abstrata | Fácil migrar para Axiom no futuro |
| **Terminal dev** | JSON também | Acompanhar tudo pelo Sentry |

### 1.3 Arquitetura

```
Código da aplicação
         ↓
   logger.info("message", { context })
         ↓
┌─────────────────────────────┐
│   src/server/lib/logger.ts  │
│   (interface abstrata)      │
└─────────────────────────────┘
         ↓
   console.log(JSON.stringify(payload))
         ↓
┌─────────────────────────────┐
│   Sentry captura via        │
│   consoleLoggingIntegration │
└─────────────────────────────┘
         ↓
   Dashboard Sentry (filtros, search)
```

---

## 2. Contextos Disponíveis

### 2.1 IDs Principais

| ID | Origem | Escopo | Persistência |
|----|--------|--------|--------------|
| `deviceId` | Cookie `livchat_device` | Navegador anônimo | 30 dias |
| `instanceId` | Criado em `instance.ts` | WhatsApp connection | Permanente |
| `userId` | Sync do Clerk | Usuário autenticado | Permanente |
| `organizationId` | Criado com user | Multi-tenant | Permanente |
| `requestPath` | tRPC context | Request atual | Request |

### 2.2 Metadados Úteis

| Campo | Origem | Uso |
|-------|--------|-----|
| `ipAddress` | Headers `x-forwarded-for` | Geolocalização, rate limiting |
| `userAgent` | Headers | Device type, debugging |
| `duration` | Medido no código | Performance monitoring |
| `reuseCount` | Campo na instance | Eficiência de reutilização |

---

## 3. Estrutura do Log

### 3.1 Schema JSON

```typescript
interface LogPayload {
  // Obrigatórios
  timestamp: string;        // ISO 8601
  level: "debug" | "info" | "warn" | "error";
  action: string;           // Ex: "demo.status", "orphan.reuse"
  message: string;          // Descrição legível

  // Contexto (quando disponível)
  deviceId?: string;
  instanceId?: string;
  userId?: string;
  organizationId?: string;

  // Métricas
  duration?: number;        // ms

  // Dados extras
  [key: string]: unknown;
}
```

### 3.2 Exemplo de Log

```json
{
  "timestamp": "2024-12-06T10:30:00.123Z",
  "level": "info",
  "action": "demo.status",
  "message": "Instance resolved",
  "deviceId": "c301833b-1234-5678-9abc-def012345678",
  "instanceId": "890a1344-abcd-efgh-ijkl-mnopqrstuvwx",
  "strategy": "orphan_reuse",
  "reuseCount": 3,
  "duration": 245
}
```

---

## 4. Ações e Prefixos

### 4.1 Lista Padronizada

| Action | Descrição | Dados Extras |
|--------|-----------|--------------|
| `device.create` | Novo device criado | `ipAddress`, `userAgent` |
| `device.reuse` | Device existente reutilizado | - |
| `instance.create` | Nova instance WuzAPI | `providerId` |
| `instance.resolve` | Instance encontrada/criada | `strategy`: connected/virgin/orphan/new |
| `orphan.search` | Buscando órfã virgem | `found`: boolean |
| `orphan.adopt` | Órfã adotada | `reuseCount` |
| `orphan.cleanup` | Batch de cleanup | `found`, `deleted` |
| `wuzapi.status` | Chamada getStatus | `connected`, `loggedIn`, `duration` |
| `wuzapi.connect` | Chamada connect | `duration` |
| `wuzapi.send` | Envio de mensagem | `messageId`, `phone`, `duration` |
| `wuzapi.logout` | Logout | `duration` |
| `user.sync` | Sync do Clerk | `isNew`: boolean |
| `user.claim` | Instances claimed | `count` |
| `demo.validate` | Validação de número | `status`, `variant` |
| `demo.send` | Mensagem enviada | `used`, `limit` |
| `auth.success` | Login bem-sucedido | - |
| `auth.error` | Erro de auth | `error` |

---

## 5. Implementação

### 5.1 Logger (`src/server/lib/logger.ts`)

```typescript
interface LogContext {
  deviceId?: string;
  instanceId?: string;
  userId?: string;
  organizationId?: string;
}

interface LogPayload extends LogContext {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  action: string;
  message: string;
  duration?: number;
  [key: string]: unknown;
}

// Emit function - trocar aqui para mudar provider
function emit(payload: LogPayload): void {
  console.log(JSON.stringify(payload));
}

class Logger {
  private context: LogContext = {};

  withContext(ctx: LogContext): Logger {
    const child = new Logger();
    child.context = { ...this.context, ...ctx };
    return child;
  }

  info(action: string, message: string, data?: object): void {
    this.log("info", action, message, data);
  }

  warn(action: string, message: string, data?: object): void {
    this.log("warn", action, message, data);
  }

  error(action: string, message: string, error?: Error, data?: object): void {
    const errorData = error ? {
      errorName: error.name,
      errorMessage: error.message,
    } : {};
    this.log("error", action, message, { ...errorData, ...data });
  }

  // Helper para medir tempo
  time<T>(action: string, message: string, fn: () => Promise<T>, data?: object): Promise<T> {
    const start = performance.now();
    return fn()
      .then((result) => {
        this.info(action, message, { ...data, duration: Math.round(performance.now() - start) });
        return result;
      })
      .catch((error) => {
        this.error(action, `${message} failed`, error, { ...data, duration: Math.round(performance.now() - start) });
        throw error;
      });
  }

  private log(level: LogPayload["level"], action: string, message: string, data?: object): void {
    emit({
      timestamp: new Date().toISOString(),
      level,
      action,
      message,
      ...this.context,
      ...data,
    });
  }
}

export const logger = new Logger();
```

### 5.2 Migração para Axiom (Futuro)

```typescript
// Só mudar a função emit:
import { Axiom } from "@axiomhq/js";

const axiom = new Axiom({ token: process.env.AXIOM_TOKEN });

function emit(payload: LogPayload): void {
  // Sentry continua capturando via console
  console.log(JSON.stringify(payload));

  // Axiom recebe direto (opcional, mais features)
  axiom.ingest("livchat-logs", [payload]);
}
```

---

## 6. Uso no Código

### 6.1 Antes vs Depois

**Antes:**
```typescript
console.log(`[demo.status] Created NEW instance for device ${device.id.slice(0, 8)}...`);
```

**Depois:**
```typescript
logger.info("instance.create", "Created new instance", {
  deviceId: device.id,
  instanceId: instance.id,
});
```

### 6.2 Com Contexto (Request-scoped)

```typescript
// No início do handler
const log = logger.withContext({
  deviceId: ctx.device?.id,
  userId: ctx.auth?.userId
});

// Uso
log.info("demo.status", "Resolving instance");
log.info("instance.resolve", "Instance found", { strategy: "orphan_reuse" });
```

### 6.3 Com Timing

```typescript
const statusRes = await log.time(
  "wuzapi.status",
  "Fetching WuzAPI status",
  () => client.getStatus(),
  { instanceId: instance.id }
);
```

---

## 7. Logs por Arquivo

### 7.1 `demo.ts` - Endpoints

| Local | Action | Message |
|-------|--------|---------|
| status:89-124 | `instance.resolve` | "Instance resolved" + strategy |
| status:130 | `wuzapi.status` | "WuzAPI status fetched" |
| status:134 | `wuzapi.connect` | "WuzAPI connected" |
| status:171-184 | `orphan.cleanup` | "Cleanup completed" |
| send:387 | `wuzapi.send` | "Message sent" |
| send:342 | `demo.send` | "Counter incremented" |
| validate:291 | `demo.validate` | "Number validated" |
| disconnect:433 | `wuzapi.logout` | "Logged out" |

### 7.2 `instance.ts` - Core Logic

| Local | Action | Message |
|-------|--------|---------|
| create:132 | `instance.create` | "Instance created in WuzAPI" |
| getOrReuse:359 | `orphan.search` | "Searching virgin orphan" |
| getOrReuse:413 | `orphan.adopt` | "Orphan adopted" |
| cleanup:449 | `orphan.cleanup` | "Starting cleanup batch" |
| cleanup:486 | `orphan.delete` | "Orphan deleted" |

### 7.3 `user.ts` - Auth

| Local | Action | Message |
|-------|--------|---------|
| sync:48 | `user.sync` | "User synced from Clerk" |
| sync:85 | `user.create` | "New user created" |
| sync:91 | `user.claim` | "Instances claimed" |

### 7.4 `trpc.ts` - Middleware

| Local | Action | Message |
|-------|--------|---------|
| device:46 | `device.create` | "Device created" |
| device:46 | `device.reuse` | "Device reused" |
| timing:129 | `trpc.request` | "Request completed" |
| auth:161 | `auth.error` | "Auth sync failed" |

---

## 8. Visualização no Sentry

### 8.1 Filtros Disponíveis

Com logs estruturados, no Sentry você pode:

```
action:demo.status AND deviceId:c301833b*
action:orphan.* AND duration:>1000
level:error AND action:wuzapi.*
userId:user_123 AND action:demo.send
```

### 8.2 Métricas Extraíveis

- **P95 de WuzAPI calls** → `action:wuzapi.* | avg(duration)`
- **Taxa de reuso de órfãs** → `action:orphan.adopt / action:instance.create`
- **Erros por action** → `level:error | group by action`

---

## 9. Ordem de Execução

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: Criar Logger                                            │
│  └── src/server/lib/logger.ts                                   │
│  └── Interface abstrata + emit via console.log                  │
├─────────────────────────────────────────────────────────────────┤
│  FASE 2: Migrar demo.ts                                          │
│  └── Substituir console.log por logger.info/warn/error          │
│  └── Adicionar timing em WuzAPI calls                           │
│  └── Adicionar contexto (deviceId, instanceId)                  │
├─────────────────────────────────────────────────────────────────┤
│  FASE 3: Migrar instance.ts                                      │
│  └── Logs de orphan reuse                                       │
│  └── Logs de cleanup                                            │
│  └── Timing de operações                                        │
├─────────────────────────────────────────────────────────────────┤
│  FASE 4: Migrar user.ts e trpc.ts                                │
│  └── Logs de auth                                               │
│  └── Logs de device                                             │
│  └── Request timing já existe, integrar                         │
├─────────────────────────────────────────────────────────────────┤
│  FASE 5: Validar no Sentry                                       │
│  └── Testar filtros                                             │
│  └── Verificar breadcrumbs                                      │
│  └── Confirmar métricas                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Critérios de Sucesso

- [ ] Todos os `console.log/warn/error` substituídos por `logger.*`
- [ ] Logs aparecem estruturados no Sentry
- [ ] Filtros por `deviceId`, `action`, `level` funcionam
- [ ] Timing de WuzAPI calls visível
- [ ] Breadcrumbs mostram trilha de eventos antes de erros
- [ ] Zero acoplamento direto com Sentry no código de negócio

---

## Changelog

- **2024-12-06**: Plano criado
  - Decisão: Sentry como provider, JSON estruturado
  - Investigação da codebase: 19 logs existentes mapeados
  - Definição de actions e schema
  - Interface desacoplada para migração futura
