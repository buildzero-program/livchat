# Plan 13: AST Profiling - Timing Logs

## Contexto

O workflow da Ivy apresenta cold start de **15-18s** em produção, enquanto as subsequentes são rápidas (~1-2s).

**Dados do Profiling (PROD):**
```
agent_get_workflow:    0.027s
agent_get_model:       0.000s
stream_first_token:   15.116s  ← PROBLEMA!
agent_model_invoke:    1.124s
stream_total:         15.152s
```

O LLM (gemini-2.5-flash) está rápido (1.1s). Os ~14s restantes estão em algum lugar ANTES do agent executar.

## Root Cause Identificado

O decorator `@entrypoint()` com parâmetro `previous` faz o LangGraph carregar o **histórico do checkpoint** do PostgreSQL **ANTES** de executar a função:

```
astream_events() chamado
    ↓
LangGraph detecta 'previous' na assinatura
    ↓
Chama checkpointer.aget_state(thread_id) ← 14 SEGUNDOS AQUI!
    ↓
Injeta 'previous' na função
    ↓
Só então executa workflow_agent()
```

## Fase 1: Pontos já Instrumentados ✅

| # | Arquivo | Função | Status |
|---|---------|--------|--------|
| 1 | `memory/postgres.py` | `get_postgres_saver()` | ✅ |
| 2 | `memory/postgres.py` | `get_postgres_store()` | ✅ |
| 3 | `service/workflow_router.py` | `invoke_workflow()` | ✅ |
| 4 | `service/workflow_router.py` | `workflow_stream_generator()` | ✅ |
| 5 | `agents/workflow_agent.py` | `workflow_agent()` | ✅ |
| 6 | `core/llm.py` | `get_model()` | ✅ |

## Fase 2: Novos Pontos Críticos a Instrumentar

| # | Arquivo | Local | O que medir |
|---|---------|-------|-------------|
| 7 | `workflow_router.py` | Antes de `astream_events()` | Tempo até chamar o LangGraph |
| 8 | `workflow_router.py` | Dentro do loop de eventos | Tempo até primeiro evento chegar |
| 9 | `workflow_agent.py` | **Primeira linha** da função | Confirmar delay é ANTES da função |

## Implementação Fase 2

### Passo 1: Timing ANTES do astream_events

```python
# workflow_router.py - workflow_stream_generator()
# ANTES da linha: async for event in agent.astream_events(

start = start_timer()
log_timing("stream_before_astream_events", stream_start)

async for event in agent.astream_events(...):
    if not first_event_logged:
        log_timing("stream_first_event_received", stream_start)
        first_event_logged = True
```

### Passo 2: Timing na PRIMEIRA LINHA do workflow_agent

```python
# workflow_agent.py - workflow_agent()
@entrypoint()
async def workflow_agent(inputs, *, previous, config, store):
    # PRIMEIRA LINHA - confirmar que o delay é ANTES disso
    log_timing("workflow_agent_ENTERED", start_timer())  # start_timer retorna tempo atual

    agent_start = start_timer()
    # ... resto do código
```

### Passo 3: Testar com thread_id NOVO vs EXISTENTE

Se o problema for carregar histórico grande:
- Thread novo (sem histórico): Deve ser rápido
- Thread existente (com histórico): Pode ser lento

## Hipóteses de Root Cause

### 1. MAIS PROVÁVEL: Neon DB Connection Latency
- Neon Serverless pode ter cold start próprio
- Connection pool "esfria" após período ocioso
- SSL handshake + auth em cada nova conexão

### 2. PROVÁVEL: Checkpoint Query Lenta
- Query no `checkpoints` table com `thread_id`
- Índice faltando ou ineficiente
- Dados grandes no checkpoint

### 3. POSSÍVEL: Pool Exhaustion
- Saver e Store usam pools separados
- Ambos tentando conexões simultaneamente
- Min connections = 5 pode não ser suficiente

## Validação

1. Deploy com novos timings: `flyctl deploy`
2. Testar com thread NOVO: `threadId: "new-test-123"`
3. Testar com thread EXISTENTE: `threadId: "profiling-test-cold"`
4. Comparar logs

## Próximos Passos (pós-diagnóstico)

Dependendo do gargalo confirmado:

### Se for Neon Connection:
- Aumentar `min_connections` no pool
- Implementar connection keep-alive
- Considerar Neon Pro (menos cold starts)

### Se for Checkpoint Query:
- Adicionar índice em `thread_id`
- Implementar pruning de histórico antigo
- Limitar tamanho do checkpoint

### Se for Pool Exhaustion:
- Compartilhar pool entre Saver e Store
- Aumentar `max_connections`
- Implementar retry com backoff

## Output Esperado (Fase 2)

```
⏱️ [stream_before_astream_events] 0.001s
⏱️ [stream_first_event_received] 14.234s  ← Confirmado: delay no LangGraph
⏱️ [workflow_agent_ENTERED] 14.235s       ← Confirmado: delay ANTES da função
⏱️ [agent_get_workflow] 0.027s
⏱️ [agent_get_model] 0.000s
⏱️ [agent_model_invoke] 1.124s
⏱️ [stream_first_token] 15.360s
⏱️ [stream_total] 15.400s
```

---

## 🎯 ROOT CAUSE CONFIRMADO (2025-12-16)

### Erro nos Logs de Produção:

```
psycopg_pool.PoolTimeout: couldn't get a connection after 30.00 sec
```

### Análise:

O problema é **Pool Timeout do psycopg** combinado com **Neon DB Cold Start**:

