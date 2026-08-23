// Operator-controlled grant management. A grant belongs to exactly one
// profile; it never grants access to another profile held by the same human.
import { db } from "../lib/db";
import { SUPPORT_OPERATOR_ROLES, type SupportOperatorRole } from "../lib/supportOperations";

async function profileFor(handleInput: string) {
  const handle = handleInput.replace(/^@/, "").trim().toLowerCase();
  const profile = await db.profile.findUnique({ where: { handle } });
  if (!profile) throw new Error(`No profile found for @${handle}.`);
  return profile;
}

async function main() {
  const [command = "list", handle, roleInput = "agent"] = process.argv.slice(2);
  if (command === "list") {
    const rows = await db.supportOperator.findMany({
      include: { profile: { select: { handle: true, displayName: true } } },
      orderBy: [{ active: "desc" }, { role: "asc" }, { profile: { handle: "asc" } }],
    });
    if (rows.length === 0) return console.log("No support operator grants.");
    for (const row of rows) console.log(`${row.active ? "ACTIVE  " : "REVOKED "}${row.role.padEnd(9)} @${row.profile.handle} (${row.profile.displayName})`);
    return;
  }
  if (!handle) throw new Error("Usage: npm run support:operators -- grant|revoke @handle [agent|lead|security]");
  const profile = await profileFor(handle);
  if (command === "grant") {
    if (!SUPPORT_OPERATOR_ROLES.includes(roleInput as SupportOperatorRole)) throw new Error("Role must be agent, lead, or security.");
    const role = roleInput as SupportOperatorRole;
    await db.$transaction(async (tx) => {
      await tx.supportOperator.upsert({
        where: { profileId: profile.id },
        create: { profileId: profile.id, role },
        update: { role, active: true },
      });
      await tx.supportAuditEvent.create({ data: { action: "operator.granted", details: JSON.stringify({ handle: profile.handle, role, changedBy: process.env.OPERATOR_NAME ?? "support-operators-cli" }) } });
    });
    console.log(`Granted ${role} support access to @${profile.handle}.`);
    return;
  }
  if (command === "revoke") {
    await db.$transaction(async (tx) => {
      await tx.supportOperator.update({ where: { profileId: profile.id }, data: { active: false } });
      await tx.supportAuditEvent.create({ data: { action: "operator.revoked", details: JSON.stringify({ handle: profile.handle, changedBy: process.env.OPERATOR_NAME ?? "support-operators-cli" }) } });
    });
    console.log(`Revoked support access from @${profile.handle}.`);
    return;
  }
  throw new Error("Commands: list, grant, revoke");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => db.$disconnect());
