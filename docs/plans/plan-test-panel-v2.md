# Test Panel v2 - Redesign Plan

> Landing page interactive API test panel redesign

## 1. Current State Analysis

### v1 Structure
```
┌─────────────────────────────────────────────────────────────────────┐
│ ✓ Success Banner (green)                                            │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┬───────────────────────────────────────────┐ │
│ │ TABS (disabled)     │ Language tabs (cURL/Node/Python)          │ │
│ │ [MENSAGEM|MÍDIA...] │ ┌───────────────────────────────────────┐ │ │
│ │                     │ │ curl -X POST...                       │ │ │
│ │ Phone input         │ │                                       │ │ │
│ │ [+55 11 99999...]   │ │                                       │ │ │
│ │                     │ └───────────────────────────────────────┘ │ │
│ │ Message textarea    │                                           │ │
│ │ [Sua mensagem...]   │ Response (animated)                       │ │
│ │                     │ ┌───────────────────────────────────────┐ │ │
│ │                     │ │ 200 OK                                │ │ │
│ │ [ENVIAR TESTE]      │ │ { success: true... }                  │ │ │
│ └─────────────────────┴───────────────────────────────────────────┘ │
│ Footer: phone | key: lc_live_*** | quota | [Criar Conta] [Sair]     │
└─────────────────────────────────────────────────────────────────────┘
```

### Problems
1. **Limited functionality**: Only text messages (5% of backend capabilities)
2. **Disabled tabs**: MÍDIA, GRUPOS, WEBHOOK shown but non-functional
3. **Rigid layout**: Fixed 5/12 + 7/12 split
4. **Visual clutter**: Multiple border lines, hardcoded colors
5. **Mixed concerns**: Form, code preview, quota all tightly coupled

---

## 2. Backend Capabilities (Available but not exposed)

### Priority 1 - Core Messaging
| Type | Endpoint | Fields |
|------|----------|--------|
| Text | `/chat/send/text` | phone, message ✅ |
| Image | `/chat/send/image` | phone, image (base64), caption |
| Video | `/chat/send/video` | phone, video (base64), caption |
| Audio | `/chat/send/audio` | phone, audio (base64) |
| Document | `/chat/send/document` | phone, document (base64), filename |
| Location | `/chat/send/location` | phone, latitude, longitude, name |
| Contact | `/chat/send/contact` | phone, vcard, name |

### Priority 2 - Interactive (WhatsApp Business)
| Type | Endpoint | Fields |
|------|----------|--------|
| List | `/chat/send/list` | phone, buttonText, sections[] |
| Poll | `/chat/send/poll` | phone, header, options[] |
| React | `/chat/react` | phone, messageId, emoji |

### Priority 3 - Message Management
| Type | Endpoint | Fields |
|------|----------|--------|
| Edit | `/chat/send/edit` | phone, messageId, newBody |
| Delete | `/chat/delete` | phone, messageId |

---

## 3. Design System Reference

### From Settings Dialog Pattern
- **No divider lines** (Notion-style)
- **Subtle backgrounds**: `bg-muted/40`, `bg-muted/50`
- **Soft shadows**: `shadow-sm`, `shadow-xs`
- **Rounded corners**: `rounded-xl` for cards
- **Ghost actions**: Buttons appear on hover
- **Purple accent**: Primary for CTAs
- **Consistent spacing**: `space-y-4`, `gap-4`
- **Typography**: `text-sm` body, `text-xs` labels

### Color Palette
```css
/* Backgrounds */
--card: #141414 (dark mode)
--muted: bg-muted/40, bg-muted/50

/* Accent */
--primary: #8B5CF6 (purple)
--primary/20: bg for selected states

/* Status */
--green: success, connected
--yellow: warning, processing
--red: error, invalid
```

---

## 4. v2 Architecture

