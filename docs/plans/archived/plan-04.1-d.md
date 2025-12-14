# Plan 04.1-d: InstancesWidget com Dados Reais

> **Status:** PENDENTE
> **Dependências:** plan-04.1-b (parcialmente completo)
> **Objetivo:** Conectar InstancesWidget a dados reais + CRUD completo de instâncias
> **Metodologia:** TDD

---

## 1. Contexto e Problema

### Estado Atual
- `InstancesWidget` usa **mock data** (`mockInstances` em `mock-dashboard.ts`)
- `whatsapp.list` já existe e retorna dados reais
- `whatsappPictureUrl` existe no schema mas **nunca é populado** (getAvatar não é chamado)
- `instance.name` tem default "WhatsApp" - pode ser usado como displayName

### Problemas Identificados

| Campo no Widget | Fonte Atual | Problema |
|-----------------|-------------|----------|
| `name` | `mockInstances[].name` | Precisa vir de `instance.name` (editável) |
| `pictureUrl` | null | Precisa chamar `getAvatar()` do WuzAPI |
| `whatsappName` | não existe | Precisa vir de `instance.whatsappName` (do perfil) |
| `deviceName` | mock | **NÃO EXISTE** - WuzAPI não retorna tipo de dispositivo |
| `status` | mock | Precisa mapear `connected + loggedIn` |
| `actions` | mock buttons | Precisam chamar procedures reais |

### Decisão: Remover `deviceName`
O WuzAPI retorna apenas `name` (nome do perfil WhatsApp), não informações do dispositivo. Não há como saber se é iPhone/Android. **Remover do UI.**

---

## 2. Arquitetura Final

### 2.1 Campos da Instância

```
┌─────────────────────────────────────────────────────────────────┐
│                    INSTANCE (banco + API)                        │
├─────────────────────────────────────────────────────────────────┤
│  id                  → UUID                                      │
│  name                → "Atendimento" (editável pelo usuário)    │
│  phoneNumber         → "+55 11 94818-2061" (extraído do JID)    │
│  whatsappName        → "Pedro Silva" (nome do perfil, auto)     │
│  pictureUrl          → URL da foto (Vercel Blob, auto)          │
│  status              → "online" | "connecting" | "offline"      │
│  connectedSince      → Date | null                               │
│  messagesUsed        → number                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 UI do Card

```
┌────────────────────────────────────────┐
│  [Avatar]  Atendimento     [● Online]  │  ← name (editável)
│            +55 11 94818-2061           │  ← phoneNumber
│            Pedro Silva                 │  ← whatsappName (perfil)
│                                        │
│  ✓ 2h 34m      💬 847 msgs            │  ← uptime, mensagens
│                                        │
│  [Reconectar]         [✏️]  [🗑️]      │  ← actions
└────────────────────────────────────────┘
```

### 2.3 Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│  InstancesWidget (React)                                        │
│  └─ useQuery(whatsapp.list) → polling 30s                      │
│  └─ useMutation(whatsapp.rename)                                │
│  └─ useMutation(whatsapp.delete)                                │
│  └─ useMutation(whatsapp.reconnect)                             │
└───────────────────────────────────────┬─────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  whatsapp.ts (tRPC Router)                                      │
│  ├─ list         → getOrganizationInstances + WuzAPI status    │
│  ├─ rename       → UPDATE instance.name                         │
│  ├─ delete       → DELETE WuzAPI user + soft delete instance   │
│  ├─ reconnect    → WuzAPI connect                               │
│  └─ updateAvatar → WuzAPI getAvatar + Vercel Blob              │
└───────────────────────────────────────┬─────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  WuzAPI Client                                                  │
│  ├─ getStatus()      → /session/status                          │
│  ├─ getAvatar(jid)   → /user/avatar (já existe, não usado)     │
│  ├─ connect()        → /session/connect                         │
│  ├─ logout()         → /session/logout                          │
│  └─ (admin) deleteUser → DELETE /admin/users/{id}              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementação (TDD)

### Task 1: Corrigir `whatsapp.list` para incluir todos os campos

**Objetivo:** O `whatsapp.list` já existe, mas precisa retornar o formato correto.

**Arquivo:** `src/server/api/routers/whatsapp.ts`

**Mudanças:**
```typescript
// Antes (atual)
return {
  id: instance.id,
  name: instance.name,
  phoneNumber: extractPhoneFromJID(instance.whatsappJid),
  deviceName: instance.whatsappName ?? "WhatsApp",  // ❌ errado
  pictureUrl: instance.whatsappPictureUrl,
  connected: status.data.connected,
  loggedIn: status.data.loggedIn,
  ...
};

