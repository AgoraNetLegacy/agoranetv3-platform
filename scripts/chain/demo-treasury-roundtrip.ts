// Track 2 Slice 5 — the mission treasury, live on preprod.
// The full §4 cycle: INIT (state NFT + sane datum) → DONATE ×2
// (non-custodial, no contention) → PROPOSE (one attesting member,
// terms frozen in the datum) → 1-of-3 RELEASE REFUSED → 2-of-3
// RELEASE: recipient paid exactly the proposed amount, remainder
// provably back to the pot. Three throwaway attesting-member keys +
// a throwaway tribunal key (unused until Slice 6); the fee-paying
// dev wallet is NOT a signer — "the operator signed" moves nothing.
//
// Usage: npx tsx scripts/chain/demo-treasury-roundtrip.ts
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
    mConStr1,
    mConStr2,
    mConStr3,
    serializePlutusScript,
    applyCborEncoding,
    deserializeAddress,
    stringToHex,
  } = await import("@meshsdk/core");

  const net = cardanoNetwork();
  const wallet = await mintWallet();
  const provider = mintProvider();
  const payerAddr =
    (await wallet.getUsedAddresses())[0] ?? (await wallet.getChangeAddress());
  const payerHash = deserializeAddress(payerAddr).pubKeyHash;

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

  // Throwaway chamber: 3 attesting members + a tribunal key.
  const brew = async () => {
    const w = new MeshWallet({
      networkId: 0,
      key: { type: "mnemonic", words: MeshWallet.brew() as string[] },
    });
    await w.init();
    return { w, hash: deserializeAddress(await w.getChangeAddress()).pubKeyHash };
  };
  const signers = [await brew(), await brew(), await brew()];
  const tribunal = await brew();
  // Unique per run: failed attempts orphan their own chamber's UTxOs
  // instead of leaving two state NFTs answering to one chamber id.
  const chamberHex = stringToHex(`agora-demo-${Date.now()}`);

  console.log(`network: ${net}`);
  console.log(`script:  ${scriptAddress}`);
  console.log("chamber: unique per run — 2-of-3 attestors, tribunal held out for Slice 6");

  const stateDatum = (frozen: boolean, pending: ReturnType<typeof mConStr0> | null) =>
    mConStr0([
      chamberHex,
      signers.map((s) => s.hash),
      2,
      tribunal.hash,
      frozen ? mConStr1([]) : mConStr0([]),
      pending === null ? mConStr1([]) : mConStr0([pending]),
    ]);
  const donationDatum = mConStr1([chamberHex]);
  const purposeHex = stringToHex("slice5-demo: prove the §4 cycle");
  const pendingTerms = mConStr0([payerHash, 4_000_000, purposeHex]);

  const waitTx = async (hash: string, at: string) => {
    for (let i = 0; i < 60; i++) {
      await sleep(5000);
      if ((await lockedAtScriptOnConfiguredTestnet(hash, at)) !== null) return;
    }
    throw new Error(`tx ${hash} never confirmed`);
  };
  // The address-UTxO index lags the tx index: before building the next
  // spend, wait until the wallet SEES its own change from the last one
  // — or coin selection re-spends an input the chain already consumed.
  const waitWalletSees = async (txHash: string) => {
    for (let i = 0; i < 24; i++) {
      if ((await wallet.getUtxos()).some((u) => u.input.txHash === txHash)) return;
      await sleep(5000);
    }
    throw new Error(`wallet never saw change from ${txHash}`);
  };

  // Collateral is re-acquired FRESH before every Plutus leg — any
  // intervening transaction's coin selection may have eaten the last
  // one (the recurring trap of this toolchain, now handled once).
  const ensureCollateral = async () => {
    const findPure = async () =>
      (await wallet.getUtxos()).find(
        (u) =>
          u.output.amount.length === 1 &&
          Number(u.output.amount[0]?.quantity ?? 0) >= 5_000_000
      );
    let c = await findPure();
    if (!c) {
      console.log("Creating a pure-ADA collateral UTxO…");
      const cTx = new Transaction({ initiator: wallet });
      cTx.sendLovelace(payerAddr, "5000000");
      const cHash = await wallet.submitTx(await wallet.signTx(await cTx.build()));
      await waitTx(cHash, payerAddr);
      // The address-UTxO index lags the tx index by a few seconds.
      for (let i = 0; i < 24 && !c; i++) {
        await sleep(5000);
        c = await findPure();
      }
      if (!c) throw new Error("collateral never appeared");
    }
    return c;
  };
  // Never hand the collateral to input selection — it must survive.
  const spendables = async (c: { input: { txHash: string; outputIndex: number } }) =>
    (await wallet.getUtxos()).filter(
      (u) =>
        !(u.input.txHash === c.input.txHash && u.input.outputIndex === c.input.outputIndex)
    );
  let collateral = await ensureCollateral();

  // --- 1. INIT: mint the state NFT into a sane State UTxO (output 0).
  const initB = new MeshTxBuilder({ fetcher: provider, submitter: provider });
  const initUnsigned = await initB
    .mintPlutusScriptV3()
    .mint("1", policyId, stringToHex("STATE"))
    .mintingScript(scriptCbor)
    .mintRedeemerValue(mConStr0([0]))
    .txOut(scriptAddress, [
      { unit: "lovelace", quantity: "3000000" },
      { unit: stateUnit, quantity: "1" },
    ])
    .txOutInlineDatumValue(stateDatum(false, null))
    .txInCollateral(
      collateral.input.txHash,
      collateral.input.outputIndex,
      collateral.output.amount,
      collateral.output.address
    )
    .changeAddress(payerAddr)
    .selectUtxosFrom(await spendables(collateral))
    .complete();
  const initHash = await wallet.submitTx(await wallet.signTx(initUnsigned));
  console.log(`INIT submitted: ${initHash}`);
  await waitTx(initHash, scriptAddress);
  await waitWalletSees(initHash);
  console.log("CONFIRMED: state NFT minted, treasury thread live.");

  // --- 2. DONATE ×2 (plain payments to the script — no validator runs).
  const donate = async () => {
    const t = new Transaction({ initiator: wallet });
    t.sendLovelace(
      { address: scriptAddress, datum: { value: donationDatum, inline: true } },
      "3000000"
    );
    return wallet.submitTx(await wallet.signTx(await t.build()));
  };
  const d1 = await donate();
  await waitTx(d1, scriptAddress);
  await waitWalletSees(d1);
  const d2 = await donate();
  await waitTx(d2, scriptAddress);
  await waitWalletSees(d2);
  console.log(`DONATED 2×3 tADA: ${d1.slice(0, 12)}…, ${d2.slice(0, 12)}…`);

  // Our chamber's UTxOs only — orphans from failed runs carry other
  // chamber ids in their datums and are ignored.
  const utxosAt = async () =>
    (await provider.fetchAddressUTxOs(scriptAddress)).filter((x) =>
      (x.output.plutusData ?? "").includes(chamberHex)
    );
  // The state thread is tracked by its EXPECTED TIP — the tx that last
  // moved it — never by "whatever the lagging address index shows".
  const stateUtxoFrom = async (tipTxHash: string) => {
    for (let i = 0; i < 24; i++) {
      const u = (await utxosAt()).find(
        (x) =>
          x.input.txHash === tipTxHash &&
          x.output.amount.some((a) => a.unit === stateUnit)
      );
      if (u) return u;
      await sleep(5000);
    }
    throw new Error(`state UTxO from ${tipTxHash} never appeared in the address index`);
  };

  // --- 3. PROPOSE: one attesting member freezes the terms in-datum.
  let st = await stateUtxoFrom(initHash);
  collateral = await ensureCollateral();
  const propB = new MeshTxBuilder({ fetcher: provider, submitter: provider });
  const propUnsigned = await propB
    .spendingPlutusScriptV3()
    .txIn(st.input.txHash, st.input.outputIndex, st.output.amount, scriptAddress)
    .txInInlineDatumPresent()
    .txInRedeemerValue(mConStr0([0]))
    .txInScript(scriptCbor)
    .txOut(scriptAddress, st.output.amount)
    .txOutInlineDatumValue(stateDatum(false, pendingTerms))
    .txInCollateral(
      collateral.input.txHash,
      collateral.input.outputIndex,
      collateral.output.amount,
      collateral.output.address
    )
    .requiredSignerHash(signers[0].hash)
    .changeAddress(payerAddr)
    .selectUtxosFrom(await spendables(collateral))
    .complete();
  let propSigned = await wallet.signTx(propUnsigned, true);
  propSigned = await signers[0].w.signTx(propSigned, true);
  const propHash = await wallet.submitTx(propSigned);
  console.log(`PROPOSE submitted: ${propHash} (4 tADA to the payer's key, purpose hashed in-datum)`);
  await waitTx(propHash, scriptAddress);
  await waitWalletSees(propHash);

  // --- 4+5. RELEASE — refused at 1-of-3, paid at 2-of-3.
  st = await stateUtxoFrom(propHash);
  collateral = await ensureCollateral();
  const donations = (await utxosAt()).filter(
    (x) => !x.output.amount.some((a) => a.unit === stateUnit)
  );
  if (donations.length < 2) throw new Error("donation UTxOs not found");
  const stLovelace = Number(
    st.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? 0
  );
  const donLovelace = donations.reduce(
    (s, d) => s + Number(d.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? 0),
    0
  );
  // Remainder provably back to the pot: state-in + donations − payout.
  const contLovelace = stLovelace + donLovelace - 4_000_000;

  const buildRelease = async (withSigners: { hash: string }[]) => {
    const b = new MeshTxBuilder({ fetcher: provider, submitter: provider });
    // Explicit budgets: three script runs at Mesh's 7M-mem default
    // blow the network's 16.5M per-tx cap; the actual scripts are tiny.
    b.spendingPlutusScriptV3()
      .txIn(st.input.txHash, st.input.outputIndex, st.output.amount, scriptAddress)
      .txInInlineDatumPresent()
      .txInRedeemerValue(mConStr1([0, 1]), "Mesh", { mem: 5_000_000, steps: 2_000_000_000 })
      .txInScript(scriptCbor);
    for (const d of donations) {
      b.spendingPlutusScriptV3()
        .txIn(d.input.txHash, d.input.outputIndex, d.output.amount, scriptAddress)
        .txInInlineDatumPresent()
        .txInRedeemerValue(mConStr3([]), "Mesh", { mem: 3_000_000, steps: 1_200_000_000 })
        .txInScript(scriptCbor);
    }
    b.txOut(scriptAddress, [
      { unit: "lovelace", quantity: String(contLovelace) },
      { unit: stateUnit, quantity: "1" },
    ])
      .txOutInlineDatumValue(stateDatum(false, null))
      .txOut(payerAddr, [{ unit: "lovelace", quantity: "4000000" }])
      .txInCollateral(
        collateral!.input.txHash,
        collateral!.input.outputIndex,
        collateral!.output.amount,
        collateral!.output.address
      )
      .changeAddress(payerAddr)
      .selectUtxosFrom(await spendables(collateral!));
    for (const s of withSigners) b.requiredSignerHash(s.hash);
    return b.complete();
  };
  const coSign = async (txHex: string, ws: { w: InstanceType<typeof MeshWallet> }[]) => {
    let tx = await wallet.signTx(txHex, true);
    for (const s of ws) tx = await s.w.signTx(tx, true);
    return tx;
  };

  try {
    const under = await buildRelease([signers[0]]);
    await wallet.submitTx(await coSign(under, [signers[0]]));
    throw new Error("UNDER-THRESHOLD RELEASE ACCEPTED — do not ship this.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("do not ship")) throw e;
    console.log(`1-OF-3 RELEASE REFUSED (as it must be): ${msg.slice(0, 200)}`);
  }

  const at = await buildRelease([signers[0], signers[1]]);
  const releaseHash = await wallet.submitTx(await coSign(at, [signers[0], signers[1]]));
  console.log(`2-OF-3 RELEASE submitted: ${releaseHash}`);
  await waitTx(releaseHash, scriptAddress);
  console.log(
    `TREASURY ROUNDTRIP COMPLETE. init=${initHash} donate=${d1},${d2} propose=${propHash} release=${releaseHash}`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
