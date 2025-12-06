# Plan 04.1-C: Reutilização Segura de Instances Órfãs

> **Status:** ✅ IMPLEMENTADO (2024-12-05)
> **Dependências:** plan-04.1 (concluído)
> **Objetivo:** Reutilizar instances WhatsApp órfãs com segurança de token
> **Threshold:** 8 horas de inatividade

---

## 1. Problema

### 1.1 Situação Atual

```
Visitante A acessa LP → Device A criado → Instance A criada no WuzAPI
                                              ↓
                           Visitante A sai sem escanear QR
                                              ↓
                           Instance A fica órfã PARA SEMPRE
                                              ↓
Visitante B acessa LP → Device B criado → Instance B criada (NOVA!)
                                              ↓
                           ... ciclo infinito de lixo
```

### 1.2 Problema de Segurança Identificado

**O `apiKey` (providerToken) é exposto ao cliente em TODA chamada de `demo.status`:**

```typescript
// ATUAL - INSEGURO
return {
  apiKey: instance.providerToken,  // ← Vazado ANTES de conectar!
  // ...
};
```

**Consequências:**
- Qualquer instance que teve `demo.status` chamado teve token exposto
- Se instance foi conectada (`whatsappJid != NULL`), token foi **definitivamente** usado
- Reutilizar instance "abusada" = risco de segurança (token vazado)
- WuzAPI **NÃO permite trocar token** de user existente

---

## 2. Classificação de Instances

### 2.1 Tipos de Instance

| Tipo | Condição | Pode Reutilizar? | Ação |
|------|----------|------------------|------|
| **Virgem** | `whatsappJid IS NULL` E `createdAt < 8h` | ✅ SIM | Adotar |
| **Abusada** | `whatsappJid IS NOT NULL` E órfã | ❌ NÃO | Deletar (token vazou) |
| **Ativa** | `organizationId IS NOT NULL` | ❌ NÃO | Pertence a usuário |
| **Recente** | `createdAt > 8h` | ❌ NÃO | Ainda em uso potencial |

### 2.2 Critérios de Órfã VIRGEM (Reutilizável)

```sql
-- Instance pode ser reutilizada SE:
organization_id IS NULL              -- Não pertence a ninguém
AND whatsapp_jid IS NULL             -- NUNCA conectou (token não vazou de verdade)
AND status = 'disconnected'          -- Não está tentando conectar
AND created_at < NOW() - INTERVAL '8 hours'  -- Criada há 8h+ (abandonada)
```

### 2.3 Critérios de Órfã ABUSADA (Deletar)

```sql
-- Instance deve ser DELETADA SE:
organization_id IS NULL              -- Não pertence a ninguém
AND whatsapp_jid IS NOT NULL         -- JÁ conectou (token vazou!)
AND created_at < NOW() - INTERVAL '8 hours'  -- Abandonada há 8h+
```

---

## 3. Solução Segura

### 3.1 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVICE ACESSA APLICAÇÃO                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Busca instance DO PRÓPRIO device                            │
│     WHERE createdByDeviceId = device.id                         │
│     AND organizationId IS NULL                                  │
│                                                                 │
│     Encontrou E whatsappJid IS NULL? → Usa ela ✓                │
│     Encontrou E whatsappJid IS NOT NULL? → Ignora (abusada)     │
└─────────────────────────────────────────────────────────────────┘
                              │ Não tem virgem própria
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Busca órfã VIRGEM de outro device                           │
│     WHERE organizationId IS NULL                                │
│     AND whatsappJid IS NULL                                     │
│     AND createdAt < NOW() - 8h                                  │
│                                                                 │
│     Encontrou? → Adota ela ✓                                    │
│                  (logout WuzAPI, reset, atribui ao device)      │
└─────────────────────────────────────────────────────────────────┘
                              │ Não tem órfã virgem
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Cria instance NOVA no WuzAPI                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. RETORNA QR ao cliente (SEM apiKey!)                         │
│     → UX PRIMEIRO: resposta rápida                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. BACKGROUND: Cleanup de órfãs ABUSADAS                       │
│     → Deleta instances com whatsappJid != NULL E órfãs 8h+      │
│     → Não bloqueia response                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Cliente conecta (escaneia QR, loggedIn = true)              │
│     → AGORA SIM retorna apiKey                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Mudança Crítica: apiKey só após conectar

