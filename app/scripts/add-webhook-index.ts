/**
 * Script to add JSONB index for webhook logs optimization
 * Run with: bun run scripts/add-webhook-index.ts
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function main() {
  console.log("🔧 Adding webhook metadata indexes...\n");

  try {
    // Index 1: Simple index for webhookId lookups
    console.log("Creating idx_events_metadata_webhook_id...");
    await sql`
      CREATE INDEX IF NOT EXISTS idx_events_metadata_webhook_id
      ON events ((metadata->>'webhookId'))
    `;
    console.log("✓ idx_events_metadata_webhook_id created\n");

    // Index 2: Partial composite index for webhook logs query pattern
    console.log("Creating idx_events_webhook_logs...");
    await sql`
      CREATE INDEX IF NOT EXISTS idx_events_webhook_logs
      ON events ((metadata->>'webhookId'), name, created_at DESC)
      WHERE metadata->>'webhookId' IS NOT NULL
    `;
    console.log("✓ idx_events_webhook_logs created\n");

    // Verify indexes were created
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'events'
      AND indexname LIKE '%webhook%'
    `;

    console.log("📋 Webhook indexes on events table:");
    for (const idx of indexes) {
      console.log(`  - ${idx.indexname}`);
    }

    console.log("\n✅ Done!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
