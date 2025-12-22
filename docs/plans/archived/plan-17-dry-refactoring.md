# Plan 17: DRY Refactoring - Componentes Frontend

## Status: PLANEJAMENTO

Data: 2025-12-20

---

## 1. Análise Completa dos Componentes

### 1.1 Arquivos Analisados

| Arquivo | Linhas | Função |
|---------|--------|--------|
| `components/instances/instance-card.tsx` | 160 | Card de instância (page) |
| `components/instances/instance-row.tsx` | 160 | Row de instância (page) - **DUPLICADO** |
| `components/dashboard/instances-widget.tsx` | 490 | Widget de instâncias (dashboard) |
| `components/dashboard/webhook-card.tsx` | 140 | Card de webhook |
| `components/dashboard/webhooks-list.tsx` | 498 | Lista de webhooks |
| `components/shared/editable-name.tsx` | 84 | Nome editável inline |
| `components/shared/status-badge.tsx` | 52 | Badge de status |
| `components/shared/status-dot.tsx` | 48 | Dot de status |
| `components/shared/view-toggle.tsx` | 45 | Toggle list/cards |
| `components/shared/delete-confirm-dialog.tsx` | 90 | Dialog de confirmação |
| `components/shared/list-section-header.tsx` | 34 | Header de seção - **ÓRFÃO** |
| `app/(app)/app/instances/page.tsx` | 289 | Página de instâncias |

---

## 2. Padrões Visuais - O Que Manter

### 2.1 Padrão CORRETO: Botões com Background no Hover (webhook-card)

```tsx
// ✅ PADRÃO CORRETO - webhook-card.tsx
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 text-muted-foreground hover:text-destructive"
>
  <Trash2 className="h-4 w-4" />
</Button>
```

**Características:**
- `variant="ghost"` - Sem background inicial, aparece apenas no hover
- `text-muted-foreground` - Cor neutra por padrão
- `hover:text-destructive` - Cor vermelha apenas no hover
- Sem border

### 2.2 Padrão INCORRETO: Botões com Border e Cor Fixa (instance-card)

```tsx
// ❌ PADRÃO INCORRETO - instance-card.tsx
<Button
  variant="outline"
  size="icon"
  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30"
>
  <Trash2 className="h-4 w-4" />
</Button>
```

**Problemas:**
- `variant="outline"` - Tem border sempre visível
- `text-red-500` - Cor vermelha fixa, não muda
- `border-red-500/30` - Border vermelha sempre visível

### 2.3 Decisão de Design

| Elemento | Padrão Correto | Usar |
|----------|----------------|------|
| Delete button | `ghost` + hover destructive | webhook-card |
| Disconnect button | `ghost` + hover destructive | webhook-card |
| Secondary actions | `ghost` + muted-foreground | webhook-card |
| Card container | `group rounded-lg border bg-card p-4 hover:bg-muted/30` | Ambos |
| Framer animation | `initial/animate/exit` | Ambos |

---

## 3. Problemas de DRY (Código Duplicado)

### 3.1 CRÍTICO: `formatPhone()` - 3 duplicações

**Locais:**
- `instance-card.tsx:33-39`
- `instance-row.tsx:33-39`
- `instances-widget.tsx:79-86`

```typescript
// Código duplicado 3x
function formatPhone(phone: string | undefined): string {
  if (!phone) return "Não conectado";
  if (phone.length >= 12) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  return phone;
}
```

**Solução:** Mover para `lib/utils.ts`

### 3.2 CRÍTICO: `getStatusText()` - 2 duplicações

**Locais:**
- `instance-card.tsx:41-61`
- `instance-row.tsx:41-61`

```typescript
// Código duplicado 2x
function getStatusText(status: InstanceStatus, messagesUsed: number): string {
  const parts: string[] = [];
  switch (status) {
    case "online":
      parts.push("Online");
      break;
    case "connecting":
      parts.push("Conectando...");
      break;
    case "offline":
      parts.push("Offline");
      break;
  }
  if (messagesUsed > 0) {
    parts.push(`${messagesUsed} msgs`);
  }
  return parts.join(" · ");
}
```

**Solução:** Mover para `lib/utils.ts`

### 3.3 CRÍTICO: `InstanceCard` = `InstanceRow` - 100% duplicação

**Arquivos:**
- `components/instances/instance-card.tsx` (160 linhas)
- `components/instances/instance-row.tsx` (160 linhas)

**Análise:** Os dois componentes são **IDÊNTICOS** - apenas o nome difere.

**Solução:** Deletar `instance-row.tsx` e usar `InstanceCard` para ambos os casos.

### 3.4 ALTO: `DeleteWebhookDialog` vs `DeleteConfirmDialog`

**Locais:**
- `webhooks-list.tsx:114-175` - Local (62 linhas)
- `shared/delete-confirm-dialog.tsx` - Compartilhado (90 linhas)