// Depois (correto)
return {
  id: instance.id,
  name: instance.name,                              // ✅ nome editável
  phoneNumber: extractPhoneFromJID(instance.whatsappJid),
  whatsappName: instance.whatsappName ?? null,      // ✅ nome do perfil
  pictureUrl: instance.whatsappPictureUrl,          // ✅ foto (será populada)
  status: deriveStatus(status.data.connected, status.data.loggedIn),
  connectedSince: instance.lastConnectedAt?.toISOString() ?? null,
  messagesUsed: instance.messagesUsedToday,
};

// Helper
function deriveStatus(connected: boolean, loggedIn: boolean): "online" | "connecting" | "offline" {
  if (connected && loggedIn) return "online";
  if (connected && !loggedIn) return "connecting";
  return "offline";
}
```

**Testes:**
- `whatsapp.list returns correct status mapping`
- `whatsapp.list handles WuzAPI errors gracefully`

---

### Task 2: Implementar `whatsapp.updateAvatar`

**Objetivo:** Buscar foto de perfil do WuzAPI e salvar no Vercel Blob.

**Arquivo:** `src/server/api/routers/whatsapp.ts`

**Fluxo:**
1. Receber `instanceId`
2. Buscar instância do banco
3. Chamar `WuzAPI.getAvatar(instance.whatsappJid)`
4. Fazer download da imagem da URL retornada
5. Fazer upload para Vercel Blob
6. Atualizar `instance.whatsappPictureUrl` no banco
7. Retornar nova URL

**Código:**
```typescript
updateAvatar: protectedProcedure
  .input(z.object({ instanceId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { user, log } = ctx;

    // 1. Buscar instância
    const instance = await db.query.instances.findFirst({
      where: and(
        eq(instances.id, input.instanceId),
        eq(instances.organizationId, user.organizationId),
      ),
    });

    if (!instance?.whatsappJid) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    // 2. Buscar avatar do WuzAPI
    const client = new WuzAPIClient({
      baseUrl: env.WUZAPI_URL,
      token: instance.providerToken,
    });

    const avatar = await client.getAvatar(instance.whatsappJid);
    if (!avatar.URL) {
      return { pictureUrl: null };
    }

    // 3. Download + Upload Vercel Blob
    const imageResponse = await fetch(avatar.URL);
    const imageBlob = await imageResponse.blob();

    const { url } = await put(
      `avatars/${instance.id}.jpg`,
      imageBlob,
      { access: "public", contentType: "image/jpeg" }
    );

    // 4. Atualizar banco
    await db.update(instances)
      .set({ whatsappPictureUrl: url })
      .where(eq(instances.id, instance.id));

    log.info(LogActions.WUZAPI_STATUS, "Avatar updated", { instanceId: instance.id });

    return { pictureUrl: url };
  }),
```

**Testes:**
- `whatsapp.updateAvatar fetches and stores avatar`
- `whatsapp.updateAvatar handles no avatar gracefully`
- `whatsapp.updateAvatar requires auth`

---

### Task 3: Implementar `whatsapp.rename`

**Objetivo:** Permitir renomear a instância.

**Arquivo:** `src/server/api/routers/whatsapp.ts`

**Código:**
```typescript
rename: protectedProcedure
  .input(z.object({
    instanceId: z.string().uuid(),
    name: z.string().min(1).max(50),
  }))
  .mutation(async ({ ctx, input }) => {
    const { user, log } = ctx;

    const result = await db.update(instances)
      .set({ name: input.name, updatedAt: new Date() })
      .where(and(
        eq(instances.id, input.instanceId),
        eq(instances.organizationId, user.organizationId),
      ))
      .returning({ id: instances.id, name: instances.name });

    if (result.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    log.info("instance.rename", "Instance renamed", {
      instanceId: input.instanceId,
      newName: input.name,
    });

    return result[0];
  }),
```

**Testes:**
- `whatsapp.rename updates instance name`
- `whatsapp.rename rejects empty name`
- `whatsapp.rename rejects unauthorized access`

---

### Task 4: Implementar `whatsapp.delete`

**Objetivo:** Deletar instância (WuzAPI + banco).

**Arquivo:** `src/server/api/routers/whatsapp.ts`

**Fluxo:**
1. Buscar instância
2. Chamar `DELETE /admin/users/{providerId}` no WuzAPI
3. Deletar instância do banco (hard delete ou soft delete)

**Código:**
```typescript
delete: protectedProcedure
  .input(z.object({ instanceId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { user, log } = ctx;

    // 1. Buscar instância
    const instance = await db.query.instances.findFirst({
      where: and(
        eq(instances.id, input.instanceId),
        eq(instances.organizationId, user.organizationId),
      ),
    });

    if (!instance) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    // 2. Deletar no WuzAPI (admin endpoint)
    try {
      await fetch(`${env.WUZAPI_URL}/admin/users/${instance.providerId}`, {
        method: "DELETE",
        headers: { Authorization: env.WUZAPI_ADMIN_TOKEN },
      });
    } catch (error) {
      log.warn("wuzapi.delete", "Failed to delete WuzAPI user", { error });
      // Continua mesmo se falhar - instância pode já não existir
    }

    // 3. Deletar do banco
    await db.delete(instances)
      .where(eq(instances.id, input.instanceId));

    log.info("instance.delete", "Instance deleted", {
      instanceId: input.instanceId,
    });

    return { success: true };
  }),
```

**Testes:**
- `whatsapp.delete removes instance from database`
- `whatsapp.delete calls WuzAPI admin endpoint`
- `whatsapp.delete handles WuzAPI errors gracefully`

---

### Task 5: Implementar `whatsapp.reconnect`

**Objetivo:** Reconectar uma instância desconectada.

**Arquivo:** `src/server/api/routers/whatsapp.ts`

**Código:**
```typescript
reconnect: protectedProcedure
  .input(z.object({ instanceId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { user, log } = ctx;

    const instance = await db.query.instances.findFirst({
      where: and(
        eq(instances.id, input.instanceId),
        eq(instances.organizationId, user.organizationId),
      ),
    });

    if (!instance) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const client = new WuzAPIClient({
      baseUrl: env.WUZAPI_URL,
      token: instance.providerToken,
    });

    await log.time(LogActions.WUZAPI_CONNECT, "Reconnecting instance", async () => {
      await client.connect(["Message"]);
    });

    return { success: true };
  }),
```

**Testes:**
- `whatsapp.reconnect calls WuzAPI connect`
- `whatsapp.reconnect requires auth`

---

### Task 6: Atualizar `InstancesWidget` para dados reais

**Objetivo:** Trocar mock data por tRPC queries/mutations.

**Arquivo:** `src/components/dashboard/instances-widget.tsx`

**Mudanças:**

```typescript
// Antes
import { mockInstances, ... } from "~/lib/mock-dashboard";
const instances = mockInstances;

// Depois
import { api } from "~/trpc/react";

const { data, isLoading, isError, refetch } = api.whatsapp.list.useQuery(
  undefined,
  { refetchInterval: 30000 }
);

const renameMutation = api.whatsapp.rename.useMutation({
  onSuccess: () => refetch(),
});

const deleteMutation = api.whatsapp.delete.useMutation({
  onSuccess: () => refetch(),
});

const reconnectMutation = api.whatsapp.reconnect.useMutation({
  onSuccess: () => refetch(),
});

// Loading state
if (isLoading) return <InstancesWidgetSkeleton />;

// Error state
if (isError) return <InstancesWidgetError onRetry={() => refetch()} />;

// Empty state
if (!data || data.instances.length === 0) return <InstancesWidgetEmpty />;

// Map API response to component
const instances = data.instances.map(inst => ({
  ...inst,
  // status já vem mapeado da API
}));
```

**UI Updates:**
- Adicionar botão de editar nome (inline edit ou modal)
- Adicionar botão de deletar com confirmação
- Wiring dos botões com mutations
- Loading states nos botões durante mutations

---

### Task 7: Auto-sync do Avatar ao Conectar

**Objetivo:** Quando uma instância conecta, buscar avatar automaticamente.

**Arquivo:** `src/server/api/routers/whatsapp.ts` (no `status` procedure)

**Mudança:**
```typescript
// No status procedure, após detectar login bem-sucedido:
if (status.data.loggedIn && !instance.whatsappPictureUrl) {
  // Fire-and-forget: atualiza avatar em background
  setImmediate(async () => {
    try {
      const avatar = await client.getAvatar(status.data.jid!);
      if (avatar.URL) {
        const imageResponse = await fetch(avatar.URL);
        const imageBlob = await imageResponse.blob();
        const { url } = await put(
          `avatars/${instance.id}.jpg`,
          imageBlob,
          { access: "public", contentType: "image/jpeg" }
        );
        await db.update(instances)
          .set({ whatsappPictureUrl: url })
          .where(eq(instances.id, instance.id));
      }
    } catch (error) {
      log.warn("avatar.sync", "Failed to sync avatar", { error });
    }
  });
}
```

---

## 4. Ordem de Implementação

```
┌────────────────────────────────────────────────────────────────┐
│  FASE 1: Backend (tRPC procedures)                             │
├────────────────────────────────────────────────────────────────┤
│  1. Task 1: Corrigir whatsapp.list                             │
│  2. Task 2: whatsapp.updateAvatar                              │
│  3. Task 3: whatsapp.rename                                    │
│  4. Task 4: whatsapp.delete                                    │
│  5. Task 5: whatsapp.reconnect                                 │
│  6. Task 7: Auto-sync avatar                                   │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  FASE 2: Frontend (InstancesWidget)                            │
├────────────────────────────────────────────────────────────────┤
│  7. Task 6: Conectar widget a dados reais                      │
│  8. Adicionar inline edit para nome                            │
│  9. Adicionar modal de confirmação para delete                 │
│  10. Adicionar loading states nos botões                       │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  FASE 3: Polish                                                │
├────────────────────────────────────────────────────────────────┤
│  11. Optimistic updates                                        │
│  12. Toast notifications                                       │
│  13. E2E tests                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Schema Atual vs Necessário

### Campos Existentes (já temos):

| Campo | Tipo | Uso |
|-------|------|-----|
| `id` | uuid | PK |
| `name` | text (default "WhatsApp") | Nome editável pelo usuário |
| `whatsappJid` | text | Número do WhatsApp |
| `whatsappName` | text | Nome do perfil (auto) |
| `whatsappPictureUrl` | text | Foto (precisa popular) |
| `lastConnectedAt` | timestamp | Para uptime |
| `messagesUsedToday` | integer | Contador |
| `providerToken` | text | Para API |
| `providerId` | text | Para delete |

### Conclusão: **Não precisa alterar schema!**

Todos os campos necessários já existem. O problema é que:
1. `whatsappPictureUrl` nunca é populado
2. `name` nunca é atualizado pelo usuário

---

## 6. Testes

### Estrutura
```
tests/
├── unit/
│   └── whatsapp-procedures.test.ts   ← Testes das procedures
└── e2e/
    └── instances-widget.spec.ts      ← Testes do widget
```

### Casos de Teste (Unit)

```typescript
describe("whatsapp.list", () => {
  it("returns correct status mapping for online");
  it("returns correct status mapping for connecting");
  it("returns correct status mapping for offline");
  it("handles WuzAPI errors gracefully");
});

describe("whatsapp.rename", () => {
  it("updates instance name");
  it("rejects empty name");
  it("rejects name over 50 chars");
  it("rejects unauthorized access");
});

describe("whatsapp.delete", () => {
  it("removes instance from database");
  it("calls WuzAPI admin endpoint");
  it("continues if WuzAPI fails");
  it("rejects unauthorized access");
});

describe("whatsapp.reconnect", () => {
  it("calls WuzAPI connect");
  it("rejects unauthorized access");
});

describe("whatsapp.updateAvatar", () => {
  it("fetches and stores avatar");
  it("handles no avatar gracefully");
  it("returns null for missing JID");
});
```

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| WuzAPI getAvatar retorna URL expirada | Média | Baixo | Fazer download imediato e salvar no Blob |
| Delete falha no WuzAPI mas sucede no banco | Baixa | Médio | Log warning, continuar, orphan cleanup depois |
| Usuário deleta instância em uso | Média | Alto | Confirmação com texto do nome da instância |
| Avatar muito grande | Baixa | Baixo | Vercel Blob lida automaticamente |

---

## 8. Definição de Pronto

- [ ] Todos os testes passando
- [ ] Widget mostra dados reais (não mock)
- [ ] Foto de perfil aparece quando disponível
- [ ] Nome pode ser editado inline
- [ ] Instância pode ser deletada com confirmação
- [ ] Reconectar funciona
- [ ] Loading states em todas as ações
- [ ] Sem erros no console
- [ ] Build passa
