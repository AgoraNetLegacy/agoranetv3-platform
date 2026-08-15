// On-chain migration Slice 3; the donation-lock roundtrip, headless.
// Proves the validator on the REAL preprod chain with the dev wallet
// playing both parts: donate → (try to collect EARLY: must be refused)
// → wait out the lock → collect. Nothing here touches a soul's wallet;
// the browser flow is the same donate leg signed by the soul instead.
//
// Usage: npx tsx scripts/chain/demo-donation-roundtrip.ts [lockSeconds]
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { mintWallet, mintProvider } = await import("../../lib/chainMint");
  const { donationScript, demoBeneficiaryHash } = await import("../../lib/chainDonation");
  const { lockedAtScriptOnConfiguredTestnet, cardanoNetwork } = await import("../../lib/chain");
  const { Transaction, mConStr0, resolveSlotNo } = await import("@meshsdk/core");

  const net = cardanoNetwork();
  const lockSeconds = Number(process.argv[2] ?? 90);
  const lovelace = "3000000";
  const wallet = await mintWallet();
  const provider = mintProvider();
  const { scriptCbor, address: scriptAddress } = await donationScript();
  const beneficiary = await demoBeneficiaryHash();
  const collectorAddr =
    (await wallet.getUsedAddresses())[0] ?? (await wallet.getChangeAddress());

  console.log(`network: ${net}`);
  console.log(`script:  ${scriptAddress}`);

  // The chain's own clock: the latest block's slot, straight from
  // Blockfrost. Mesh's local ms→slot mapping drifts tens of seconds
  // from the node's; never infer "the window is open" from wallclock.
  const latestSlot = async (): Promise<number> => {
    const res = await fetch(
      `https://cardano-${net}.blockfrost.io/api/v0/blocks/latest`,
      { headers: { project_id: process.env.BLOCKFROST_PROJECT_ID! } }
    );
    if (!res.ok) throw new Error(`latest block lookup failed (${res.status})`);
    return Number(((await res.json()) as { slot: number }).slot);
  };

  // --- 1. Donate: lock value at the script with the inline datum.
  const unlockAfter = Date.now() + lockSeconds * 1000;
  console.log(`lock: ${lockSeconds}s (unlock at ${new Date(unlockAfter).toISOString()})`);
  const donateTx = new Transaction({ initiator: wallet });
  donateTx.sendLovelace(
    { address: scriptAddress, datum: { value: mConStr0([beneficiary, unlockAfter]), inline: true } },
    lovelace
  );
  const donateHash = await wallet.submitTx(await wallet.signTx(await donateTx.build()));
  console.log(`DONATE submitted: ${donateHash}`);

  // --- 2. Wait until the chain shows the funds at the script.
  let locked: number | null = null;
  for (let i = 0; i < 60 && locked === null; i++) {
    await sleep(5000);
    locked = await lockedAtScriptOnConfiguredTestnet(donateHash, scriptAddress);
  }
  if (locked === null || locked <= 0) throw new Error("Donation never confirmed at the script.");
  console.log(`CONFIRMED: ${locked} lovelace locked at the script.`);

  const utxos = await provider.fetchAddressUTxOs(scriptAddress);
  const utxo = utxos.find((u) => u.input.txHash === donateHash);
  if (!utxo) throw new Error("Script UTxO not found via provider.");

  // --- 2b. Collateral, AFTER the donation: made earlier, the donate
  // leg's coin selection would spend it out from under us. A pure-ADA
  // UTxO (script spends require one; the wallet consolidates into a
  // single token-carrying UTxO otherwise).
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
    cTx.sendLovelace(collectorAddr, "5000000");
    const cHash = await wallet.submitTx(await wallet.signTx(await cTx.build()));
    for (let i = 0; i < 60 && !collateral; i++) {
      await sleep(5000);
      collateral = await findPure();
    }
    if (!collateral) throw new Error(`Collateral UTxO never appeared (${cHash}).`);
    console.log("Collateral ready.");
  }

  // The collect builder; MeshTxBuilder, mirroring Mesh's own vesting
  // withdraw example (the pattern this slice adapts). The legacy
  // Transaction wrapper mis-serializes this input pattern; the modern
  // builder is the supported road. `invalidBeforeSlot` becomes the
  // validity-range start the validator reads as "earliest this tx can
  // exist." Live protocol params via the fetcher; stale cost models
  // fail ScriptIntegrityHash at the node.
  const buildCollect = async (invalidBeforeSlot: number) => {
    const { MeshTxBuilder } = await import("@meshsdk/core");
    const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider });
    return txBuilder
      .spendingPlutusScriptV3()
      .txIn(
        utxo.input.txHash,
        utxo.input.outputIndex,
        utxo.output.amount,
        scriptAddress
      )
      .txInInlineDatumPresent()
      .txInRedeemerValue(mConStr0([]))
      .txInScript(scriptCbor)
      .txOut(collectorAddr, utxo.output.amount)
      .txInCollateral(
        collateral.input.txHash,
        collateral.input.outputIndex,
        collateral.output.amount,
        collateral.output.address
      )
      .invalidBefore(invalidBeforeSlot)
      .requiredSignerHash(beneficiary)
      .changeAddress(collectorAddr)
      .selectUtxosFrom(await wallet.getUtxos())
      .complete();
  };

  // --- 3. The negative proof: a NODE-VALID transaction (validity
  // window already open) whose lower bound sits BEFORE the unlock;
  // so the refusal can only come from the validator's own rule.
  // If it ever succeeds, the lock is broken; fail loudly.
  if (Date.now() < unlockAfter - 15_000) {
    try {
      const early = await buildCollect((await latestSlot()) - 60);
      await wallet.submitTx(await wallet.signTx(early));
      throw new Error(
        "EARLY COLLECT WAS ACCEPTED; the time lock is NOT enforced. Do not ship this."
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("NOT enforced")) throw e;
      console.log(`EARLY COLLECT REFUSED BY THE VALIDATOR: ${msg.slice(0, 300)}`);
    }
  }

  // --- 4. Wait until the CHAIN's latest slot has passed the collect
  // window's opening; the node's clock, not ours.
  const startSlot = Number(resolveSlotNo(net, unlockAfter + 1000));
  console.log(`Waiting for the chain to pass slot ${startSlot}…`);
  for (let now = await latestSlot(); now <= startSlot + 1; now = await latestSlot()) {
    await sleep(10_000);
  }

  // --- 5. Collect: beneficiary-signed, validity opening at the unlock.
  const collectHash = await wallet.submitTx(
    await wallet.signTx(await buildCollect(startSlot))
  );
  console.log(`COLLECT submitted: ${collectHash}`);
  let seen = false;
  for (let i = 0; i < 60 && !seen; i++) {
    await sleep(5000);
    seen = (await lockedAtScriptOnConfiguredTestnet(collectHash, collectorAddr)) !== null;
  }
  console.log(
    seen
      ? `ROUNDTRIP COMPLETE. donate=${donateHash} collect=${collectHash}`
      : `Collect submitted but not yet indexed; check ${collectHash} on ${net} manually.`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
