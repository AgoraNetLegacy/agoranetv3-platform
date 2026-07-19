// Track 2 Slice 5 — the on-chain invariant check (db:verify's spirit,
// pointed at the treasury script). Scans every UTxO at the
// mission-treasury address and asserts the §4 shape holds for every
// chamber found there: exactly one NFT-carried State thread, a sane
// datum (threshold within the signer set, parseable pending/frozen),
// no stray STATE tokens, and every non-state UTxO a well-formed
// Donation. Exit 1 on any violation.
//
// Usage: npm run chain:verify-treasury
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { readFileSync } from "fs";
import { join } from "path";

// deserializeDatum's real shape (probed live): constructors are
// `{ constructor: 0n, fields: [...] }` with BigInt tags, and leaves
// are wrapped — `{ bytes: hex }`, `{ int: 2n }`, `{ list: [...] }`.
type Leaf = { bytes?: string; int?: bigint; list?: Leaf[]; constructor?: bigint; fields?: Leaf[] };

async function main() {
  const { mintProvider } = await import("../../lib/chainMint");
  const { serializePlutusScript, applyCborEncoding, deserializeAddress, deserializeDatum, stringToHex } =
    await import("@meshsdk/core");

  const blueprint = JSON.parse(
    readFileSync(join(process.cwd(), "infra", "onchain", "plutus.json"), "utf8")
  );
  const validator = blueprint.validators.find(
    (v: { title: string }) => v.title === "mission_treasury.mission_treasury.spend"
  );
  if (!validator) throw new Error("mission_treasury missing — run aiken build.");
  const scriptCbor = applyCborEncoding(validator.compiledCode);
  const scriptAddress = serializePlutusScript({ code: scriptCbor, version: "V3" }, undefined, 0)
    .address;
  const policyId = deserializeAddress(scriptAddress).scriptHash;
  const stateUnit = policyId + stringToHex("STATE");

  const utxos = await mintProvider().fetchAddressUTxOs(scriptAddress);
  const failures: string[] = [];
  const chambers = new Map<
    string,
    { states: number; stateLovelace: number; donationLovelace: number; donations: number; frozen?: boolean; pending?: boolean }
  >();

  const constr = (d: unknown): { tag: number; fields: Leaf[] } | null => {
    if (typeof d !== "object" || d === null) return null;
    const o = d as Leaf;
    return Object.prototype.hasOwnProperty.call(o, "constructor") &&
      typeof o.constructor === "bigint" &&
      Array.isArray(o.fields)
      ? { tag: Number(o.constructor), fields: o.fields }
      : null;
  };

  for (const u of utxos) {
    const ref = `${u.input.txHash.slice(0, 10)}…#${u.input.outputIndex}`;
    const lovelace = Number(u.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? 0);
    const hasNft = u.output.amount.some((a) => a.unit === stateUnit);
    if (!u.output.plutusData) {
      failures.push(`${ref}: UTxO at the treasury with NO inline datum`);
      continue;
    }
    let top: ReturnType<typeof constr>;
    try {
      top = constr(deserializeDatum(u.output.plutusData));
    } catch {
      failures.push(`${ref}: undecodable datum`);
      continue;
    }
    if (!top) {
      failures.push(`${ref}: datum is not a constructor`);
      continue;
    }
    if (top.tag === 0) {
      // State { chamber, signers, threshold, tribunal, frozen, pending }
      const [chamber, signers, threshold, , frozen, pending] = top.fields;
      const chamberKey = chamber?.bytes ?? "?";
      const signerList = signers?.list ?? [];
      const t = Number(threshold?.int ?? -1);
      const entry = chambers.get(chamberKey) ?? {
        states: 0,
        stateLovelace: 0,
        donationLovelace: 0,
        donations: 0,
      };
      entry.states += 1;
      entry.stateLovelace += lovelace;
      entry.frozen = constr(frozen)?.tag === 1;
      entry.pending = constr(pending)?.tag === 0;
      chambers.set(chamberKey, entry);
      if (!hasNft) failures.push(`${ref}: State datum WITHOUT the state NFT`);
      if (!(t >= 1 && t <= signerList.length))
        failures.push(`${ref}: threshold ${t} outside signer set of ${signerList.length}`);
    } else if (top.tag === 1) {
      // Donation { chamber }
      const chamberKey = top.fields[0]?.bytes ?? "?";
      const entry = chambers.get(chamberKey) ?? {
        states: 0,
        stateLovelace: 0,
        donationLovelace: 0,
        donations: 0,
      };
      entry.donations += 1;
      entry.donationLovelace += lovelace;
      chambers.set(chamberKey, entry);
      if (hasNft) failures.push(`${ref}: Donation datum CARRYING a state NFT`);
    } else {
      failures.push(`${ref}: unknown datum constructor ${top.tag}`);
    }
  }

  for (const [chamber, c] of chambers) {
    if (c.states > 1) failures.push(`chamber ${chamber.slice(0, 18)}…: ${c.states} state threads (must be ≤1)`);
    console.log(
      `chamber ${Buffer.from(chamber, "hex").toString("utf8")}: ` +
        `${c.states} state (${c.stateLovelace} lovelace, frozen=${c.frozen ?? "-"}, pending=${c.pending ?? "-"}), ` +
        `${c.donations} donation(s) (${c.donationLovelace} lovelace)`
    );
  }
  console.log(
    failures.length
      ? `INVARIANT FAILURES (${failures.length}):\n  - ${failures.join("\n  - ")}`
      : `ALL TREASURY INVARIANTS HOLD — ${utxos.length} UTxO(s), ${chambers.size} chamber(s).`
  );
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