**Análise:** `DeleteWebhookDialog` é quase idêntico ao `DeleteConfirmDialog` compartilhado.

**Solução:** Remover `DeleteWebhookDialog` local e usar `DeleteConfirmDialog` com props customizáveis.

### 3.5 MÉDIO: `ListSectionHeader` - Componente órfão

**Arquivo:** `shared/list-section-header.tsx` (34 linhas)

**Análise:**
- Criado para ser usado em listas
- **Apenas usado em `instances/page.tsx:202`**
- Não usado em `webhooks-list.tsx` (que deveria usar)

**Solução:** Usar em `webhooks-list.tsx` ou remover se desnecessário.

---

## 4. Plano de Refatoração

### Fase 1: Extrair Funções Utilitárias

**Arquivo:** `lib/utils.ts`

```typescript
// Adicionar ao lib/utils.ts

/**
 * Format Brazilian phone number for display
 * Input: "5511999999999" → Output: "+55 11 99999-9999"
 */
export function formatPhone(phone: string | undefined): string {
  if (!phone) return "Não conectado";
  if (phone.length >= 12) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  return phone;
}

/**
 * Get human-readable status text for an instance
 */
export function getInstanceStatusText(
  status: "online" | "connecting" | "offline",
  messagesUsed: number
): string {
  const parts: string[] = [];
  switch (status) {
    case "online": parts.push("Online"); break;
    case "connecting": parts.push("Conectando..."); break;
    case "offline": parts.push("Offline"); break;
  }
  if (messagesUsed > 0) {
    parts.push(`${messagesUsed} msgs`);
  }
  return parts.join(" · ");
}
```

**Atualizar:**
- `instance-card.tsx` - Importar de `~/lib/utils`
- `instances-widget.tsx` - Importar de `~/lib/utils`

### Fase 2: Unificar InstanceCard e InstanceRow

**Ação:** Deletar `instance-row.tsx`

**Atualizar `instances/page.tsx`:**
```typescript
// Antes
import { InstanceRow } from "~/components/instances/instance-row";
import { InstanceCard } from "~/components/instances/instance-card";

// Depois
import { InstanceCard } from "~/components/instances/instance-card";

// No render, usar InstanceCard para ambos
{view === "cards" ? (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {instances.map((instance) => (
      <InstanceCard key={instance.id} {...} />
    ))}
  </div>
) : (
  <div className="space-y-3">
    {instances.map((instance) => (
      <InstanceCard key={instance.id} {...} />
    ))}
  </div>
)}
```

### Fase 3: Padronizar Botões de Ação

**Arquivo:** `instance-card.tsx`

```tsx
// Antes (INCORRETO)
<Button
  variant="outline"
  size="icon"
  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30"
>

// Depois (CORRETO - padrão webhook-card)
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 text-muted-foreground hover:text-destructive"
>
```

**Arquivos a atualizar:**
- `instance-card.tsx` - Botões Disconnect e Delete
- `instances-widget.tsx` - Botões internos (linhas 172-234)

### Fase 4: Remover DeleteWebhookDialog Duplicado

**Arquivo:** `webhooks-list.tsx`

```typescript
// Remover linhas 114-175 (DeleteWebhookDialog local)

// Adicionar import
import { DeleteConfirmDialog } from "~/components/shared/delete-confirm-dialog";

// No render, usar DeleteConfirmDialog
<DeleteConfirmDialog
  itemName={deletingWebhook?.name ?? ""}
  open={deleteDialogOpen}
  onOpenChange={setDeleteDialogOpen}
  onConfirm={handleDelete}
  isLoading={deleteMutation.isPending}
  title="Deletar Webhook"
  description="Esta ação é irreversível. O webhook será removido permanentemente."
/>
```

### Fase 5: Usar ListSectionHeader no webhooks-list

**Arquivo:** `webhooks-list.tsx`

```tsx
// Adicionar import
import { ListSectionHeader } from "~/components/shared/list-section-header";

// Substituir header manual (linhas 421-438) por:
<ListSectionHeader
  title="Webhooks"
  icon={Webhook}
  count={webhooks.length}
  actions={
    <div className="flex items-center gap-2">
      <ViewToggle view={view} onViewChange={setView} />
      <Button size="sm" onClick={handleOpenAddDialog}>
        <Plus className="h-4 w-4 mr-1.5" />
        Adicionar
      </Button>
    </div>
  }
  hideActionsWhenEmpty
/>
```

---

## 5. Documentação - README.md

### 5.1 `components/shared/README.md`

