# Plan 21: Settings Modal - Polish & UX Fixes

## Status: CONCLUÍDO

Data: 2025-12-22

---

## 1. Problemas Identificados

### 1.1 Bugs Funcionais

| Bug | Descrição | Causa |
|-----|-----------|-------|
| Eye invertido | Ícone do olho começa aberto mas key está escondida | Lógica invertida no ternário |
| Confirm nativo | `confirm()` do browser é feio e destoante | Deveria usar AlertDialog |
| Regenerar não atualiza | Após regenerar, key não muda visualmente | Cache do tRPC não invalida corretamente |

### 1.2 Problemas de Design

| Problema | Descrição |
|----------|-----------|
| Visual "infantil" | Modal não segue o design system elegante do resto do app |
| Sidebar sem profundidade | Falta visual depth nos itens de navegação |
| Botões muito simples | Faltam hover states e feedback visual adequados |
| Espaçamentos inconsistentes | Não segue o padrão do design system |

---

## 2. Correções Funcionais

### 2.1 Fix do Eye Icon

**Problema:** `keyRevealed ? <EyeOff> : <Eye>` está invertido

**Solução:**
- Quando `keyRevealed = false` → mostrar Eye (clique para revelar)
- Quando `keyRevealed = true` → mostrar EyeOff (clique para esconder)

A lógica atual está **correta**, mas o problema pode ser que o estado inicial `keyRevealed` começa `false` mas a query de reveal já pode ter dados cacheados.

**Fix:** Resetar o cache de reveal quando fechar o dialog.

### 2.2 AlertDialog para Confirmação

**Substituir:**
```typescript
if (confirm("Tem certeza?")) { ... }
```

**Por:**
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button>Regenerar</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Regenerar chave de API?</AlertDialogTitle>
      <AlertDialogDescription>
        A chave atual será invalidada imediatamente.
        Aplicações usando essa chave deixarão de funcionar.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={handleRegenerate}>
        Regenerar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 2.3 Fix do Regenerate não Atualizando

**Problema:** `refetchKeys()` é chamado mas a UI não atualiza

**Causa provável:** O `revealData` está cacheado e não é invalidado

**Solução:**
```typescript
const regenerateMutation = api.apiKeys.regenerate.useMutation({
  onSuccess: (data) => {
    toast.success("Chave regenerada!");
    // Invalidar cache da query reveal
    setKeyRevealed(false);
    // Forçar refetch
    void refetchKeys();
  },
});
```

Adicionar também `queryClient.invalidateQueries()` se necessário.

---

## 3. Melhorias de Design

### 3.1 Paleta e Classes Base (do Design System)

```css
/* Cores principais */
--primary: #7C3AED (light) / #8B5CF6 (dark)

/* Classes comuns */
bg-primary/10 text-primary     /* Active state */
text-muted-foreground          /* Secondary text */
rounded-lg                     /* Border radius padrão */
transition-all                 /* Animações suaves */
hover:bg-accent                /* Hover neutro */
shadow-xs                      /* Depth sutil */
```

### 3.2 Sidebar - Melhorias

**Antes:**
```tsx
className="bg-primary/10 text-primary font-medium"
```

**Depois:**
```tsx
className={cn(
  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
  isActive
    ? "bg-primary/10 text-primary font-medium shadow-sm"
    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
)}
```

### 3.3 API Key Section - Visual Upgrade

```tsx
<div className="p-4 rounded-lg border bg-muted/20 space-y-4">
  <div className="flex items-center gap-2">
    <code className="flex-1 text-sm font-mono bg-background px-4 py-2.5 rounded-md border shadow-xs">
      {displayToken}
    </code>
    {/* Botões com hover states melhorados */}
    <Button className="hover:bg-primary/10 hover:text-primary active:scale-95">
      ...
    </Button>
  </div>
</div>
```

### 3.4 Theme Selector - Cards Mais Elegantes

```tsx
<button
  className={cn(
    "flex flex-col items-center gap-3 p-5 rounded-lg border-2 transition-all flex-1",
    theme === value
      ? "border-primary bg-primary/5 shadow-sm"
      : "border-transparent bg-muted/30 hover:bg-muted/50 hover:border-border"
  )}
>
```

### 3.5 Profile Section - Card Style

```tsx
<div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
  <Avatar className="h-14 w-14 rounded-xl ring-2 ring-primary/10">
    ...
  </Avatar>
  <div>
    <div className="font-medium">{user?.fullName}</div>
    <div className="text-sm text-muted-foreground">{email}</div>
  </div>
</div>
```

---

## 4. Checklist de Implementação

### Bugs
- [x] Fix Eye icon (verificar lógica de estado)
- [x] Substituir `confirm()` por AlertDialog
- [x] Fix regenerate não atualizando (invalidar cache)

### Design
- [x] Melhorar hover states dos botões
- [x] Adicionar background card na seção API Key
- [x] Melhorar theme selector cards
- [x] Adicionar card na seção Profile
- [x] Ajustar espaçamentos (seguir design system)
- [x] Adicionar shadow-sm nos elementos interativos

---

## 5. Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `settings-dialog.tsx` | Todos os fixes e melhorias de UI |
| `ui/alert-dialog.tsx` | Verificar se existe (shadcn) |

---

## 6. Referências do Design System

- Sidebar: `src/components/layout/app-sidebar.tsx`
- AlertDialog: `src/components/ui/alert-dialog.tsx`
- Design tokens: `src/styles/globals.css`
- Cards: `src/components/ui/card.tsx`
