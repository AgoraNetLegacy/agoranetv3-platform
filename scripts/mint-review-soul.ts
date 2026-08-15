// Dev tool: mint a fully onboarded review soul on the dev database and
// print its access keys ONCE, to the terminal; for owner checkpoint
// walkthroughs when the previous session's 24h SoulSession has expired.
// Dev-database convenience only; the real ceremony lives at /verify.
//
// Run: npx tsx scripts/mint-review-soul.ts [handle]

import { PrismaClient } from "@prisma/client";
import { makeOnboardedSoul, topUpForTests } from "../tests/helpers/souls";

const db = new PrismaClient();

async function main() {
  const base = process.argv[2] ?? `review-${Date.now().toString(36).slice(-4)}`;
  const soul = await makeOnboardedSoul(db, {
    trueSelf: base,
    alias: `${base}-veil`,
    trueSelfDisplayName: "Shawn (review)",
    aliasDisplayName: "Veil (review)",
  });
  await topUpForTests(db, soul.trueSelfId, { pc: 100, g: 50 });
  await topUpForTests(db, soul.aliasId, { pc: 50, g: 25 });
  console.log(`Signed up through the real ceremonies. Sign in at /login with:`);
  console.log(`  True Self  @${base}        key: ${soul.trueSelfAccessKey}`);
  console.log(`  Alias      @${base}-veil   key: ${soul.aliasAccessKey}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
