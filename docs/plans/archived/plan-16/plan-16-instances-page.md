# Plan-16: Página de Instâncias (/app/instances)

**Data:** 2024-12-19
**Atualizado:** 2024-12-20
**Status:** 🚧 Em andamento (Fase 1 ✅ | Fase 2 ~95% ✅ | Falta: Testes TDD)
**Dependências:** Plan-15 (Multimodal Files) ✅
**Escopo:** Página dedicada para gerenciamento de instâncias WhatsApp

## Progresso Atual

### ✅ Fase 1.1 - Componentes Compartilhados (COMPLETO)
- [x] `StatusBadge` extraído para `components/shared/status-badge.tsx`
- [x] `EditableName` extraído para `components/shared/editable-name.tsx`
- [x] `DeleteConfirmDialog` extraído para `components/shared/delete-confirm-dialog.tsx`
- [x] `ViewToggle` criado em `components/shared/view-toggle.tsx`
- [x] `ListSectionHeader` criado em `components/shared/list-section-header.tsx`
- [x] `instances-widget.tsx` atualizado para usar componentes shared

### ✅ Fase 1.3 - Página Instances com Mock (COMPLETO)
- [x] Página `/app/instances` criada com mock data
- [x] `InstanceRow` com Avatar, StatusBadge, botões vermelhos (Power/Trash)
- [x] `InstanceCard` seguindo mesmo padrão
- [x] ViewToggle funcionando (Lista ↔ Cards)
- [x] DeleteConfirmDialog integrado
- [x] **InstanceFormDialog** com fluxo **zero friction** (inspirado no BuildZero):
  - ❌ ~~Step 1: Input do nome~~ (REMOVIDO - nome vem do WhatsApp)
  - Step 1: QR Code + Pairing Code tabs (mock)
  - Step 2: Sucesso mostrando dados do perfil WhatsApp
  - **Share Button**: Um clique gera link + copia para clipboard
  - Auto-close após 2.5s de sucesso

### 🔄 Fase 2 - Backend Integration (EM PROGRESSO)

**Gap identificado após análise do código:**
O plano original dizia que backend estava 100% pronto, mas falta:

1. **`whatsapp.create` (NOVO)** - Criar nova instância para organização
   - O `whatsapp.status` atual usa lógica híbrida que busca instância existente
   - Para o dashboard criar NOVA instância, precisamos endpoint específico
   - Input: `{ name?: string }` (opcional, default: "WhatsApp")
   - Output: `{ instance, qrCode }`

2. **`whatsapp.status` modificado** - Aceitar instanceId opcional
   - Input: `{ instanceId?: string }` (opcional)
   - Se passado: busca status dessa instância específica
   - Se não passado: mantém lógica atual (resolve automaticamente)
   - Necessário para polling de status da instância recém-criada

**Checklist Fase 2:**
- [x] **2.1** Criar procedure `whatsapp.create` (protected)
  - [x] Criar usuário no WuzAPI via admin API
  - [x] Inserir no banco com organizationId
  - [x] Conectar ao WuzAPI e retornar QR code
  - [ ] Testes TDD (pendente)
- [x] **2.2** Modificar `whatsapp.status` para aceitar instanceId
  - [x] Input schema opcional
  - [x] Lógica: se instanceId, busca específica; senão, resolve automático
  - [ ] Testes TDD (pendente)
- [x] **2.3** Integrar InstanceFormDialog com tRPC real
  - [x] Chamar `whatsapp.create` ao abrir dialog
  - [x] Exibir QR code real
  - [x] Polling de `whatsapp.status({ instanceId })` a cada 2-3s
  - [x] Detectar `loggedIn: true` → sucesso
  - [x] Pairing code via `whatsapp.pairing`
  - [x] Error handling + retry
- [x] **2.4** Conectar página de instâncias
  - [x] Substituir mock por `api.whatsapp.list`
  - [x] Loading skeleton
  - [x] Error state
- [x] **2.5** Conectar mutations
  - [x] `api.whatsapp.rename` → EditableName
  - [x] `api.whatsapp.delete` → DeleteConfirmDialog
  - [x] `api.whatsapp.disconnect` → botão Power (online)
  - [x] `api.whatsapp.reconnect` → botão (offline)

