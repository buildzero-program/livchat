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
  hideActionsWhenEmpty
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
