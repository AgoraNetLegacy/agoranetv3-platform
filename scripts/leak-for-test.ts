// Test fixture ONLY — used by tests/verify.test.ts to prove the
// identity-leak guard catches a correctly-chained event that names an
// internal id. This is the attack db:verify exists to catch; nothing in
// the application ever does this.

import { PrismaClient } from "@prisma/client";
import { appendEvent } from "../lib/ledger";

const db = new PrismaClient();

async function main() {
  const human = await db.human.findFirst();
  if (!human) throw new Error("no human to leak");
  await appendEvent(db, {
    actorType: "system",
    eventType: "test.bad-write",
    payload: { note: "correctly chained but names an internal id", ref: human.id },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