**ANTES (inseguro):**
```typescript
return {
  apiKey: instance.providerToken,  // ← Sempre exposto
  loggedIn: false,
  // ...
};
```

**DEPOIS (seguro):**
```typescript
return {
  apiKey: statusRes.data.loggedIn ? instance.providerToken : undefined,  // ← Só após conectar
  loggedIn: statusRes.data.loggedIn,
  // ...
};
```

---

## 4. Implementação

### Fase 1: Atualizar Schema

**Arquivo:** `src/server/db/schema.ts`

```typescript
// Adicionar aos campos existentes de instances:

// Tracking de atividade
lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
  .defaultNow()
  .notNull(),

// Contador de reutilizações (métricas)
reuseCount: integer("reuse_count").notNull().default(0),
```

**Índice otimizado:**

```typescript
// Adicionar ao array de índices:
index("idx_instance_orphan_virgin").on(
  t.organizationId,
  t.whatsappJid,
  t.createdAt
),
```

---

### Fase 2: Função getOrReuseVirginOrphan

**Arquivo:** `src/server/lib/instance.ts`

```typescript
import { sql, and, eq, isNull, lt, ne, or, asc } from "drizzle-orm";

const ORPHAN_THRESHOLD_HOURS = 8;

/**
 * Busca instance órfã VIRGEM (nunca conectou) e a adota.
 *
 * Critérios:
 * - organizationId IS NULL (não claimed)
 * - whatsappJid IS NULL (NUNCA conectou - token não vazou)
 * - createdAt < NOW() - 8h (abandonada)
 * - status = 'disconnected'
 *
 * NÃO reutiliza instances que já conectaram (token vazado).
 */
export async function getOrReuseVirginOrphan(
  deviceId: string
): Promise<InstanceWithClient | null> {
  const thresholdDate = new Date();
  thresholdDate.setHours(thresholdDate.getHours() - ORPHAN_THRESHOLD_HOURS);

  return db.transaction(async (tx) => {
    // Buscar órfã VIRGEM mais antiga
    const orphan = await tx.query.instances.findFirst({
      where: and(
        isNull(instances.organizationId),      // Não claimed
        isNull(instances.whatsappJid),          // NUNCA conectou (crítico!)
        eq(instances.status, "disconnected"),
        lt(instances.createdAt, thresholdDate), // Criada há 8h+
        // Não pegar a do próprio device
        or(
          isNull(instances.createdByDeviceId),
          ne(instances.createdByDeviceId, deviceId)
        )
      ),
      orderBy: [asc(instances.createdAt)], // Mais antiga primeiro (FIFO)
    });

    if (!orphan) {
      return null;
    }

    // Fazer logout no WuzAPI (limpa QR pendente)
    try {
      const client = new WuzAPIClient({
        baseUrl: WUZAPI_BASE_URL,
        token: orphan.providerToken,
      });
      await client.logout();
    } catch (error) {
      // Ignorar erro (pode já estar desconectada)
      console.warn(`[orphan-reuse] Logout failed for ${orphan.id}:`, error);
    }

    // Adotar a órfã
    const [adopted] = await tx
      .update(instances)
      .set({
        createdByDeviceId: deviceId,
        status: "disconnected",
        lastConnectedAt: null,
        messagesUsedToday: 0,
        lastMessageAt: null,
        lastMessageResetAt: new Date(),
        reuseCount: sql`${instances.reuseCount} + 1`,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(instances.id, orphan.id))
      .returning();

    if (!adopted) {
      return null; // Race condition - outra transação pegou
    }

    console.log(
      `[orphan-reuse] Device ${deviceId.slice(0, 8)}... adopted virgin orphan ${adopted.id} (reuse #${adopted.reuseCount})`
    );

    const client = new WuzAPIClient({
      baseUrl: WUZAPI_BASE_URL,
      token: adopted.providerToken,
    });

    return { instance: adopted, client };
  });
}
```

---

### Fase 3: Função cleanupAbusedOrphans (Background)

**Arquivo:** `src/server/lib/instance.ts`

```typescript
/**
 * Deleta órfãs "abusadas" (que já conectaram - token vazou).
 * Roda em BACKGROUND após retornar response ao cliente.
 *
 * Critérios para deletar:
 * - organizationId IS NULL (não claimed)
 * - whatsappJid IS NOT NULL (já conectou - token vazado!)
 * - createdAt < NOW() - 8h (abandonada)
 */