### 📝 Fase 3 - Share Link (FUTURO)
O ShareButton já está mockado no dialog. Para produção:
- [ ] Setup Upstash Redis
- [ ] API `POST /api/instances/share` (gera código + TTL 24h)
- [ ] Página pública `/connect/[code]` (sem auth)
- [ ] Integrar ShareButton com API real

## Objetivo

Criar uma página `/app/instances` seguindo o padrão da `/app/webhooks`, com:
1. **Componentes compartilhados** - extrair padrões reutilizáveis
2. **CRUD completo** - listar, criar, editar, deletar instâncias
3. **Conexão integrada** - QR code / pairing code no próprio dashboard
4. **Duas visualizações** - Lista (compacta) e Cards (visual)

## Contexto

### O que já existe

**Backend (~90% pronto):**
- Schema `instances` no banco (claiming, orphan reuse, multi-instance)
- tRPC router `whatsapp.ts` com 10 procedures:
  - `status` (hybrid) - retorna QR code, cria instância **para device anônimo**
  - `pairing` (hybrid) - gera código de pareamento
  - `validate` (hybrid) - valida número no WhatsApp
  - `send` (hybrid) - envia mensagem
  - `disconnect` (hybrid) - logout
  - `list` (protected) - lista instâncias da org ✅
  - `updateAvatar` (protected) - sincroniza avatar ✅
  - `rename` (protected) - renomeia ✅
  - `delete` (protected) - deleta ✅
  - `reconnect` (protected) - reconecta ✅
- WuzAPI client em `server/lib/wuzapi.ts`
- Instance management em `server/lib/instance.ts`

**⚠️ Gap identificado:**
- `status` cria instância para **device anônimo**, não para org
- Não existe `create` para criar nova instância de org
- `status` não aceita `instanceId` para polling específico

**API WuzAPI disponível:**
- `POST /admin/users` → Criar usuário (requer admin token)
- `DELETE /admin/users/:id` → Deletar usuário
- `GET /session/status` → `Connected, LoggedIn, qrcode`
- `POST /session/connect` → Inicia conexão
- `POST /session/pairphone` → Pairing code alternativo
- `POST /user/avatar` → Foto de perfil

**Frontend (✅ COMPLETO):**
- Página dedicada `/app/instances` ✅
- Duas visualizações (lista + cards) ✅
- InstanceFormDialog com zero friction ✅
- Componentes compartilhados ✅

### Referências

| Projeto | Feature | Arquivo |
|---------|---------|---------|
| LivChat | Webhooks page | `app/src/app/(app)/app/webhooks/` |
| LivChat | Webhooks components | `app/src/components/dashboard/webhook-*.tsx` |
| LivChat | **Instances widget** | `app/src/components/dashboard/instances-widget.tsx` |
| LivChat | tRPC router | `app/src/server/api/routers/whatsapp.ts` |
| BuildZero | Connections page | `core-agent/src/app/(app)/dashboard/connections/` |
| BuildZero | Share link | `core-agent/src/lib/connect/` |

---

## Design

### Dados por Instância

| Campo | Fonte | Exibição |
|-------|-------|----------|
| Nome | DB `name` | Editável inline |
| Avatar | DB `whatsappPictureUrl` | Fallback para iniciais |
| Telefone | DB `whatsappJid` | Formatado: +55 11 94818-2061 |
| Nome WhatsApp | DB `whatsappName` | Abaixo do telefone |
| Status | Derived (connected + loggedIn) | Badge: Online/Offline/Conectando |
| Última conexão | DB `lastConnectedAt` | "Há 2 dias" |
| ~~Limite msgs~~ | ~~❌ REMOVIDO~~ | ~~Não faz sentido por instância~~ |

### Visualização: LISTA (compacta)

Ideal para muitas instâncias. Ações diretas, sem dropdown.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Instâncias                                    [≡ Lista] [⊞ Cards] [+ Nova]  │
│  Gerencie suas conexões WhatsApp                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ [🟢] [Av] Vendas          +55 11 94818-2061   Há 2 dias [Desconectar] [🗑️]│
│  │            João Silva      ↑ click to edit                              │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ [🔴] [Av] Suporte         +55 11 98888-8888   -         [Conectar]  [🗑️] │
│  │            Não conectado                                                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ [🟡] [Av] Marketing       Conectando...       -         [Cancelar]  [🗑️] │
│  │            Aguardando QR...                                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Visualização: CARDS (visual)

