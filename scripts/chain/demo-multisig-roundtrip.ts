// On-chain migration Slice 4a — the M-of-N release, live on preprod.
// Three throwaway signer keys (no funds — they only sign), a 2-of-3
// release lock, and both verdicts: release REFUSED with one
// authorised signature, RELEASED with two. attestRelease's threshold,
// proven as chain mathematics. The dev wallet pays fees and receives
// the release; its own signature is deliberately NOT in the signer
// set, so "the operator signed" never satisfies the rule.
//
// Usage: npx tsx scripts/chain/demo-multisig-roundtrip.ts
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { readFileSync } from "fs";
import { join } from "path";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { mintWallet, mintProvider } = await import("../../lib/chainMint");
  const { lockedAtScriptOnConfiguredTestnet, cardanoNetwork } = await import("../../lib/chain");
  const {
    MeshWallet,
    MeshTxBuilder,
    Transaction,
    mConStr0,
    serializePlutusScript,
    applyCborEncoding,
    deserializeAddress,
  } = await import("@meshsdk/core");

  const net = cardanoNetwork();
  const wallet = await mintWallet();
  const provider = mintProvider();
  const payerAddr =
    (await wallet.getUsedAddresses())[0] ?? (await wallet.getChangeAddress());

  // The release-lock script, from the committed blueprint.
  const blueprint = JSON.parse(
    readFileSync(join(process.cwd(), "infra", "onchain", "plutus.json"), "utf8")
  );
  const validator = blueprint.validators.find(
    (v: { title: string }) => v.title === "release.release_lock.spend"
  );
  if (!validator) throw new Error("release_lock missing from plutus.json — run aiken build.");
  const scriptCbor = applyCborEncoding(validator.compiledCode);
  const scriptAddress = serializePlutusScript({ code: scriptCbor, version: "V3" }, undefined, 0)
    .address;

  // Three throwaway signers — keys brewed on the spot, never funded,
  // never stored. Their only act is signing (or not signing).
  const signers = [];
  for (let i = 0; i < 3; i++) {
    const words = MeshWallet.brew() as string[];
    const w = new MeshWallet({ networkId: 0, key: { type: "mnemonic", words } });
    await w.init();
    const hash = deserializeAddress(await w.getChangeAddress()).pubKeyHash;
    signers.push({ w, hash });
  }
  console.log(`network: ${net}`);
  console.log(`script:  ${scriptAddress}`);
  console.log(`signers: ${signers.map((s) => s.hash.slice(0, 8)).join(", ")} — threshold 2 of 3`);

  // --- 1. Lock 3 tADA behind 2-of-3.
  const datum = mConStr0([signers.map((s) => s.hash), 2]);
  const lockTx = new Transaction({ initiator: wallet });
  lockTx.sendLovelace({ address: scriptAddress, datum: { value: datum, inline: true } }, "3000000");
  const lockHash = await wallet.submitTx(await wallet.signTx(await lockTx.build()));
  console.log(`LOCK submitted: ${lockHash}`);
  let locked: number | null = null;
  for (let i = 0; i < 60 && locked === null; i++) {
    await sleep(5000);
    locked = await lockedAtScriptOnConfiguredTestnet(lockHash, scriptAddress);
  }
  if (locked === null || locked <= 0) throw new Error("Lock never confirmed at the script.");
  console.log(`CONFIRMED: ${locked} lovelace locked behind 2-of-3.`);

  const utxo = (await provider.fetchAddressUTxOs(scriptAddress)).find(
    (u) => u.input.txHash === lockHash
  );
  if (!utxo) throw new Error("Script UTxO not found via provider.");

  // --- 2. Collateral (after the lock — its coin selection must not
  // eat this), same drill as the donation roundtrip.
  const findPure = async () =>
    (await wallet.getUtxos()).find(
      (u) =>
        u.output.amount.length === 1 &&
        Number(u.output.amount[0]?.quantity ?? 0) >= 5_000_000
    );
  let collateral = await findPure();
  if (!collateral) {
    console.log("Creating a pure-ADA collateral UTxO (5 tADA self-send)…");
    const cTx = new Transaction({ initiator: wallet });
    cTx.sendLovelace(payerAddr, "5000000");
    const cHash = await wallet.submitTx(await wallet.signTx(await cTx.build()));
    for (let i = 0; i < 60 && !collateral; i++) {
      await sleep(5000);
      collateral = await findPure();
    }
    if (!collateral) throw new Error(`Collateral UTxO never appeared (${cHash}).`);
    console.log("Collateral ready.");
  }

  // Build a release co-signed by the given signers. required_signers
  // is what the validator reads as extra_signatories; each named key
  // must actually witness the tx or phase 1 refuses it outright.
  const buildRelease = async (withSigners: { hash: string }[]) => {
    const b = new MeshTxBuilder({ fetcher: provider, submitter: provider });
    b.spendingPlutusScriptV3()
      .txIn(utxo.input.txHash, utxo.input.outputIndex, utxo.output.amount, scriptAddress)
      .txInInlineDatumPresent()
      .txInRedeemerValue(mConStr0([]))
      .txInScript(scriptCbor)
      .txOut(payerAddr, utxo.output.amount)
      .txInCollateral(
        collateral!.input.txHash,
        collateral!.input.outputIndex,
        collateral!.output.amount,
        collateral!.output.address
      )
      .changeAddress(payerAddr)
      .selectUtxosFrom(await wallet.getUtxos());
    for (const s of withSigners) b.requiredSignerHash(s.hash);
    return b.complete();
  };

  const coSign = async (txHex: string, withSigners: { w: InstanceType<typeof MeshWallet> }[]) => {
    let tx = await wallet.signTx(txHex, true);
    for (const s of withSigners) tx = await s.w.signTx(tx, true);
    return tx;
  };

  // --- 3. The negative proof: ONE authorised signature (below the
  // threshold of two). Must be refused by the script. If it is ever
  // accepted, the release authority is broken — fail loudly.
  try {
    const under = await buildRelease([signers[0]]);
    await wallet.submitTx(await coSign(under, [signers[0]]));
    throw new Error(
      "UNDER-THRESHOLD RELEASE WAS ACCEPTED — M-of-N is NOT enforced. Do not ship this."
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("NOT enforced")) throw e;
    console.log(`1-OF-3 RELEASE REFUSED (as it must be): ${msg.slice(0, 250)}`);
  }

  // --- 4. The positive proof: two authorised signatures.
  const at = await buildRelease([signers[0], signers[1]]);
  const releaseHash = await wallet.submitTx(await coSign(at, [signers[0], signers[1]]));
  console.log(`2-OF-3 RELEASE submitted: ${releaseHash}`);
  let seen = false;
  for (let i = 0; i < 60 && !seen; i++) {
    await sleep(5000);
    seen = (await lockedAtScriptOnConfiguredTestnet(releaseHash, payerAddr)) !== null;
  }
  console.log(
    seen
      ? `MULTISIG ROUNDTRIP COMPLETE. lock=${lockHash} release=${releaseHash}`
      : `Release submitted but not yet indexed — check ${releaseHash} on ${net} manually.`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
