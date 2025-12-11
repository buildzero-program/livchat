/**
 * Script para corrigir o providerId da instância existente
 *
 * Problema: Salvamos o `name` (livchat_xxx) como providerId
 * Solução: Atualizar para o `id` interno do WuzAPI (746d1d2879c4b03c6e94a4995ea8d4ca)
 */

import { db } from "~/server/db";
import { instances } from "~/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  // O name que usamos como providerId
  const wrongProviderId = "livchat_786771ff4a1847ad";

  // O ID correto do WuzAPI (obtido dos logs)
  const correctProviderId = "746d1d2879c4b03c6e94a4995ea8d4ca";

  console.log("=== Corrigindo providerId ===");
  console.log(`De: ${wrongProviderId}`);
  console.log(`Para: ${correctProviderId}`);

  // Buscar a instância
  const instance = await db.query.instances.findFirst({
    where: eq(instances.providerId, wrongProviderId),
  });

  if (!instance) {
    console.log("\nInstância não encontrada com providerId:", wrongProviderId);
    process.exit(1);
  }

  console.log("\nInstância encontrada:");
  console.log(`  ID: ${instance.id}`);
  console.log(`  Name: ${instance.name}`);
  console.log(`  WhatsApp JID: ${instance.whatsappJid}`);

  // Atualizar o providerId
  await db
    .update(instances)
    .set({ providerId: correctProviderId })
    .where(eq(instances.id, instance.id));

  console.log("\n✅ providerId atualizado com sucesso!");

  // Verificar
  const updated = await db.query.instances.findFirst({
    where: eq(instances.id, instance.id),
  });

  console.log(`\nNovo providerId: ${updated?.providerId}`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Erro:", error);
  process.exit(1);
});
