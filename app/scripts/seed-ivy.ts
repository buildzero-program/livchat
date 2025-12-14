#!/usr/bin/env bun
/**
 * Seed script para criar o workflow da Ivy no LivChat.
 *
 * Uso:
 *   cd /home/pedro/dev/sandbox/livchat/app
 *   bun run scripts/seed-ivy.ts
 */

import { db } from "../src/server/db";
import { workflows } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

const IVY_WORKFLOW = {
  providerId: "wf_ivy",
  name: "Ivy",
  description: "Assistente virtual do LivChat.ai",
  organizationId: null, // Sistema (não pertence a nenhuma org)
  isActive: true,
};

async function seedIvy() {
  console.log("🔗 Conectando ao banco...");

  // Verifica se já existe
  const existing = await db.query.workflows.findFirst({
    where: eq(workflows.providerId, IVY_WORKFLOW.providerId),
  });

  if (existing) {
    console.log(`⚠️  Workflow '${IVY_WORKFLOW.providerId}' já existe`);
    console.log(`   ID: ${existing.id}`);
    console.log(`   Nome: ${existing.name}`);
    console.log(`   Criado em: ${existing.createdAt}`);
    return;
  }

  // Cria o workflow
  const [created] = await db.insert(workflows).values(IVY_WORKFLOW).returning();

  if (!created) {
    console.error("❌ Falha ao criar workflow");
    process.exit(1);
  }

  console.log(`✅ Workflow '${IVY_WORKFLOW.providerId}' criado!`);
  console.log();
  console.log("📋 Detalhes:");
  console.log(`   ID: ${created.id}`);
  console.log(`   Provider ID: ${created.providerId}`);
  console.log(`   Nome: ${created.name}`);
  console.log(`   Descrição: ${created.description}`);
  console.log(`   Ativo: ${created.isActive}`);
  console.log();
  console.log("🎉 Seed completo!");
}

seedIvy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
