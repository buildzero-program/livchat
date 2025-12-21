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

## Padrões

- Usa componentes de `~/components/shared/` (EditableName, StatusBadge)
- Botões seguem padrão `ghost` com `hover:text-destructive`