export async function cleanupAbusedOrphans(): Promise<number> {
  const thresholdDate = new Date();
  thresholdDate.setHours(thresholdDate.getHours() - ORPHAN_THRESHOLD_HOURS);

  try {
    // Buscar órfãs abusadas
    const abused = await db.query.instances.findMany({
      where: and(
        isNull(instances.organizationId),
        isNotNull(instances.whatsappJid),  // JÁ CONECTOU (token vazou)
        lt(instances.createdAt, thresholdDate)
      ),
      limit: 10, // Processar em batches pequenos
    });

    if (abused.length === 0) {
      return 0;
    }

    let deletedCount = 0;

    for (const orphan of abused) {
      try {
        // Fazer logout no WuzAPI
        const client = new WuzAPIClient({
          baseUrl: WUZAPI_BASE_URL,
          token: orphan.providerToken,
        });

        try {
          await client.logout();
        } catch {
          // Ignorar erro de logout
        }

        // Deletar user no WuzAPI (via admin API)
        try {
          await fetch(`${WUZAPI_BASE_URL}/admin/users/${orphan.providerId}`, {
            method: "DELETE",
            headers: { Authorization: WUZAPI_ADMIN_TOKEN },
          });
        } catch {
          // Ignorar erro de delete no WuzAPI
        }

        // Deletar do banco
        await db.delete(instances).where(eq(instances.id, orphan.id));
        deletedCount++;

        console.log(`[cleanup] Deleted abused orphan ${orphan.id} (token was leaked)`);
      } catch (error) {
        console.error(`[cleanup] Failed to delete ${orphan.id}:`, error);
      }
    }

    return deletedCount;
  } catch (error) {
    console.error("[cleanup] Error in cleanupAbusedOrphans:", error);
    return 0;
  }
}
```

---

### Fase 4: Atualizar getDeviceInstance

**Arquivo:** `src/server/lib/instance.ts`

```typescript
/**
 * Busca instance do device.
 *
 * IMPORTANTE: Só retorna se for VIRGEM (whatsappJid IS NULL).
 * Se já conectou antes, ignora (token vazou, precisa criar nova).
 */
export async function getDeviceInstance(
  deviceId: string
): Promise<InstanceWithClient | null> {
  const instance = await db.query.instances.findFirst({
    where: and(
      eq(instances.createdByDeviceId, deviceId),
      isNull(instances.organizationId),
      isNull(instances.whatsappJid)  // CRÍTICO: só virgem!
    ),
  });

  if (!instance) return null;

  // Atualizar lastActivityAt
  await db
    .update(instances)
    .set({ lastActivityAt: new Date() })
    .where(eq(instances.id, instance.id));

  const client = new WuzAPIClient({
    baseUrl: WUZAPI_BASE_URL,
    token: instance.providerToken,
  });

  return { instance, client };
}

/**
 * Busca instance CONECTADA do device (para quando já logou).
 */
