#!/usr/bin/env python3
"""
Seed script para criar o workflow da Ivy no AST.

Uso:
    cd /home/pedro/dev/sandbox/livchat/ast
    uv run python scripts/seed_ivy.py
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

# Adiciona o src ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from langgraph.store.postgres import AsyncPostgresStore

IVY_WORKFLOW_ID = "wf_ivy"

IVY_SYSTEM_PROMPT = """Você é a Ivy, assistente virtual inteligente do LivChat.ai - a plataforma de WhatsApp API para desenvolvedores.

## Sua Personalidade
- Simpática, profissional e direta
- Usa emojis com moderação para humanizar
- Fala português brasileiro fluente
- Tom amigável mas técnico quando necessário

## Sobre o LivChat
O LivChat é uma API REST simples para integrar WhatsApp em aplicações:
- Enviar mensagens de texto, mídia, botões
- Receber webhooks de mensagens
- Gerenciar múltiplas instâncias WhatsApp
- Dashboard para monitoramento

## Contexto
Hoje é @current_datetime.
Modelo: @model_name

## Comportamento
1. Responda perguntas sobre o LivChat de forma clara
2. Para dúvidas técnicas, seja preciso e dê exemplos de código
3. Para pricing, direcione ao site livchat.ai
4. Se não souber algo, admita e sugira alternativas
5. Mantenha respostas concisas (máx 3 parágrafos)

## Exemplo de Código
Quando perguntarem sobre integração, mostre:

```bash
curl -X POST https://api.livchat.ai/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "5511999999999", "text": "Hello!"}'
```
"""


def get_database_url() -> str:
    """Monta DATABASE_URL a partir das variáveis de ambiente."""
    # Tenta DATABASE_URL direto primeiro
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    # Monta a partir das variáveis separadas
    user = os.getenv("POSTGRES_USER")
    password = os.getenv("POSTGRES_PASSWORD")
    host = os.getenv("POSTGRES_HOST")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB")

    if all([user, password, host, db]):
        return f"postgresql://{user}:{password}@{host}:{port}/{db}?sslmode=require"

    return ""


async def seed_ivy():
    """Cria o workflow da Ivy no PostgresStore."""
    database_url = get_database_url()
    if not database_url:
        print("❌ DATABASE_URL não definida")
        print("   Defina via DATABASE_URL ou POSTGRES_* vars")
        sys.exit(1)

    print(f"🔗 Conectando ao banco...")
    print(f"   URL: {database_url[:50]}...")

    async with AsyncPostgresStore.from_conn_string(database_url) as store:
        # Prepara as tabelas
        await store.setup()

        namespace = ("workflows",)
        now = datetime.now(timezone.utc).isoformat()

        # Structure expected by workflow_agent.py
        workflow_data = {
            "id": IVY_WORKFLOW_ID,
            "name": "Ivy",
            "description": "Assistente virtual do LivChat.ai",
            "flowData": {
                "nodes": [
                    {
                        "id": "agent_1",
                        "type": "agent",
                        "config": {
                            "prompt": {
                                "system": IVY_SYSTEM_PROMPT,
                            },
                            "llm": {
                                "model": "gpt-4o-mini",
                            },
                            "memory": {
                                "tokenLimit": 16000,
                            },
                        },
                    }
                ],
                "edges": [],
            },
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }

        # Verifica se já existe
        existing = await store.aget(namespace, IVY_WORKFLOW_ID)

        if existing:
            print(f"⚠️  Workflow '{IVY_WORKFLOW_ID}' já existe")
            print(f"   Criado em: {existing.value.get('created_at', 'N/A')}")

            response = input("   Deseja sobrescrever? [y/N]: ")
            if response.lower() != "y":
                print("   ❌ Cancelado")
                return

            # Atualiza
            workflow_data["created_at"] = existing.value.get("created_at", now)
            await store.aput(namespace, IVY_WORKFLOW_ID, workflow_data)
            print(f"✅ Workflow '{IVY_WORKFLOW_ID}' atualizado!")
        else:
            # Cria novo
            await store.aput(namespace, IVY_WORKFLOW_ID, workflow_data)
            print(f"✅ Workflow '{IVY_WORKFLOW_ID}' criado!")

        print()
        print("📋 Detalhes:")
        print(f"   ID: {workflow_data['id']}")
        print(f"   Nome: {workflow_data['name']}")
        agent_config = workflow_data["flowData"]["nodes"][0]["config"]
        print(f"   Modelo: {agent_config['llm']['model']}")
        print(f"   Token Limit: {agent_config['memory']['tokenLimit']}")
        print(f"   Ativo: {workflow_data['is_active']}")
        print()
        print("🎉 Seed completo!")


if __name__ == "__main__":
    asyncio.run(seed_ivy())