### New Structure
```
┌─────────────────────────────────────────────────────────────────────┐
│ Connected: +55 11 99999-9999          [50/500 msgs] [Criar Conta]   │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┬───────────────────────────────────────────┐ │
│ │                     │                                           │ │
│ │ Message Type        │ API Preview                               │ │
│ │ ┌─┐ ┌─┐ ┌─┐ ┌─┐    │ ┌───────────────────────────────────────┐ │ │
│ │ │📝│ │🖼│ │📍│ │👤│    │ │ cURL  Node  Python                    │ │ │
│ │ └─┘ └─┘ └─┘ └─┘    │ │                                       │ │ │
│ │ Text Image Loc Cnt  │ │ curl -X POST api.livchat.ai/v1/...   │ │ │
│ │                     │ │   -H "Authorization: Bearer lc_..."   │ │ │
│ │ ─────────────────── │ │   -d '{ "phone": "55119..."  }'       │ │ │
│ │                     │ │                                 [👁][📋] │ │
│ │ Recipient           │ └───────────────────────────────────────┘ │ │
│ │ [+55 11 99999...] ✓ │                                           │ │
│ │ João Silva          │ Response                                  │ │
│ │                     │ ┌───────────────────────────────────────┐ │ │
│ │ Message             │ │ 200 OK  12ms                          │ │ │
│ │ [Hello World...]    │ │ {                                     │ │ │
│ │                     │ │   "success": true,                    │ │ │
│ │                     │ │   "messageId": "3EB0..."              │ │ │
│ │ [    SEND TEST    ] │ │ }                                     │ │ │
│ │                     │ └───────────────────────────────────────┘ │ │
│ └─────────────────────┴───────────────────────────────────────────┘ │
│                                                                     │
│ API Key: lc_live_c27K************************NdQJ  [👁] [📋]        │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Changes

1. **Top bar simplified**: Connection status + quota + CTA
2. **Type selector**: Icon grid instead of tabs (Text, Image, Location, Contact)
3. **Dynamic form**: Changes based on selected type
4. **API Preview**: Right side with language tabs
5. **Response area**: Below code, shows result after send
6. **Bottom bar**: API key with reveal/copy (clean)

---

## 5. Component Breakdown

### New Files Structure
```
src/components/marketing/
├── test-panel/
│   ├── index.tsx           # Main container
│   ├── type-selector.tsx   # Message type grid
│   ├── forms/
│   │   ├── text-form.tsx
│   │   ├── image-form.tsx
│   │   ├── location-form.tsx
│   │   └── contact-form.tsx
│   ├── code-preview.tsx    # cURL/Node/Python generator
│   ├── response-display.tsx
│   ├── recipient-input.tsx # Phone with validation
│   └── api-key-display.tsx # Bottom key bar
└── quota-indicator.tsx     # Existing (keep)
```

### Component Details

#### TypeSelector
```tsx
const MESSAGE_TYPES = [
  { id: "text", icon: MessageSquare, label: "Texto" },
  { id: "image", icon: Image, label: "Imagem" },
  { id: "location", icon: MapPin, label: "Local" },
  { id: "contact", icon: User, label: "Contato" },
] as const;
```

#### RecipientInput
- Phone input with validation indicator
- Shows verified name when valid
- Yellow warning for 9th digit normalization
- Red error for invalid numbers

#### Dynamic Forms

**TextForm**
```tsx
- message: textarea (required)
```

**ImageForm**
```tsx
- image: file picker (jpg, png, webp)
- caption: input (optional)
- preview: image thumbnail
```

**LocationForm**
```tsx
- latitude: number input
- longitude: number input
- name: input (optional)
- OR: interactive map picker
```

**ContactForm**
```tsx
- name: input (required)
- phone: input (required)
- email: input (optional)
- Generates vCard automatically
```

#### CodePreview
- Language tabs: cURL | Node | Python
- Syntax highlighting (optional: Shiki)
- Token masking with reveal toggle
- Copy button (copies with real token)
- Dynamic based on message type

#### ResponseDisplay
- Status badge: 200 OK (green) / 4xx (red)
- Response time indicator
- JSON syntax highlighting
- Animated entry (framer-motion)

---

## 6. Implementation Phases

### Phase 1: Refactor Structure
- [ ] Create folder structure
- [ ] Extract RecipientInput component
- [ ] Extract CodePreview component
- [ ] Extract ResponseDisplay component
- [ ] Create main container with new layout

### Phase 2: Type Selector
- [ ] Create TypeSelector with icon grid
- [ ] Add message type state management
- [ ] Style with design system (ghost buttons, selected state)

### Phase 3: Dynamic Forms
- [ ] Create TextForm (migrate existing)
- [ ] Create ImageForm with file picker
- [ ] Create LocationForm with inputs
- [ ] Create ContactForm with vCard generation

### Phase 4: Code Generation
- [ ] Update CodePreview for all types
- [ ] Add Node.js code generation
- [ ] Add Python code generation
- [ ] Dynamic endpoint/payload per type

### Phase 5: Backend Integration
- [ ] Add tRPC procedures for new types
- [ ] Add WuzAPI client methods
- [ ] Update callbacks in parent component

### Phase 6: Polish
- [ ] Animations (framer-motion)
- [ ] Loading states
- [ ] Error handling
- [ ] Mobile responsive

---

## 7. Props Interface (v2)

```typescript
interface TestPanelV2Props {
  // Connection
  isConnected: boolean;
  jid: string;