Ideal para poucas instâncias. Grid responsivo.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Instâncias                                    [≡ Lista] [⊞ Cards] [+ Nova]  │
│  Gerencie suas conexões WhatsApp                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐            │
│  │  ┌──────┐                   │  │  ┌──────┐                   │            │
│  │  │      │  Vendas     [🟢]  │  │  │      │  Suporte    [🔴]  │            │
│  │  │  Av  │  ↑ click to edit  │  │  │  Av  │                   │            │
│  │  └──────┘                   │  │  └──────┘                   │            │
│  │                             │  │                             │            │
│  │  +55 11 94818-2061          │  │  +55 11 98888-8888          │            │
│  │  João Silva                 │  │  Não conectado              │            │
│  │                             │  │                             │            │
│  │  ✓ Conectado há 2 dias      │  │  × Desconectado             │            │
│  │                             │  │                             │            │
│  │  [Desconectar]    [🗑️]      │  │  [Conectar]      [🗑️]      │            │
│  └─────────────────────────────┘  └─────────────────────────────┘            │
│                                                                              │
│  ┌─────────────────────────────┐                                             │
│  │  ┌──────┐                   │                                             │
│  │  │      │  Marketing  [🟡]  │                                             │
│  │  │  Av  │                   │                                             │
│  │  └──────┘                   │                                             │
│  │                             │                                             │
│  │  Conectando...              │                                             │
│  │  Aguardando QR...           │                                             │
│  │                             │                                             │
│  │  ⏳ Escaneie o QR code      │                                             │
│  │                             │                                             │
│  │  [Cancelar]       [🗑️]      │                                             │
│  └─────────────────────────────┘                                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Ações Diretas (sem dropdown!)

**Filosofia:** Ações diretas = menos fricção = melhor UX.

| Estado | Ações visíveis |
|--------|----------------|
| Online | `[Desconectar]` `[🗑️]` |
| Offline | `[Conectar]` `[🗑️]` |
| Conectando | `[Cancelar]` `[🗑️]` |

**Nome:** Click-to-edit inline (não precisa de botão "Renomear")

**Compartilhar:** Só aparece no dialog de criação de nova conexão (Fase 3)

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    /app/instances/page.tsx                       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  PageHeader                                                 ││
│  │  "Instâncias" | "Gerencie..." | [ViewToggle] [+ Nova]       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  InstancesList                                              ││
│  │                                                             ││
│  │  viewMode === "list" ?                                      ││
│  │    <InstanceRow /> × N                                      ││
│  │  : viewMode === "cards" ?                                   ││
│  │    <InstanceCard /> × N (grid)                              ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Dialogs:                                                        │
│  - InstanceFormDialog (create + connect)                         │
│  - InstanceConnectDialog (QR/Pairing for existing)               │
│  - DeleteConfirmDialog (shared)                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fases

### Fase 1: Componentes Compartilhados + Front Mocado

**Objetivo:** Extrair componentes do `instances-widget.tsx` e webhooks, criar página com dados mocados.

#### 1.1 Componentes a EXTRAIR do instances-widget.tsx

O widget já tem componentes excelentes que devemos mover para `shared/`:

```typescript
// components/shared/status-badge.tsx
// EXTRAIR de instances-widget.tsx (linhas 53-88)
// Já tem animação de pulse, 3 estados, cores certas
type InstanceStatus = "online" | "connecting" | "offline";
interface StatusBadgeProps {
  status: InstanceStatus;
}

// components/shared/editable-name.tsx
// EXTRAIR de instances-widget.tsx (linhas 94-166)
// Já tem: click-to-edit, Enter/Escape, optimistic UI
interface EditableNameProps {
  name: string;
  onSave: (name: string) => void;
}

// components/shared/delete-confirm-dialog.tsx
// EXTRAIR de instances-widget.tsx (linhas 172-236)
// Já tem: type-to-confirm, loading state
interface DeleteConfirmDialogProps {
  itemName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
  title?: string;
  description?: string;
}
```

#### 1.2 Novos Componentes Compartilhados

```typescript
// components/shared/page-header.tsx
interface PageHeaderProps {
  title: string;
  description: string;
  count?: number;
  children?: React.ReactNode; // Para ViewToggle + botão
}

// components/shared/view-toggle.tsx
type ViewMode = "list" | "cards";
interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

// components/shared/empty-state.tsx
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

// components/shared/error-state.tsx
interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}
```