export async function getConnectedDeviceInstance(
  deviceId: string
): Promise<InstanceWithClient | null> {
  const instance = await db.query.instances.findFirst({
    where: and(
      eq(instances.createdByDeviceId, deviceId),
      isNull(instances.organizationId),
      isNotNull(instances.whatsappJid)  // Já conectou
    ),
  });

  if (!instance) return null;

  // Atualizar lastActivityAt
  await db
    .update(instances)
    .set({ lastActivityAt: new Date() })
    .where(eq(instances.id, instance.id));

  const client = new WuzAPIClient({
    baseUrl: WUZAPI_BASE_URL,
    token: instance.providerToken,
  });

  return { instance, client };
}
```

---

### Fase 5: Modificar demo.status

**Arquivo:** `src/server/api/routers/demo.ts`

```typescript
import {
  getDeviceInstance,
  getConnectedDeviceInstance,
  getOrReuseVirginOrphan,
  createInstanceForDevice,
  cleanupAbusedOrphans,
  syncInstanceStatus,
  canSendMessage,
} from "~/server/lib/instance";

// ...

status: publicProcedure.query(async ({ ctx }) => {
  const { device } = ctx;

  if (!device) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Device não identificado. Habilite cookies.",
    });
  }

  // 1. Buscar instance CONECTADA do device (já logou antes)
  let instanceData = await getConnectedDeviceInstance(device.id);

  // 2. Se não tem conectada, buscar VIRGEM do device
  if (!instanceData) {
    instanceData = await getDeviceInstance(device.id);
  }

  // 3. Se não tem virgem própria, tentar adotar órfã virgem
  if (!instanceData) {
    instanceData = await getOrReuseVirginOrphan(device.id);

    if (instanceData) {
      console.log(
        `[demo.status] Reused virgin orphan for device ${device.id.slice(0, 8)}...`
      );
    }
  }

  // 4. Último recurso: criar nova
  if (!instanceData) {
    try {
      instanceData = await createInstanceForDevice(device.id);
      console.log(
        `[demo.status] Created NEW instance for device ${device.id.slice(0, 8)}...`
      );
    } catch (error) {
      console.error("[demo.status] Failed to create instance:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Falha ao criar instância WhatsApp",
      });
    }
  }

  const { instance, client } = instanceData;

  // 5. Buscar status no WuzAPI (com conexão se necessário)
  try {
    let statusRes = await client.getStatus();

    if (!statusRes.data.connected) {
      try {
        await client.connect(["Message"]);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        statusRes = await client.getStatus();
      } catch (connectError) {
        console.warn("[demo.status] Failed to connect:", connectError);
      }
    }

    // Sync status no banco
    await syncInstanceStatus(instance.id, {
      connected: statusRes.data.connected,
      loggedIn: statusRes.data.loggedIn,
      jid: statusRes.data.jid,
      name: statusRes.data.name,
    });

    // QR code quando não logado
    const qrCode = !statusRes.data.loggedIn
      ? statusRes.data.qrcode
      : undefined;

    const usage = await canSendMessage(instance.id);

    // 6. RESPOSTA AO CLIENTE (UX primeiro!)
    const response = {
      connected: statusRes.data.connected,
      loggedIn: statusRes.data.loggedIn,
      qrCode,
      jid: extractPhoneFromJID(statusRes.data.jid),
      instanceId: instance.id,
      // CRÍTICO: apiKey SÓ após conectar!
      apiKey: statusRes.data.loggedIn ? instance.providerToken : undefined,
      messagesUsed: usage.used,
      messagesLimit: usage.limit,
      messagesRemaining: usage.remaining,
    };

    // 7. BACKGROUND: Cleanup de órfãs abusadas (não bloqueia response)
    // Usar setImmediate ou similar para não bloquear
    setImmediate(() => {
      cleanupAbusedOrphans().then((deleted) => {
        if (deleted > 0) {
          console.log(`[demo.status] Cleaned up ${deleted} abused orphans in background`);
        }
      }).catch((err) => {
        console.error("[demo.status] Background cleanup error:", err);
      });
    });

    return response;
  } catch (error) {
    console.error("[demo.status] Error fetching status:", error);

    // Retorna estado desconectado em caso de erro
    return {
      connected: false,
      loggedIn: false,
      qrCode: undefined,
      jid: undefined,
      instanceId: instance.id,
      apiKey: undefined,  // NUNCA expor em erro
      messagesUsed: instance.messagesUsedToday,
      messagesLimit: DEMO_MESSAGE_LIMIT,
      messagesRemaining: Math.max(0, DEMO_MESSAGE_LIMIT - instance.messagesUsedToday),
    };
  }
}),
```

---

### Fase 6: Atualizar useDemo (Frontend)

**Arquivo:** `src/hooks/useDemo.ts`

Adicionar TTL ao localStorage para segurança extra:

```typescript
const STORAGE_KEY = "livchat_demo_state";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

