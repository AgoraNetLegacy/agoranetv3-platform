import { loadEnvConfig } from "@next/env";
import { db } from "../lib/db";

loadEnvConfig(process.cwd());

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Refusing to unlink a wallet fixture unless DATABASE_URL is a file: SQLite database.");
  }

  const handle = (process.argv[2] ?? "slice-one-witness").replace(/^@/, "").trim().toLowerCase();
  const profile = await db.profile.findFirst({
    where: { handle, face: "TRUE_SELF", status: "active" },
    select: { id: true, handle: true },
  });
  if (!profile) throw new Error(`Active local True Self @${handle} was not found.`);

  const link = await db.testnetWalletLink.findUnique({ where: { profileId: profile.id } });
  if (!link) {
    console.log(`No local wallet link exists for @${profile.handle}.`);
    await db.$disconnect();
    return;
  }

  await db.testnetWalletLink.delete({ where: { profileId: profile.id } });
  await db.$disconnect();
  console.log(`Removed only the local wallet link for @${profile.handle} (${link.network}).`);
}

main().catch(async (error) => {
  await db.$disconnect();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