```markdown
# Componentes Compartilhados

Componentes reutilizáveis em toda a aplicação.

## Componentes

### EditableName
Nome editável inline com click-to-edit.

```tsx
<EditableName name="Nome" onSave={(name) => {}} />
```

### StatusBadge
Badge colorido para status de instância.

```tsx
<StatusBadge status="online" /> // online | connecting | offline
```

### StatusDot
Indicador mínimo de status (dot ou spinner).

```tsx
<StatusDot status="online" size="md" />
```

### ViewToggle
Toggle entre visualização list/cards.

```tsx
<ViewToggle view={view} onViewChange={setView} />
```

### DeleteConfirmDialog
Dialog de confirmação para deletar itens.

```tsx
<DeleteConfirmDialog
  itemName="Nome do item"
  open={open}
  onOpenChange={setOpen}
  onConfirm={() => {}}
  title="Título personalizado"
  description="Descrição personalizada"
/>
```

### ListSectionHeader
Header padronizado para seções de lista.

```tsx
<ListSectionHeader
  title="Título"
  icon={Icon}
  count={10}
  actions={<Button>Ação</Button>}
/>
```

## Padrões Visuais

### Botões de Ação (Delete, Disconnect)
```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 text-muted-foreground hover:text-destructive"
>
  <Trash2 className="h-4 w-4" />
</Button>
```

### Cards Clicáveis
```tsx
<motion.div
  className="group rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30 cursor-pointer"
>
```
```

### 5.2 `components/instances/README.md`

```markdown
# Componentes de Instâncias

Componentes para gerenciamento de instâncias WhatsApp.

## Componentes

### InstanceCard
Card para exibir uma instância WhatsApp.

```tsx
<InstanceCard
  instance={instance}
  onRename={(name) => {}}
  onDisconnect={() => {}}
  onDelete={() => {}}
  onClick={() => {}}
  isDisconnecting={false}
/>
```

### InstanceFormDialog
Dialog para criar/reconectar instância com QR Code.

```tsx
<InstanceFormDialog
  open={open}
  onOpenChange={setOpen}
  onSuccess={() => {}}
  existingInstanceId="id" // opcional, para reconexão
/>
```

## Funções Utilitárias

Importar de `~/lib/utils`:

```tsx
import { formatPhone, getInstanceStatusText } from "~/lib/utils";

formatPhone("5511999999999"); // "+55 11 99999-9999"
getInstanceStatusText("online", 50); // "Online · 50 msgs"
```
```

### 5.3 `components/dashboard/README.md`

```markdown
# Componentes do Dashboard

Widgets e componentes da página principal.

## Widgets

### InstancesWidget
Carousel de instâncias com stats e ações rápidas.

### WebhooksList
Lista de webhooks com CRUD completo.

### WebhookCard
Card individual de webhook.

## Componentes de Suporte

### WebhookFormDialog
Form para criar/editar webhook.

### WebhookLogsDialog
Dialog para visualizar logs de um webhook.
```

### 5.4 Atualizar `/home/pedro/dev/CLAUDE.md`

Adicionar seção:

```markdown
## Componentes Frontend

### Estrutura
```
app/src/components/
├── shared/           # Componentes reutilizáveis (ver README.md)
├── instances/        # Componentes de instâncias (ver README.md)
├── dashboard/        # Widgets do dashboard (ver README.md)
└── ui/              # shadcn/ui components
```

### Padrões

- **Botões de ação**: Usar `variant="ghost"` com `hover:text-destructive`
- **Cards clicáveis**: `group rounded-lg border bg-card p-4 hover:bg-muted/30`
- **Funções utilitárias**: `formatPhone()`, `getInstanceStatusText()` em `lib/utils.ts`
```

---

## 6. Checklist de Execução

- [ ] **Fase 1:** Extrair `formatPhone` e `getInstanceStatusText` para `lib/utils.ts`
- [ ] **Fase 2:** Deletar `instance-row.tsx`, atualizar `instances/page.tsx`
- [ ] **Fase 3:** Padronizar botões em `instance-card.tsx` e `instances-widget.tsx`
- [ ] **Fase 4:** Remover `DeleteWebhookDialog` local de `webhooks-list.tsx`
- [ ] **Fase 5:** Usar `ListSectionHeader` em `webhooks-list.tsx`
- [ ] **Fase 6:** Criar README.md em `shared/`, `instances/`, `dashboard/`
- [ ] **Fase 7:** Atualizar `/home/pedro/dev/CLAUDE.md`
- [ ] **Fase 8:** Testar visualmente todas as páginas afetadas
- [ ] **Fase 9:** Commit final

---

## 7. Estimativa de Impacto

| Métrica | Antes | Depois | Redução |
|---------|-------|--------|---------|
| Linhas duplicadas | ~160 | 0 | 100% |
| Arquivos redundantes | 1 | 0 | 100% |
| Funções duplicadas | 5 | 0 | 100% |
| Inconsistências visuais | 2 | 0 | 100% |
| Componentes órfãos | 1 | 0 | 100% |

---

## 8. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Quebrar layout existente | Testar cada página após mudança |
| Import paths incorretos | Verificar com TypeScript |
| Comportamento diferente | Comparar props antes/depois |
