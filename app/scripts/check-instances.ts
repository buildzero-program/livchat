import { db } from "~/server/db";
import { instances } from "~/server/db/schema";

async function main() {
  const all = await db.select({
    id: instances.id,
    name: instances.name,
    providerId: instances.providerId,
    providerToken: instances.providerToken,
    whatsappJid: instances.whatsappJid,
    status: instances.status,
  }).from(instances);

  console.log("=== INSTANCES IN DATABASE ===");
  for (const inst of all) {
    const token = inst.providerToken ? inst.providerToken.substring(0, 20) + "..." : "N/A";
    console.log(`
ID: ${inst.id}
Name: ${inst.name}
Provider ID: ${inst.providerId}
Provider Token: ${token}
WhatsApp JID: ${inst.whatsappJid}
Status: ${inst.status}
---`);
  }
  process.exit(0);
}

main();
