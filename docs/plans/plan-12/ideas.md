# Plan 12 - Ideias

Consolidação das discussões para próximas implementações.

---

## 1. AST Gateway

Estender o worker existente (`api-gateway`) para rotear requests de AI.

### Rotas Novas

```
/v1/ai/chat                → AST /workflows/{workflowId}/stream
/v1/ai/workflows           → CRUD workflows (futuro)
```

### Escopo de Permissão

```typescript
// Novo escopo: ai:chat, ai:workflows
const requiredScope = `ai:${url.pathname.split("/")[3]}`;
// Ex: "/v1/ai/chat" → "ai:chat"
```

### Contabilização

- Logar tokens consumidos (input + output)
- Rate limit por requests E por tokens
- Headers: `X-Tokens-Used`, `X-Tokens-Remaining`

---

## 2. MCP LivChat (Tools para Ivy)

A Ivy poderá executar ações reais no LivChat do usuário via MCP tools.

### Padrão de Consentimento (baseado no BuildZero)

#### 2.1 Classificação de Ações

| Tipo | Exemplos | Confirmação |
|------|----------|-------------|
| **Leitura** | Listar instâncias, ver status | Não |
| **Escrita** | Enviar mensagem, criar grupo | Sim |
| **Destrutiva** | Desconectar instância, deletar | Sim + Warning |

#### 2.2 Tool Definition Pattern

```json
{
  "name": "send_whatsapp_message",
  "description": "Envia mensagem WhatsApp para um contato. AÇÃO CRÍTICA: Requer confirmação explícita do usuário antes de executar. Sempre explique o que será enviado e peça confirmação.",
  "parameters": {
    "type": "object",
    "properties": {
      "to": {
        "type": "string",
        "description": "Número do destinatário com código do país (ex: 5511999999999)"
      },
      "message": {
        "type": "string",
        "description": "Conteúdo da mensagem a ser enviada"
      },
      "instance_id": {
        "type": "string",
        "description": "ID da instância WhatsApp a usar. Se não informado, usa a principal."
      },
      "user_confirmed": {
        "type": "boolean",
        "description": "OBRIGATÓRIO: true apenas se o usuário confirmou explicitamente a ação. Nunca assumir confirmação."
      }
    },
    "required": ["to", "message", "user_confirmed"]
  }
}
```

#### 2.3 System Prompt - Seção de Confirmação

```markdown
## Confirmação de Ações Críticas

Para ações que modificam dados ou enviam mensagens, você DEVE:

1. **Explicar** claramente o que vai fazer
2. **Mostrar** os dados exatos (destinatário, conteúdo, instância)
3. **Listar** consequências da ação
4. **Perguntar** confirmação explícita
5. **Aguardar** resposta afirmativa ("sim", "confirmo", "pode enviar")
6. **Executar** apenas após confirmação

### Formato de Confirmação

"""
Você está solicitando **enviar mensagem WhatsApp**.

**Destinatário:** +55 11 99999-9999
**Instância:** Loja ABC (principal)
**Mensagem:**
> Olá! Seu pedido #1234 foi enviado.
> Código de rastreio: BR123456789

**Consequências:**
- A mensagem será enviada imediatamente
- O destinatário verá que veio do número da Loja ABC
- Não é possível cancelar após envio

Deseja prosseguir? Responda "sim" para confirmar.
"""

### Regras

- NUNCA execute ação crítica sem confirmação explícita
- NUNCA assuma que o usuário quer confirmar
- Se o usuário disser "envia pra todo mundo", peça confirmação para CADA envio ou pergunte se quer confirmar em lote
- Para ações destrutivas, adicione aviso extra em **vermelho** (⚠️)
```

#### 2.4 Fluxo Completo

```
Usuário: "manda um oi pro João"

Ivy:
1. Busca contato "João" nas instâncias do usuário
2. Encontra: +55 85 91234-5678 (João Silva)
3. Monta confirmação:

   "Você está solicitando **enviar mensagem WhatsApp**.

   **Destinatário:** +55 85 91234-5678 (João Silva)
   **Instância:** Minha Loja
   **Mensagem:**
   > oi

   Deseja prosseguir? Responda "sim" para confirmar."

4. Aguarda resposta

Usuário: "sim"

Ivy:
5. Executa tool com user_confirmed: true
6. Confirma: "✅ Mensagem enviada para João Silva!"
```

#### 2.5 Tools Planejadas

| Tool | Tipo | Confirmação |
|------|------|-------------|
| `list_instances` | Leitura | Não |
| `get_instance_status` | Leitura | Não |
| `list_contacts` | Leitura | Não |
| `send_message` | Escrita | Sim |
| `send_media` | Escrita | Sim |
| `create_group` | Escrita | Sim |
| `disconnect_instance` | Destrutiva | Sim + Warning |

---

## 3. Billing AI

Modelo híbrido de cobrança para uso de AI.

### Opções para o Usuário

#### Opção A: Créditos LivChat (Padrão)
- Usuário compra créditos no LivChat
- LivChat repassa para OpenAI/Anthropic + 5% margem
- Simples, sem configuração

#### Opção B: BYOK (Bring Your Own Key)
- Usuário adiciona sua própria API key
- Paga apenas 5% de taxa de infraestrutura
- Controle total de custos

### Contabilização

```typescript
interface AIUsageLog {
  apiKeyId: string;
  organizationId: string;
  workflowId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;        // Em centavos
  billingMode: 'credits' | 'byok';
  timestamp: string;
}
```

### Planos (Exemplo)

| Plano | Créditos AI/mês | Preço |
|-------|-----------------|-------|
| Starter | 100k tokens | Incluso |
| Pro | 1M tokens | Incluso |
| Business | 10M tokens | Incluso |
| Enterprise | Ilimitado | Custom |

---

## 4. Workflow Builder UI (Futuro)

Deixar para fase posterior. Ideias:

- React Flow para editor visual
- Nodes: Trigger, Agent, Condition, Action
- Templates prontos (Suporte, Vendas, etc)
- Preview/teste antes de publicar

---

## Prioridade Sugerida

1. **AST Gateway** - Conectar AI ao billing existente
2. **MCP LivChat** - Ivy operacional com confirmações
3. **Billing AI** - Contabilização de tokens
4. ~~Workflow Builder~~ - Futuro

---

## Referências

- Worker existente: `/home/pedro/dev/sandbox/livchat/workers/api-gateway/`
- Padrão de confirmação: `/home/pedro/dev/sandbox/buildzero/core-agent/src/modules/tasks/docs/`
- AST atual: `/home/pedro/dev/sandbox/livchat/ast/`
