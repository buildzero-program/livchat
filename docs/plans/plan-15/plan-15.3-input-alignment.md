# Plan-15.3: Refatoração do Alinhamento do Input

**Data:** 2024-12-19
**Status:** ✅ Concluído
**Dependências:** Plan-15.2 (Audio Support)
**Escopo:** Corrigir alinhamento vertical de ícones com texto

## Problema

Os ícones (Plus, Mic, Send) não estão perfeitamente alinhados verticalmente com o texto.

**Comportamento esperado (ChatGPT/Claude):**
1. **Single-line**: Ícones alinhados verticalmente com o texto
2. **Multi-line**: Ícones ficam FIXOS no bottom (não sobem com o texto)

---

## Tentativas

### Tentativa 1: `items-end` sem wrappers ❌

```tsx
<div className="relative flex items-end gap-2 ...">
  <Button className="h-8 w-8">...</Button>  {/* 32px */}
  <textarea className="py-2 min-h-[36px]">...</textarea>  {/* 36px */}
</div>
```

**Problema**: Botões (32px) são 4px menores que textarea (36px). Com `items-end`, botões alinham ao bottom mas ficam 4px abaixo do centro visual do texto.

### Tentativa 2: `items-start` + wrappers ❌

```tsx
<div className="relative flex items-start gap-2 ...">
  <div className="flex h-9 items-center">
    <Button className="h-8 w-8">...</Button>
  </div>
  <textarea className="py-2 min-h-[36px]">...</textarea>
</div>
```

**Problema**: Com `items-start`, os wrappers alinham ao TOPO. Quando textarea expande (multiline), wrappers ficam no topo → botões "sobem" junto com o texto. ❌

---

## Solução Correta (v3) ✅

### Estratégia: `items-end` + Wrappers com Mesma Altura do Textarea

**Princípio**:
- `items-end` → elementos alinham ao FUNDO do container
- Wrappers com `h-9` (36px) = mesma altura que `min-h-[36px]` do textarea
- Quando single-line: ambos têm 36px, alinhados ao bottom = mesma posição
- Quando multi-line: textarea expande, wrappers ficam no bottom = comportamento correto

```
Single-line (36px textarea, 36px wrappers):
┌─────────────────────────────────────┐
│ [+] [🎤] | Pergunte algo...  [↑] │  ← items-end + mesma altura = alinhados
└─────────────────────────────────────┘

Multi-line (textarea expandido para 100px):
┌─────────────────────────────────────┐
│          | Linha 1...           │
│          | Linha 2...           │
│ [+] [🎤] | Linha 3...        [↑] │  ← items-end = wrappers no bottom
└─────────────────────────────────────┘
```

### Por que funciona

1. **`items-end`**: Todos os flex items alinham ao FUNDO do container
2. **Wrappers (h-9 = 36px)**: Mesma altura que textarea mínimo
3. **Single-line**: Container tem 36px, todos alinham ao bottom = mesma posição visual
4. **Multi-line**: Textarea expande o container, wrappers continuam no bottom

### Implementação Final

```tsx
<div
  className={cn(
    "relative flex items-end gap-2",  // ✅ items-end (NÃO items-start!)
    "rounded-2xl border border-border bg-muted/40 p-1.5",
    ...
  )}
>
  {/* Wrapper h-9 = 36px = min-height do textarea */}
  <div className="flex h-9 shrink-0 items-center">
    <Button className="h-8 w-8">
      <Plus />
    </Button>
  </div>

  <div className="flex h-9 shrink-0 items-center">
    <Button className="h-8 w-8">
      <Mic />
    </Button>
  </div>

  <textarea className="py-2 min-h-[36px] max-h-[150px] ..." />

  <div className="flex h-9 shrink-0 items-center">
    <Button className="h-8 w-8">
      <ArrowUp />
    </Button>
  </div>
</div>
```

---

## Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `src/components/ai-chat/ai-chat-input.tsx` | Mudou `items-start` → `items-end` |

---

## Checklist

### Implementação
- [x] Criar wrappers com `h-9` (36px) para botões
- [x] Usar `items-center` nos wrappers para centralizar botões
- [x] ~~Mudar container para `items-start`~~ ERRADO
- [x] Manter/voltar container para `items-end` ✅

### Testes Visuais
- [ ] Testar com texto de uma linha
- [ ] Testar com texto multiline (expandido)
- [ ] Testar modo gravação
- [ ] Verificar responsividade

---

## Lições Aprendidas

1. **`items-start` vs `items-end`**: A diferença é crucial para comportamento de expansão
2. **Altura matching**: Wrappers devem ter mesma altura que o elemento de referência (textarea)
3. **Padrão ChatGPT/Claude**: Ícones ficam no BOTTOM quando expande, não no topo

---

## Referências

- [Flexbox align-items - CSS-Tricks](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- [shadcn Input components](https://ui.shadcn.com/docs/components/input)
