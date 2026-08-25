import { createHash, randomBytes } from "crypto";
import { loadEnvConfig } from "@next/env";
import { db } from "../lib/db";

loadEnvConfig(process.cwd());

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Refusing to reissue a local Humanity Credential unless DATABASE_URL is a file: SQLite database.");
  }

  const handle = (process.argv[2] ?? "shawnb").replace(/^@/, "").trim().toLowerCase();
  const profile = await db.profile.findFirst({
    where: { handle, face: "TRUE_SELF", status: "active" },
    select: { handle: true, humanId: true },
  });
  if (!profile?.humanId) {
    throw new Error(`Active local True Self @${handle} was not found.`);
  }

  const credential = randomBytes(32).toString("hex");
  await db.human.update({
    where: { id: profile.humanId },
    data: { credentialHash: sha256(credential) },
  });
  await db.$disconnect();

  console.log(`LOCAL_ONLY_HUMANITY_CREDENTIAL for @${profile.handle}:`);
  console.log(credential);
  console.log("Save it privately. It will not be shown again.");
}

main().catch(async (error) => {
  await db.$disconnect();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