#### 1.3 Componentes de Instância

```typescript
// components/dashboard/instance-row.tsx (visualização LISTA)
// Layout horizontal compacto
interface InstanceRowProps {
  instance: Instance;
  onRename: (name: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
}

// components/dashboard/instance-card.tsx (visualização CARDS)
// ADAPTAR do InstanceCard existente no widget
// Layout vertical com mais espaço visual
interface InstanceCardProps {
  instance: Instance;
  onRename: (name: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
}

// components/dashboard/instances-list.tsx (orquestrador)
// Similar ao webhooks-list.tsx
// Gerencia: viewMode, dialogs, mutations
```

#### 1.4 Mock Data

```typescript
// Dados para desenvolvimento (sem messagesUsed!)
const MOCK_INSTANCES: Instance[] = [
  {
    id: "1",
    name: "Vendas",
    phoneNumber: "5511948182061",
    whatsappName: "João Silva",
    pictureUrl: null,
    status: "online",
    lastConnectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 dias
  },
  {
    id: "2",
    name: "Suporte",
    phoneNumber: "5511988888888",
    whatsappName: null,
    pictureUrl: null,
    status: "offline",
    lastConnectedAt: null,
  },
  {
    id: "3",
    name: "Marketing",
    phoneNumber: null, // ainda não conectou
    whatsappName: null,
    pictureUrl: null,
    status: "connecting",
    lastConnectedAt: null,
  },
];
```

#### 1.5 Refatorar Webhooks

Atualizar webhooks para usar componentes compartilhados (sem quebrar):
- Usar `EditableName` extraído
- Usar `DeleteConfirmDialog` extraído
- Manter design visual idêntico

#### 1.6 Refatorar instances-widget.tsx

Após extrair componentes, atualizar widget para importar de `shared/`:
- Importar `StatusBadge` de shared
- Importar `EditableName` de shared
- Importar `DeleteConfirmDialog` de shared
- Widget continua funcionando igual

---

### Fase 2: Integração com Backend

**Objetivo:** Criar endpoints faltantes + conectar front mocado com tRPC real.

#### 2.1 Novo Procedure: whatsapp.create (protected)

Cria nova instância para a organização do usuário logado:

```typescript
// server/api/routers/whatsapp.ts
create: protectedProcedure
  .input(z.object({
    name: z.string().min(1).max(50).optional().default("WhatsApp")
  }))
  .mutation(async ({ ctx, input }) => {
    const { user, log } = ctx;

    // 1. Verificar limite de instâncias da org
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, user.organizationId),
    });
    const currentCount = await db.select({ count: sql`count(*)` })
      .from(instances)
      .where(eq(instances.organizationId, user.organizationId));

    if (currentCount[0].count >= (org?.maxInstances ?? 1)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Limite de ${org?.maxInstances ?? 1} instância(s) atingido`,
      });
    }

    // 2. Gerar token único
    const token = `lc_${nanoid(24)}`;

    // 3. Criar instância no WuzAPI via admin API
    const wuzResponse = await fetch(`${env.WUZAPI_URL}/admin/users`, {
      method: "POST",
      headers: {
        Authorization: env.WUZAPI_ADMIN_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.name,
        token,
        events: "Message,ReadReceipt,Connected",
      }),
    });

    if (!wuzResponse.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Falha ao criar instância no provedor",
      });
    }

    const wuzData = await wuzResponse.json();

    // 4. Salvar no banco
    const [instance] = await db.insert(instances).values({
      name: input.name,
      organizationId: user.organizationId,
      providerId: String(wuzData.id),
      providerToken: token,
      providerType: "wuzapi",
      status: "disconnected",
    }).returning();

    // 5. Conectar e pegar QR code
    const client = new WuzAPIClient({
      baseUrl: env.WUZAPI_URL,
      token,
    });

    await client.connect(["Message"]);
    await new Promise(r => setTimeout(r, 2000)); // Aguardar QR
    const status = await client.getStatus();

    log.info("instance.create", "Created new instance for org", {
      instanceId: instance.id,
      organizationId: user.organizationId,
    });

    return {
      instance,
      qrCode: status.data.qrcode,
      connected: status.data.connected,
      loggedIn: status.data.loggedIn,
    };
  })
