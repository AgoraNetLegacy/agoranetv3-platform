// Minimal internal support queue for the Help & Support slice. The product
// creates cases; this CLI lets an authorized operator inspect and close them
// without exposing an admin surface. Run only in an operator-controlled
// terminal whose DATABASE_URL points at the intended environment.

import { db } from "../lib/db";

function reference(id: string): string {
  return `AN-${id.slice(-8).toUpperCase()}`;
}

async function resolveCase(value: string) {
  const normalized = value.replace(/^AN-/i, "").toLowerCase();
  const matches = await db.supportCase.findMany({
    where: { id: { endsWith: normalized } },
    take: 2,
  });
  if (matches.length !== 1) {
    throw new Error(matches.length === 0 ? `No case found for ${value}.` : `Reference ${value} is ambiguous.`);
  }
  return matches[0];
}

async function main() {
  const [command = "list", value] = process.argv.slice(2);
  if (command === "list") {
    const cases = await db.supportCase.findMany({
      where: { status: { not: "closed" } },
      orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
      take: 100,
    });
    if (cases.length === 0) {
      console.log("No open support cases.");
      return;
    }
    for (const item of cases) {
      console.log(
        `${reference(item.id)}  ${item.severity.toUpperCase().padEnd(13)} ` +
          `${item.category.padEnd(24)} ${item.subject}`
      );
    }
    return;
  }

  if (!value) throw new Error(`Usage: npm run support:cases -- ${command} AN-REFERENCE`);
  const item = await resolveCase(value);
  if (command === "show") {
    console.log(`Reference: ${reference(item.id)}`);
    console.log(`Status: ${item.status} · Severity: ${item.severity} · Category: ${item.category}`);
    console.log(`Created: ${item.createdAt.toISOString()}`);
    console.log(`Profile scope: ${item.profileId ?? "guest"}`);
    console.log(`Reply email: ${item.contactEmail ?? "not provided"}`);
    console.log(`Context: ${item.safeContext ?? "{}"}`);
    console.log(`Source article: ${item.sourceArticle ?? "none"}`);
    console.log(`\n${item.subject}\n${item.description}`);
    return;
  }
  if (command === "close") {
    await db.supportCase.update({ where: { id: item.id }, data: { status: "closed" } });
    console.log(`${reference(item.id)} closed.`);
    return;
  }
  throw new Error("Commands: list, show, close");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
