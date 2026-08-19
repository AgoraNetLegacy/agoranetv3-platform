// Short, idempotent platform sweeps intended for the Railway operations
// service. Keeping these off ordinary page requests prevents user traffic
// from becoming the job scheduler. User-facing routes retain narrow fallback
// checks until the live scheduler is independently verified.
import { loadEnvConfig } from "@next/env";
import { db } from "../lib/db";
import { purgeExpired } from "../lib/parking";
import { activateDueAliases } from "../lib/identity";
import { closeDuePolls } from "../lib/polls";
import { expireStaleRequests } from "../lib/fellowSouls";
import { runModerationSweeps } from "../lib/moderation";
import { notifyClosingPolls } from "../lib/notifications";

loadEnvConfig(process.cwd());

async function main() {
  await purgeExpired(db);
  const aliasesActivated = await activateDueAliases(db);
  const pollsClosed = await closeDuePolls(db);
  await expireStaleRequests(db);
  await runModerationSweeps(db);
  await notifyClosingPolls(db);
  console.log(
    `Platform maintenance complete: ${aliasesActivated} legacy aliases activated; ${pollsClosed} polls closed.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
