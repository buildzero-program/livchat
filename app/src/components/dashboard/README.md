# Componentes do Dashboard

Widgets e componentes da página principal.

## Widgets

### InstancesWidget

Carousel de instâncias com stats e ações rápidas.

```tsx
<InstancesWidget />
```

Features:
- Navegação por carousel (setas)
- Stats: Conectado, Uptime, Mensagens
- Ações: Reconectar, Desconectar, Deletar
- Estados: Loading, Error, Empty

### WebhooksList

Lista de webhooks com CRUD completo.

```tsx
<WebhooksList />
```

Features:
- Criar/Editar/Deletar webhooks
- Toggle ativo/inativo
- View Logs
- Estados: Loading, Error, Empty

### WebhookCard

Card individual de webhook.

```tsx
<WebhookCard
  webhook={webhook}
  instances={instances}
  onRename={(name) => {}}
  onToggle={(isActive) => {}}
  onEdit={() => {}}
  onDelete={() => {}}
  onViewLogs={() => {}}
/>
```

## Componentes de Suporte

### WebhookFormDialog

Form para criar/editar webhook.

### WebhookLogsDialog

Dialog para visualizar logs de um webhook.

## Padrões

- Usa `ListSectionHeader` para headers de seção
- Usa `DeleteConfirmDialog` para confirmação de delete
- Botões seguem padrão `ghost` com `hover:text-destructive`