  // API Key
  apiKey: string;

  // Quota
  messagesUsed: number;
  messagesLimit: number;

  // Actions
  onDisconnect: () => void;
  onCreateAccount: () => void;

  // Message handlers (per type)
  onSendText: (phone: string, message: string) => Promise<SendResponse>;
  onSendImage: (phone: string, image: File, caption?: string) => Promise<SendResponse>;
  onSendLocation: (phone: string, lat: number, lng: number, name?: string) => Promise<SendResponse>;
  onSendContact: (phone: string, vcard: string, name: string) => Promise<SendResponse>;

  // Validation
  onValidatePhone: (phone: string) => Promise<ValidationResult>;

  // Loading states
  isSending?: boolean;
  isDisconnecting?: boolean;
}
```

---

## 8. Code Examples (for CodePreview)

### Text Message
```bash
# cURL
curl -X POST https://api.livchat.ai/v1/messages/send \
  -H "Authorization: Bearer lc_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"phone": "5511999999999", "body": "Hello!"}'
```

```javascript
// Node.js
const response = await fetch("https://api.livchat.ai/v1/messages/send", {
  method: "POST",
  headers: {
    "Authorization": "Bearer lc_live_xxx",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ phone: "5511999999999", body: "Hello!" })
});
```

```python
# Python
import requests

response = requests.post(
    "https://api.livchat.ai/v1/messages/send",
    headers={"Authorization": "Bearer lc_live_xxx"},
    json={"phone": "5511999999999", "body": "Hello!"}
)
```

### Image Message
```bash
curl -X POST https://api.livchat.ai/v1/messages/send/image \
  -H "Authorization: Bearer lc_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511999999999",
    "image": "data:image/jpeg;base64,/9j/4AAQ...",
    "caption": "Check this out!"
  }'
```

### Location Message
```bash
curl -X POST https://api.livchat.ai/v1/messages/send/location \
  -H "Authorization: Bearer lc_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511999999999",
    "latitude": -23.5505,
    "longitude": -46.6333,
    "name": "São Paulo, Brazil"
  }'
```

---

## 9. Style Guide (v2)

### Card Container
```tsx
<div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
```

### Section (no dividers)
```tsx
<div className="p-6 space-y-4">
  {/* Content separated by spacing only */}
</div>
```

### Type Selector Button
```tsx
<button
  className={cn(
    "flex flex-col items-center gap-2 p-3 rounded-lg transition-colors",
    isActive
      ? "bg-primary/20 text-primary"
      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
  )}
>
  <Icon className="h-5 w-5" />
  <span className="text-xs font-medium">{label}</span>
</button>
```

### Input Label
```tsx
<label className="text-sm text-muted-foreground mb-2 block">
  {label}
</label>
```

### Ghost Action Button
```tsx
<Button variant="ghost" size="icon" className="h-8 w-8">
  <Icon className="h-4 w-4" />
</Button>
```

---

## 10. Success Criteria

- [ ] All 4 message types working (text, image, location, contact)
- [ ] Clean layout matching settings dialog aesthetic
- [ ] No divider lines (Notion-style)
- [ ] Code preview for cURL, Node, Python
- [ ] Token masking with reveal toggle
- [ ] Mobile responsive
- [ ] Animations on type switch and response
- [ ] Quota indicator visible
- [ ] Under 500 lines total (vs current 461 monolith)
