# Plan-15.4: Input Layout ChatGPT (Simplificado)

**Data:** 2024-12-19
**Status:** ✅ Concluído (Simplificado)
**Dependências:** Plan-15.3 (Input Alignment)
**Escopo:** Layout fixo de duas linhas estilo ChatGPT

## Objetivo

Implementar o padrão de input do ChatGPT onde:
1. **Single-line**: Tudo na mesma linha horizontal
2. **Multi-line**: Textarea vai para cima (full-width), botões ficam numa linha separada embaixo

---

## Referência Visual (ChatGPT)

### Single-line:
```
┌───────────────────────────────────────────────┐
│ [+] Pergunte algo...                  [🎤] [↑] │
└───────────────────────────────────────────────┘
```

### Multi-line (expandido):
```
┌───────────────────────────────────────────────┐
│ Linha 1 do texto...                           │
│ Linha 2 do texto...                           │
│ Linha 3 do texto...                           │
├───────────────────────────────────────────────┤
│ [+]                                   [🎤] [↑] │
└───────────────────────────────────────────────┘
```

---

## Implementação

### 1. Detectar Multi-line

```typescript
const [isExpanded, setIsExpanded] = useState(false);

// No useEffect de auto-resize
useEffect(() => {
  const textarea = textareaRef.current;
  if (textarea) {
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(scrollHeight, 150)}px`;

    // Detectar se tem mais de 1 linha
    const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
    const isMultiLine = scrollHeight > lineHeight * 1.5;
    setIsExpanded(isMultiLine);
  }
}, [value]);
```

### 2. Layout Adaptativo com Framer Motion

```tsx
<motion.div
  layout
  className={cn(
    "relative rounded-2xl border border-border bg-muted/40 p-1.5",
    "shadow-sm",
    "focus-within:border-border focus-within:ring-2 focus-within:ring-ring/20",
    // Layout muda baseado no estado
    isExpanded ? "flex flex-col gap-2" : "flex flex-row items-end gap-2"
  )}
>
  {/* Quando expandido: Textarea primeiro (full-width) */}
  {isExpanded ? (
    <>
      <motion.textarea layout className="w-full ..." />
      <motion.div layout className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button>[+]</Button>
        </div>
        <div className="flex gap-2">
          <Button>[🎤]</Button>
          <Button>[↑]</Button>
        </div>
      </motion.div>
    </>
  ) : (
    // Layout normal (single-line)
    <>
      <Button>[+]</Button>
      <Button>[🎤]</Button>
      <textarea className="flex-1 ..." />
      <Button>[↑]</Button>
    </>
  )}
</motion.div>
```

### 3. Animação Suave

Usar `layout` prop do Framer Motion:
- Anima automaticamente mudanças de posição/tamanho
- GPU-accelerated via CSS transforms
- Adicionar `layout` em elementos filhos para evitar distorção

```tsx
<motion.div layout className="...">
  <motion.textarea layout="position" />
  <motion.div layout className="...">
    {/* buttons */}
  </motion.div>
</motion.div>
```

---

## Considerações

### Ordem dos Elementos

**Single-line (atual):**
```
[+] [🎤] [textarea] [↑]
```

**Multi-line (ChatGPT style):**
```
[textarea - full width]
[+]                [🎤] [↑]
```

Note que no ChatGPT:
- O botão `+` fica à esquerda
- Os botões `🎤` e `↑` ficam à direita
- Isso usa `justify-between` na linha de botões

### Transição do Recording Mode

Quando está gravando, já temos um layout diferente. O modo expandido não deve conflitar com isso.

### CSS Transitions

Adicionar transições suaves para altura:
```css
textarea {
  transition: height 0.2s ease-in-out;
}
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/ai-chat/ai-chat-input.tsx` | Refatorar para layout adaptativo |

---

## Checklist

### Fase 1 - Estado de Expansão
- [x] Adicionar estado `isExpanded`
- [x] Calcular `isExpanded` baseado em scrollHeight vs lineHeight
- [x] Threshold: `scrollHeight > lineHeight * 1.5`

### Fase 2 - Layout Adaptativo
- [x] Estrutura condicional: single-line vs multi-line
- [x] Single-line: `flex-row items-end`
- [x] Multi-line: `flex-col`, textarea primeiro, botões embaixo
- [x] Botões em linha separada: `[+]` esquerda, `[🎤][↑]` direita

### Fase 3 - Animação
- [x] Adicionar `layout` prop ao container
- [x] Adicionar `layout` aos elementos filhos (textarea, buttons row)
- [x] Transições suaves via Framer Motion

### Fase 4 - Testes Visuais
- [ ] Testar expansão ao digitar múltiplas linhas
- [ ] Testar contração ao apagar texto
- [ ] Testar modo gravação
- [ ] Testar com imagem anexada
- [ ] Verificar responsividade

---

## Referências

- [Framer Motion Layout Animations](https://motion.dev/docs/react-layout-animations)
- [ChatGPT Input Component Pattern](https://chat.openai.com)
- [CSS-Tricks: Animating Flexbox](https://css-tricks.com/animating-css-grid-how-to-examples/)
