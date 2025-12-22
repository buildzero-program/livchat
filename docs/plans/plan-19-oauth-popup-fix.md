# Plan 19: Fix OAuth Popup (Remover página hosted do Clerk)

## Status: EM EXECUÇÃO

Data: 2025-12-22

---

## 1. Contexto

### 1.1 Problema Atual

Ao clicar em "Continuar com Google" no AuthModal customizado:
1. ❌ Abre popup com a página `https://wanted-mutt-15.accounts.dev/sign-in` (página hosted do Clerk)
2. ❌ Usuário precisa clicar novamente em "Google" na página do Clerk
3. ❌ Redundância visual e UX ruim

### 1.2 Comportamento Esperado

1. ✅ Clicar em "Continuar com Google" no AuthModal
2. ✅ Popup abre **direto** em `accounts.google.com`
3. ✅ Usuário faz login no Google
4. ✅ Popup fecha automaticamente
5. ✅ Usuário é redirecionado para `/app`

### 1.3 Causa Raiz

O código atual usa `useSignUp` + `signUp.authenticateWithPopup`, mas deveria usar `useSignIn` + `signIn.authenticateWithPopup` para login de usuários existentes.

**Referência funcional:** `/home/pedro/dev/sandbox/buildzero/references/teste-front/livchat-front/app/login/page.tsx`

---

## 2. Arquivos Impactados

| Arquivo | Mudança |
|---------|---------|
| `src/components/common/navbar.tsx` | Trocar `useSignUp` → `useSignIn` |
| `src/app/sso-callback/page.tsx` | Adicionar detecção de popup e `window.close()` |

---

## 3. Implementação

### 3.1 Mudanças no `navbar.tsx`

**ANTES (errado):**
```typescript
import { useAuth, useSignUp } from "@clerk/nextjs";

const { signUp, isLoaded: signUpLoaded } = useSignUp();

await signUp.authenticateWithPopup({
  strategy: provider,
  redirectUrl,
  redirectUrlComplete: "/app",
  popup,
});
```

**DEPOIS (correto):**
```typescript
import { useAuth, useSignIn } from "@clerk/nextjs";

const { signIn, isLoaded: signInLoaded } = useSignIn();

await signIn.authenticateWithPopup({
  strategy: provider,
  redirectUrl,
  redirectUrlComplete: "/app",
  popup,
});
```

### 3.2 Mudanças no `sso-callback/page.tsx`

Adicionar lógica para fechar popup automaticamente:

```typescript
"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SSOCallbackPage() {
  useEffect(() => {
    // Se aberto em popup, fecha automaticamente após auth
    if (window.opener) {
      const timer = setTimeout(() => {
        window.close();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
        <p className="text-muted-foreground">Autenticando...</p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
```

---

## 4. Fluxo Correto (Após Fix)

```
┌─────────────────────────────────────────────────────────┐
│  LANDING PAGE (AuthModal customizado aberto)            │
│  ┌──────────────────────────────────────┐              │
│  │  [Continuar com Google]              │              │
│  │  [Continuar com GitHub]              │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
                    │ onClick
                    ▼
┌─────────────────────────────────────────────────────────┐
│  window.open() cria popup                               │
│  signIn.authenticateWithPopup({ popup })                │
│  ┌──────────────────────────────────────┐               │
│  │  POPUP → accounts.google.com         │  ← DIRETO!    │
│  │  (não passa por accounts.dev)        │               │
│  └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
                    │ usuário escolhe conta
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Google redireciona para: /sso-callback                 │
│  ┌──────────────────────────────────────┐              │
│  │  AuthenticateWithRedirectCallback    │              │
│  │  ▶ detecta window.opener             │              │
│  │  ▶ window.close() após 1s            │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
                    │ popup fecha
                    ▼
┌─────────────────────────────────────────────────────────┐
│  JANELA PRINCIPAL                                       │
│  ▶ router.replace("/app")                               │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Testes

### 5.1 Teste Manual

1. [ ] Abrir http://localhost:3000
2. [ ] Clicar em "Entrar" ou "Começar Grátis"
3. [ ] Verificar que AuthModal abre
4. [ ] Clicar em "Continuar com Google"
5. [ ] Verificar que popup abre **direto em accounts.google.com** (NÃO em accounts.dev)
6. [ ] Fazer login no Google
7. [ ] Verificar que popup fecha automaticamente
8. [ ] Verificar que usuário é redirecionado para /app

### 5.2 Teste com GitHub

1. [ ] Repetir os passos acima com "Continuar com GitHub"
2. [ ] Verificar que popup abre direto em github.com

---

## 6. Rollback

Se algo der errado, reverter para o commit anterior:
```bash
git checkout HEAD~1 -- src/components/common/navbar.tsx src/app/sso-callback/page.tsx
```

---

## 7. Referências

- **Implementação funcional:** `/home/pedro/dev/sandbox/buildzero/references/teste-front/livchat-front/app/login/page.tsx`
- **Clerk Docs:** https://clerk.com/docs/custom-flows/oauth-connections