```

#### 2.1.1 Modificar whatsapp.status para aceitar instanceId

Permitir polling de status de instância específica:

```typescript
// Modificar input do status
status: hybridProcedure
  .input(z.object({
    instanceId: z.string().uuid().optional()
  }).optional())
  .query(async ({ ctx, input }) => {
    // Se instanceId passado E user logado, busca essa instância específica
    if (input?.instanceId && ctx.user) {
      const instance = await db.query.instances.findFirst({
        where: and(
          eq(instances.id, input.instanceId),
          eq(instances.organizationId, ctx.user.organizationId)
        ),
      });

      if (!instance) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const client = new WuzAPIClient({
        baseUrl: env.WUZAPI_URL,
        token: instance.providerToken,
      });

      const status = await client.getStatus();
      // ... sync e retorno como antes
    }

    // Senão, mantém lógica atual de resolução automática
    // ...resto do código existente...
  })
```

#### 2.2 Conectar Queries/Mutations no Front

```typescript
// instances-list.tsx
// Remover mock, usar tRPC
const { data, isLoading, error, refetch } = api.whatsapp.list.useQuery({
  syncAvatars: true,
});

const createMutation = api.whatsapp.create.useMutation({
  onSuccess: () => {
    void refetch();
    setFormDialogOpen(false);
  },
});

const renameMutation = api.whatsapp.rename.useMutation({
  onSuccess: () => void refetch(),
});

const deleteMutation = api.whatsapp.delete.useMutation({
  onSuccess: () => void refetch(),
});

const reconnectMutation = api.whatsapp.reconnect.useMutation({
  onSuccess: () => void refetch(),
});

const disconnectMutation = api.whatsapp.disconnect.useMutation({
  onSuccess: () => void refetch(),
});
```

#### 2.3 Dialog de Criação + Conexão

```typescript
// instance-form-dialog.tsx
// 3 Steps:

// Step 1: Nome da instância
// - Input de nome
// - Botão "Criar"
// - Chama createMutation

// Step 2: Conexão (QR/Pairing)
// - Tabs: [QR Code] [Código de Pareamento]
// - QR: Mostra imagem, auto-refresh 15s
// - Pairing: Input de telefone, gera código
// - Polling de status a cada 2s

// Step 3: Sucesso
// - Checkmark animado
// - "WhatsApp conectado!"
// - Auto-fecha após 2s
```

#### 2.4 Persistir ViewMode

```typescript
// Salvar preferência do usuário
const [viewMode, setViewMode] = useState<ViewMode>(() => {
  if (typeof window !== "undefined") {
    return (localStorage.getItem("instances-view") as ViewMode) || "cards";
  }
  return "cards";
});

useEffect(() => {
  localStorage.setItem("instances-view", viewMode);
}, [viewMode]);
```

---

### Fase 3: Share Link (Futuro)

**Objetivo:** Permitir compartilhar link para conexão remota.

> **Nota:** Esta fase é opcional e pode ser implementada posteriormente.

#### 3.1 Infraestrutura

- Adicionar Upstash Redis ao projeto
- Criar lib `share-code.ts` (nanoid + Redis TTL 24h)

#### 3.2 API

```typescript
// POST /api/instances/share
// Gera código temporário e retorna URL

// GET /api/instances/connect/[code]/status
// Retorna status da conexão (público)

