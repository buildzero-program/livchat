import { db } from "~/server/db";
import { events } from "~/server/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  const recentEvents = await db.select().from(events).orderBy(desc(events.createdAt)).limit(10);

  console.log("=== EVENTOS NO BANCO ===");
  console.log(`Total encontrado: ${recentEvents.length}`);

  for (const event of recentEvents) {
    console.log(`
ID: ${event.id}
Name: ${event.name}
Instance ID: ${event.instanceId}
Organization ID: ${event.organizationId}
Created At: ${event.createdAt}
Metadata: ${JSON.stringify(event.metadata, null, 2)}
---`);
  }

  process.exit(0);
}

main();