1. Quando a máquina Fly **suspende** (`auto_stop_machines = 'suspend'`), as conexões do pool morrem
2. Ao acordar, o pool tenta criar novas conexões com o Neon
3. **Neon Serverless** tem cold start próprio de 5-10s
4. O timeout padrão do psycopg_pool é **30 segundos**
5. Se Fly + Neon estão ambos "frios", a latência acumula e atinge o timeout

### Stack Trace:

```
workflow_router.py:435 → get_workflow(store, workflow_id)
    ↓
storage.py:72 → store.aget()
    ↓
langgraph/store/postgres/aio.py:167 → get_connection()
    ↓
psycopg_pool/pool_async.py:229 → PoolTimeout after 30.00 sec
```

---

## Fase 3: Solução - Pool Configuration Fix

### Problema atual em `memory/postgres.py`:

```python
async with AsyncConnectionPool(
    get_postgres_connection_string(),
    min_size=5,
    max_size=20,
    # FALTA: timeout, open, max_waiting
)
```

### Solução Proposta:

```python
async with AsyncConnectionPool(
    get_postgres_connection_string(),
    min_size=5,
    max_size=20,
    timeout=60,           # Aumentar timeout para 60s (Neon cold start)
    open=True,            # Aguardar conexões prontas no startup
    max_waiting=10,       # Limitar fila de espera
    kwargs={...},
    check=AsyncConnectionPool.check_connection,
)
```

### Parâmetros Adicionados:

| Parâmetro | Valor | Motivo |
|-----------|-------|--------|
| `timeout` | 60 | Dar tempo para Neon cold start |
| `open` | True | Pool aguarda conexões no startup |
| `max_waiting` | 10 | Evita queue infinita |

### Alternativa: Connection Warmup

Adicionar warmup explícito após criar o pool:

```python
# Após criar o pool, fazer warmup
async with pool.connection() as conn:
    await conn.execute("SELECT 1")  # Força conexão real
```

---

## Deploy da Solução

1. Editar `memory/postgres.py` com novos parâmetros
2. Adicionar settings para os novos parâmetros
3. Deploy: `flyctl deploy --now`
4. Testar cold start novamente
5. Monitorar logs

---

## Fase 4: Timing Granular (2025-12-16)

### Objetivo
Descobrir EXATAMENTE onde estão os ~14s de delay com logs em CADA ponto.

### Pontos a Instrumentar

#### 1. service/service.py - Lifespan
```
[lifespan_init_start] → database pools inicializando
[lifespan_db_contexts_entered] → pools prontos
[lifespan_saver_setup_done] → checkpointer setup
[lifespan_store_setup_done] → store setup
[lifespan_agents_start] → carregando agents
[lifespan_agents_all_loaded] → agents prontos
```

#### 2. memory/postgres.py - Pool Creation
```
[pool_config] → configuração do pool
[pool_entered] → pool context manager entrou
[checkpointer_before_setup] → antes do setup
[store_pool_entered] → store pool entrou
[store_before_setup] → antes do store setup
```

#### 3. workflow_router.py - Stream Request
```
[stream_config_created] → config criado
[stream_calling_astream_events] → ANTES de chamar LangGraph
[stream_before_astream] ← já existe
[stream_first_event] ← já existe
```

#### 4. workflow_agent.py - Agent Function
```
[workflow_agent_ENTERED] ← já existe
[agent_params] → workflow_id, thread_id
[agent_previous] → tamanho do histórico
[agent_calling_get_workflow] → antes de buscar workflow
[agent_calling_get_model] → antes de buscar modelo
[agent_invoking_model] → antes de chamar LLM
```

### Análise dos Gaps

| Gap | Se > 5s | Causa Provável |
|-----|---------|----------------|
| `lifespan_init_start` → `lifespan_db_contexts_entered` | Pool criando conexões |
| `stream_calling_astream_events` → `workflow_agent_ENTERED` | **Checkpoint loading!** |
| `agent_get_workflow` | Store query lento |
| `agent_model_invoke` | LLM request |

### Hipóteses Ranqueadas

1. **Pool frio + min_size alto** (70%) - 5 conexões no startup = ~10s
2. **Checkpoint loading** (60%) - Query + deserialize de histórico grande
3. **Neon cold start** (50%) - Database hibernado
4. **Store query lento** (30%) - Índice faltando

---

## Fase 5: Implementação das Soluções (2025-12-16)

### 5.1 Desligar Suspend no Fly.io ✅

**Arquivo:** `fly.toml`
```toml
auto_stop_machines = 'off'  # Era 'suspend'
```

**Benefício:** Máquina não suspende, conexões não morrem.

### 5.2 Pool Warmup com `pool.wait()`

**Problema:** `AsyncConnectionPool` é LAZY - não cria conexões reais no startup.

**Solução:** Usar `await pool.wait(timeout=30.0)` para forçar criação de conexões.

**Código:** Em `memory/postgres.py`, após criar o pool:
```python
async with AsyncConnectionPool(...) as pool:
    # WARMUP - força conexões reais
    await pool.wait(timeout=30.0)
    # ... resto do código
```

**Impacto:**
- Startup: +5-10s (absorve cold start do Neon)
- Primeira request: ~100ms (conexão já pronta!)

### 5.3 Neon Pooler (PgBouncer)

**Descoberta:** Já usa hostname `-pooler` mas porta errada!
```
Host: ep-...-pooler.sa-east-1.aws.neon.tech
Porta: 5432 ❌ (conexão direta)
Porta: 6543 ✅ (via PgBouncer)
```

**Mudança:**
1. `POSTGRES_PORT=6543`
2. Adicionar `&pgbouncer=true` na connection string
3. Reduzir pool local: `min=1, max=5`

**Benefício:** PgBouncer mantém conexões quentes permanentemente.
