/**
 * Script para corrigir providerId das instâncias em PRODUÇÃO
 *
 * Problema: Instâncias antigas têm providerId = name (livchat_xxx)
 * Solução: Consultar WuzAPI para obter o ID interno correto
 *
 * Uso:
 *   DATABASE_URL="..." WUZAPI_URL="..." WUZAPI_ADMIN_TOKEN="..." bun scripts/fix-provider-id-prod.ts
 */

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
const WUZAPI_URL = process.env.WUZAPI_URL || "https://wuz.livchat.ai";
const WUZAPI_ADMIN_TOKEN = process.env.WUZAPI_ADMIN_TOKEN;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

if (!WUZAPI_ADMIN_TOKEN) {
  console.error("WUZAPI_ADMIN_TOKEN is required");
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL!);

  console.log("=== Fix Provider IDs (Production) ===\n");
  console.log(`Database: ${DATABASE_URL?.split("@")[1]?.split("/")[0] || "unknown"}`);
  console.log(`WuzAPI: ${WUZAPI_URL}\n`);

  // 1. Buscar todas instâncias com providerId no formato antigo (livchat_xxx)
  const instances = await sql`
    SELECT id, name, provider_id, provider_token
    FROM instances
    WHERE provider_id LIKE 'livchat_%'
  `;

  console.log(`Found ${instances.length} instances with old providerId format\n`);

  if (instances.length === 0) {
    console.log("Nothing to fix!");
    await sql.end();
    return;
  }

  // 2. Para cada instância, consultar WuzAPI para obter o ID correto
  let fixed = 0;
  let errors = 0;

  for (const instance of instances) {
    console.log(`Processing: ${instance.provider_id}`);

    try {
      // Consultar WuzAPI admin endpoint para listar users
      const response = await fetch(`${WUZAPI_URL}/admin/users`, {
        headers: {
          Authorization: WUZAPI_ADMIN_TOKEN!,
        },
      });

      if (!response.ok) {
        throw new Error(`WuzAPI returned ${response.status}`);
      }

      const data = await response.json() as { data?: Array<{ id: string; name: string }> };
      const users = data.data || [];

      // Encontrar o user pelo name (que é igual ao providerId antigo)
      const wuzapiUser = users.find((u) => u.name === instance.provider_id);

      if (!wuzapiUser) {
        console.log(`  ⚠️  User not found in WuzAPI for: ${instance.provider_id}`);
        errors++;
        continue;
      }

      const correctProviderId = wuzapiUser.id;
      console.log(`  Found WuzAPI ID: ${correctProviderId}`);

      // Atualizar no banco
      await sql`
        UPDATE instances
        SET provider_id = ${correctProviderId}
        WHERE id = ${instance.id}
      `;

      console.log(`  ✅ Updated: ${instance.provider_id} -> ${correctProviderId}`);
      fixed++;
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      errors++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Fixed: ${fixed}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${instances.length}`);

  await sql.end();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