// GET /api/instances/connect/[code]/qr
// Retorna QR code (público)
```

#### 3.3 Página Pública

- `/connect/[code]/page.tsx` - Página sem auth
- QR code com auto-refresh (15s)
- Status polling (2s)
- Auto-fecha após sucesso

---

## Componentes Detalhados

### Instance (tipo)

```typescript
interface Instance {
  id: string;
  name: string;
  phoneNumber: string | null;      // "5511948182061" (raw)
  whatsappName: string | null;     // "João Silva"
  pictureUrl: string | null;       // Avatar URL
  status: "online" | "offline" | "connecting";
  lastConnectedAt: Date | null;
  // ❌ SEM messagesUsed/limit - não faz sentido por instância
}
```

### InstanceRow (visualização lista)

```typescript
interface InstanceRowProps {
  instance: Instance;
  onRename: (name: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
}
```

**Layout horizontal compacto:**
```
┌────────────────────────────────────────────────────────────────────────┐
│  [🟢] [Av] Vendas           +55 11 94818-2061     Há 2 dias      [⋮]  │
│             João Silva                                                 │
└────────────────────────────────────────────────────────────────────────┘
```

### InstanceCard (visualização cards)

```typescript
interface InstanceCardProps {
  instance: Instance;
  onRename: (name: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
}
```

**Layout vertical com mais espaço:**
```
┌─────────────────────────────┐
│  ┌──────┐                   │
│  │      │  Vendas     [🟢]  │
│  │  Av  │                   │
│  └──────┘                   │
│                             │
│  +55 11 94818-2061          │
│  João Silva                 │
│                             │
│  ✓ Conectado há 2 dias      │
│                             │
│  [Reconectar]   [⋮]         │
└─────────────────────────────┘
```

### Ações Diretas (sem dropdown)

```typescript
// Botões inline no card/row
<div className="flex gap-2">
  {status === "online" && (
    <Button variant="outline" size="sm" onClick={onDisconnect}>
      <Power className="h-4 w-4 mr-1.5" />
      Desconectar
    </Button>
  )}
  {status === "offline" && (
    <Button size="sm" onClick={onConnect}>
      <Wifi className="h-4 w-4 mr-1.5" />
      Conectar
    </Button>
  )}
  {status === "connecting" && (
    <Button variant="outline" size="sm" onClick={onCancel}>
      <X className="h-4 w-4 mr-1.5" />
      Cancelar
    </Button>
  )}
  <Button
    variant="ghost"
    size="icon"
    className="text-destructive hover:text-destructive hover:bg-destructive/10"
    onClick={onDelete}
  >
    <Trash2 className="h-4 w-4" />
  </Button>
</div>
```

**Nome:** Click-to-edit inline usando `<EditableName />` compartilhado

### InstanceFormDialog

**Estados (step):**
1. `name` - Input do nome da instância
2. `connecting` - QR code / Pairing code
3. `success` - WhatsApp conectado!

**Step 2 - Tabs:**
- **QR Code** (default): Mostra QR, auto-refresh 15s
- **Código**: Input telefone → gera código de 8 dígitos

---

## Checklist

### Fase 1 - Componentes Compartilhados + Mock

**1.1 Extrair de instances-widget.tsx:**
- [x] Extrair `StatusBadge` → `components/shared/status-badge.tsx`
- [x] Extrair `EditableName` → `components/shared/editable-name.tsx`
- [x] Extrair `DeleteDialog` → `components/shared/delete-confirm-dialog.tsx`
- [x] Atualizar `instances-widget.tsx` para importar de shared

**1.2 Novos componentes shared:**
- [ ] ~~Criar `components/shared/page-header.tsx`~~ (não necessário)
- [x] Criar `components/shared/view-toggle.tsx`
- [ ] ~~Criar `components/shared/empty-state.tsx`~~ (inline no componente)
- [ ] ~~Criar `components/shared/error-state.tsx`~~ (inline no componente)
- [x] Criar `components/shared/list-section-header.tsx`

**1.3 Página Instances (mocada):**
- [x] Criar `app/(app)/app/instances/page.tsx`
- [ ] ~~Criar `components/dashboard/instances-list.tsx`~~ (inline na page)
- [x] Criar `components/instances/instance-row.tsx` (visualização lista)
- [x] Criar `components/instances/instance-card.tsx` (visualização cards)
- [x] Criar `components/instances/instance-form-dialog.tsx` (mock QR + pairing)
- [x] Implementar ViewToggle (lista ↔ cards)
- [x] Testar layout em ambos modos

**1.4 Refatorar webhooks (opcional, se tempo):**
- [ ] Usar `EditableName` de shared (webhooks usa inline)
- [ ] Usar `DeleteConfirmDialog` de shared (webhooks usa inline)
- [ ] Verificar que nada quebrou

### Fase 2 - Integração Backend

**2.1 Novo procedure:**
- [ ] Adicionar `whatsapp.create` no router
- [ ] Testar criação de instância

**2.2 Conectar front:**
- [ ] Remover mock data
- [ ] Conectar `instances-list.tsx` com tRPC
- [ ] Implementar create com mutation
- [ ] Implementar rename com mutation
- [ ] Implementar delete com mutation
- [ ] Implementar reconnect/disconnect

**2.3 Dialog de conexão:**
- [ ] Implementar Step 1: Nome
- [ ] Implementar Step 2: QR Code
- [ ] Implementar Step 2: Pairing Code (alternativo)
- [ ] Implementar Step 3: Sucesso
- [ ] Polling de status a cada 2s
- [ ] Auto-refresh QR a cada 15s

**2.4 UX:**
- [ ] Persistir viewMode no localStorage
- [ ] Skeleton loading em ambos modos
- [ ] Animações Framer Motion

### Fase 3 - Share Link (Futuro)
- [ ] Setup Upstash Redis
- [ ] Criar `lib/share-code.ts`
- [ ] API `POST /api/instances/share`
- [ ] API `GET /api/connect/[code]/status`
- [ ] API `GET /api/connect/[code]/qr`
- [ ] Página pública `/connect/[code]`
- [ ] ShareInstanceButton no menu de ações
- [ ] Auto-expiração 24h
- [ ] Testes

---

## Arquivos a Criar/Modificar

### Fase 1

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `components/shared/status-badge.tsx` | **EXTRAIR** | De instances-widget.tsx |
| `components/shared/editable-name.tsx` | **EXTRAIR** | De instances-widget.tsx |
| `components/shared/delete-confirm-dialog.tsx` | **EXTRAIR** | De instances-widget.tsx |
| `components/shared/page-header.tsx` | **NOVO** | Header com título, desc, actions |
| `components/shared/view-toggle.tsx` | **NOVO** | Toggle lista/cards |
| `components/shared/empty-state.tsx` | **NOVO** | Estado vazio genérico |
| `components/shared/error-state.tsx` | **NOVO** | Estado de erro genérico |
| `components/shared/index.ts` | **NOVO** | Barrel export |
| `components/dashboard/instances-widget.tsx` | Modificar | Importar de shared |
| `app/(app)/app/instances/page.tsx` | **NOVO** | Página de instâncias |
| `components/dashboard/instances-list.tsx` | **NOVO** | Orquestrador |
| `components/dashboard/instance-row.tsx` | **NOVO** | Visualização lista |
| `components/dashboard/instance-card.tsx` | **NOVO** | Visualização cards |
| `components/dashboard/instance-form-dialog.tsx` | **NOVO** | Dialog create/connect |

### Fase 2

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `server/api/routers/whatsapp.ts` | Modificar | Adicionar `create` procedure |
| `components/dashboard/instances-list.tsx` | Modificar | Remover mock, usar tRPC |
| `components/dashboard/instance-form-dialog.tsx` | Modificar | QR code + pairing reais |

### Fase 3

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `lib/share-code.ts` | **NOVO** | Gerar código Redis |
| `app/api/instances/share/route.ts` | **NOVO** | POST gerar link |
| `app/api/connect/[code]/status/route.ts` | **NOVO** | GET status público |
| `app/api/connect/[code]/qr/route.ts` | **NOVO** | GET QR público |
| `app/connect/[code]/page.tsx` | **NOVO** | Página pública |
| `components/connect/public-connect-page.tsx` | **NOVO** | UI da página pública |

---

## Design Notes

### Consistência com Webhooks

- Mesmo padding, spacing, cores
- Animações Framer Motion idênticas
- Loading skeletons no mesmo estilo
- Empty state com mesmo padrão

### Diferenças de Instances

- **Status visual**: Badge colorido (verde/vermelho/amarelo)
- **Avatar**: Imagem do WhatsApp (fallback para iniciais)
- **Usage bar**: Barra de progresso de mensagens
- **QR code**: Modal multi-step para conexão

### Mobile

- Cards empilham em coluna única
- Actions em dropdown (não inline)
- QR code responsivo
- Pairing code como alternativa (mais fácil no mobile)

---

## Estimativa

| Fase | Complexidade | Estimativa |
|------|--------------|------------|
| Fase 1 | Média | 1-2 dias |
| Fase 2 | Média | 1-2 dias |
| Fase 3 | Alta | 2-3 dias |

**Total MVP (Fases 1-2):** 2-4 dias

---

## Próximos Passos

1. Aprovar plano
2. Iniciar Fase 1 com componentes compartilhados
3. Testar refatoração do webhooks (não quebrar nada)
4. Criar página instances mocada
5. Fase 2: integrar backend