interface CachedState {
  loggedIn: boolean;
  jid?: string;
  apiKey?: string;
  expiresAt: number;  // NOVO: timestamp de expiração
}

function getStoredState(): CachedState | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;

    const state = JSON.parse(cached) as CachedState;

    // NOVO: Verificar expiração
    if (state.expiresAt && state.expiresAt < Date.now()) {
      clearStoredState();
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

function setStoredState(state: Omit<CachedState, 'expiresAt'>): void {
  if (typeof window === "undefined") return;
  try {
    const stateWithTTL: CachedState = {
      ...state,
      expiresAt: Date.now() + STORAGE_TTL_MS,  // Expira em 24h
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithTTL));
  } catch {
    // Ignore storage errors
  }
}
```

---

## 5. Fluxo de Dados Completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BANCO DE DADOS                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Instance A                    Instance B                    Instance C  │
│  ┌──────────────────┐         ┌──────────────────┐         ┌──────────┐ │
│  │ whatsappJid: NULL│         │ whatsappJid: "55"│         │ org: xyz │ │
│  │ createdAt: 12h   │         │ createdAt: 10h   │         │ claimed  │ │
│  │ org: NULL        │         │ org: NULL        │         └──────────┘ │
│  │                  │         │                  │                      │
│  │ → VIRGEM        │         │ → ABUSADA       │         → ATIVA       │
│  │ → Reutilizável   │         │ → DELETAR!       │         → Ignorar    │
│  └──────────────────┘         └──────────────────┘                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              FLUXO                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Novo Device chega                                                       │
│       │                                                                  │
│       ├──► Tem instance própria virgem? ──► SIM ──► Usa ela             │
│       │                                                                  │
│       ├──► Tem instance própria conectada? ──► SIM ──► Usa ela          │
│       │                                                                  │
│       ├──► Tem órfã VIRGEM (8h+)? ──► SIM ──► Adota (Instance A)        │
│       │                                                                  │
│       └──► Cria NOVA                                                     │
│                                                                          │
│  Após responder ao cliente (background):                                 │
│       │                                                                  │
│       └──► Deleta órfãs ABUSADAS (Instance B)                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Segurança

### 6.1 Proteção do Token

| Cenário | Token Exposto? | Ação |
|---------|----------------|------|
| Device acessa, não conecta | Não (apiKey: undefined) | Pode reutilizar |
| Device conecta (loggedIn) | Sim (apiKey retornada) | Não reutilizar se órfã |
| Órfã virgem | Não | Pode reutilizar |
| Órfã abusada | Sim (conectou antes) | Deletar |

### 6.2 Mitigações

1. **apiKey só após loggedIn** - Nunca expõe antes de conectar
2. **localStorage com TTL** - Token expira em 24h no cliente
3. **Não reutilizar abusadas** - Deleta instances com token vazado
4. **Cleanup em background** - Não impacta UX

---

## 7. Critérios de Sucesso

### 7.1 Funcional

- [ ] Device A cria instance, sai por 8h+ SEM conectar
- [ ] Device B chega, reutiliza instance de A (virgem)
- [ ] Device B escaneia QR, conecta
- [ ] Device B recebe apiKey APÓS conectar
- [ ] Device C cria instance, CONECTA, sai por 8h+
- [ ] Device D chega, NÃO reutiliza instance de C (abusada)
- [ ] Instance de C é deletada em background

### 7.2 Segurança

- [ ] apiKey nunca retornada quando loggedIn = false
- [ ] localStorage tem TTL de 24h
- [ ] Órfãs abusadas são deletadas
- [ ] Logs mostram "virgin orphan" vs "abused orphan deleted"

### 7.3 Performance

- [ ] Response ao cliente < 2s (cleanup não bloqueia)
- [ ] Busca de órfã < 50ms (índice)
- [ ] Cleanup processa max 10 por request

---

## 8. Ordem de Execução

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: Schema                                                  │
│  └── Adicionar lastActivityAt + reuseCount                      │
│  └── Criar índice idx_instance_orphan_virgin                    │
│  └── bun db:push                                                │
├─────────────────────────────────────────────────────────────────┤
│  FASE 2: Funções de Instance                                     │
│  └── getOrReuseVirginOrphan() - adota órfãs virgens             │
│  └── cleanupAbusedOrphans() - deleta órfãs abusadas             │
│  └── getConnectedDeviceInstance() - busca conectadas            │
│  └── Atualizar getDeviceInstance() - só virgens                 │
├─────────────────────────────────────────────────────────────────┤
│  FASE 3: demo.status                                             │
│  └── Novo fluxo: conectada → virgem → órfã → criar              │
│  └── apiKey só quando loggedIn = true                           │
│  └── Cleanup em background (setImmediate)                       │
├─────────────────────────────────────────────────────────────────┤
│  FASE 4: Frontend                                                │
│  └── Adicionar TTL ao localStorage (24h)                        │
│  └── Lidar com apiKey undefined                                 │
├─────────────────────────────────────────────────────────────────┤
│  FASE 5: Testes                                                  │
│  └── Testar reutilização de virgem                              │
│  └── Testar NÃO reutilização de abusada                         │
│  └── Testar apiKey só após conectar                             │
│  └── Verificar logs de cleanup                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Rollback Plan

```typescript
// Feature flags para rollback rápido
const ENABLE_ORPHAN_REUSE = true;
const ENABLE_BACKGROUND_CLEANUP = true;
const ENABLE_APIKEY_PROTECTION = true;

// Em demo.status:
if (ENABLE_ORPHAN_REUSE) {
  instanceData = await getOrReuseVirginOrphan(device.id);
}

if (ENABLE_BACKGROUND_CLEANUP) {
  setImmediate(() => cleanupAbusedOrphans());
}

// No return:
apiKey: ENABLE_APIKEY_PROTECTION
  ? (statusRes.data.loggedIn ? instance.providerToken : undefined)
  : instance.providerToken,
```

---

## Changelog

- **2024-12-05**: Plano criado (v1)
- **2024-12-05**: Revisão de segurança (v2)
  - Adicionado conceito de "virgem" vs "abusada"
  - apiKey só após loggedIn
  - Cleanup de abusadas em background (UX primeiro)
  - TTL no localStorage (24h)
  - Não reutilizar instances que já conectaram (token vazado)
- **2024-12-05**: ✅ IMPLEMENTADO
  - Schema: `lastActivityAt`, `reuseCount`, índice `idx_instance_orphan_virgin`
  - Funções: `getOrReuseVirginOrphan()`, `cleanupAbusedOrphans()`, `getConnectedDeviceInstance()`
  - demo.status: fluxo conectada → virgem → órfã → criar
  - Frontend: TTL 24h no localStorage
  - Build: OK
