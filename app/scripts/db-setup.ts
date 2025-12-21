/**
 * Database Setup Script
 *
 * Runs Drizzle migrations and seeds programmatically.
 * Used by Docker entrypoint to auto-setup the database.
 *
 * Usage: bun run scripts/db-setup.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// =============================================================================
// Seeds - Essential data for the system to function
// =============================================================================

const IVY_WORKFLOW = {
  providerId: "wf_ivy",
  name: "Ivy",
  description: "Assistente virtual do LivChat.ai",
};

async function runSeeds(sql: postgres.Sql) {
  console.log("🌱 Running seeds...");

  // Seed: Ivy Workflow (required for AI assistant)
  const existing = await sql`
    SELECT id FROM workflows WHERE provider_id = ${IVY_WORKFLOW.providerId}
  `;

  if (existing.length > 0) {
    console.log("   ⚠️  Workflow 'wf_ivy' already exists, skipping");
  } else {
    await sql`
      INSERT INTO workflows (provider_id, name, description, is_active)
      VALUES (
        ${IVY_WORKFLOW.providerId},
        ${IVY_WORKFLOW.name},
        ${IVY_WORKFLOW.description},
        true
      )
    `;
    console.log("   ✅ Created workflow 'wf_ivy' (Ivy assistant)");
  }

  console.log("✅ Seeds complete!");
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  console.log("🔌 Connecting to database...");

  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);

  try {
    // Step 1: Run migrations
    console.log("📦 Running migrations...");
    await migrate(db, {
      migrationsFolder: "./drizzle",
    });
    console.log("✅ Migrations complete!");

    // Step 2: Run seeds
    await runSeeds(sql);
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
