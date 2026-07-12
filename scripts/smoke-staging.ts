// Staging smoke test: the public, signed-out surfaces answer with their
// landmark content. Run after every staging deploy (docs/DEPLOYMENT.md
// §3.6). No account, no writes — reading is free by constitutional
// design, so a smoke test needs no credentials.

const base = (process.env.STAGING_URL ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  throw new Error("Set STAGING_URL to the deployed origin, e.g. https://staging.example.org");
}

const SURFACES: Array<{ path: string; landmark: string }> = [
  { path: "/", landmark: "pillar" },
  { path: "/verify", landmark: "The gate" },
  { path: "/ledger", landmark: "ledger" },
  { path: "/transparency", landmark: "transparency dashboard" },
  { path: "/commons", landmark: "State of the Commons" },
  { path: "/feed/formula", landmark: "formula" },
  { path: "/circles", landmark: "Circle" },
  { path: "/pollinator", landmark: "chamber" },
];

async function main() {
  let failures = 0;
  for (const { path, landmark } of SURFACES) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, { redirect: "follow" });
      const body = await res.text();
      const ok = res.ok && body.toLowerCase().includes(landmark.toLowerCase());
      if (ok) {
        console.log(`✓ ${path} (${res.status}, landmark "${landmark}" present)`);
      } else {
        failures++;
        console.error(
          `✗ ${path}: status ${res.status}, landmark "${landmark}" ${
            body.toLowerCase().includes(landmark.toLowerCase()) ? "present" : "MISSING"
          }`
        );
      }
    } catch (error) {
      failures++;
      console.error(`✗ ${path}: ${(error as Error).message}`);
    }
  }
  if (failures) {
    console.error(`\nSMOKE FAILED: ${failures} surface(s).`);
    process.exit(1);
  }
  console.log("\nAll public surfaces answered with their landmarks.");
}

main();
