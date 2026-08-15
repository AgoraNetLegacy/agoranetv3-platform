// Track 2 Slice 6; the Tribunal freeze, live on preprod.
// The §4 hard question, answered per the owner's ruling (2026-07-18):
// the Tribunal's key is the freeze attestation. Proven both ways:
// a FULL-THRESHOLD release is REFUSED while frozen (the brake beats
// the engine), and after the Tribunal lifts, the same release
// proceeds. The freeze can only ever block; no path moves value.
//
// Usage: npx tsx scripts/chain/demo-freeze-roundtrip.ts
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
  if (!validator) throw new Error("mission_treasury missing; run aiken build.");
  const scriptCbor = applyCborEncoding(validator.compiledCode);
  const scriptAddress = serializePlutusScript({ code: scriptCbor, version: "V3" }, undefined, 0)
    .address;
  const policyId = deserializeAddress(scriptAddress).scriptHash;
  const stateUnit = policyId + stringToHex("STATE");

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
  const chamberHex = stringToHex(`agora-freeze-${Date.now()}`);

  console.log(`network: ${net}`);
  console.log(`script:  ${scriptAddress}`);
  console.log("chamber: 2-of-3 attestors; the Tribunal key holds the brake");

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
  const pendingTerms = mConStr0([
    payerHash,
    2_000_000,
    stringToHex("slice6-demo: the brake beats the engine"),
  ]);

  const waitTx = async (hash: string, at: string) => {
    for (let i = 0; i < 60; i++) {
      await sleep(5000);
      if ((await lockedAtScriptOnConfiguredTestnet(hash, at)) !== null) return;
    }
    throw new Error(`tx ${hash} never confirmed`);
  };
  // Wallet must SEE its own change before the next build, or stale
  // coin selection re-spends a consumed input.
  const waitWalletSees = async (txHash: string) => {
    for (let i = 0; i < 24; i++) {
      if ((await wallet.getUtxos()).some((u) => u.input.txHash === txHash)) return;
      await sleep(5000);
    }
    throw new Error(`wallet never saw change from ${txHash}`);
  };

  const ensureCollateral = async () => {
    const findPure = async () =>
      (await wallet.getUtxos()).find(
        (u) =>
          u.output.amount.length === 1 &&
          Number(u.output.amount[0]?.quantity ?? 0) >= 5_000_000
      );
    let c = await findPure();
    if (!c) {
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
  const spendables = async (c: { input: { txHash: string; outputIndex: number } }) =>
    (await wallet.getUtxos()).filter(
      (u) =>
        !(u.input.txHash === c.input.txHash && u.input.outputIndex === c.input.outputIndex)
    );

  const utxosAt = async () =>
    (await provider.fetchAddressUTxOs(scriptAddress)).filter((x) =>
      (x.output.plutusData ?? "").includes(chamberHex)
    );
  // The state thread is tracked by its EXPECTED TIP; the tx that last
  // moved it; never by "whatever the lagging address index shows".
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
  const coSign = async (txHex: string, ws: { w: InstanceType<typeof MeshWallet> }[]) => {
    let tx = await wallet.signTx(txHex, true);
    for (const s of ws) tx = await s.w.signTx(tx, true);
    return tx;
  };

  // --- 1. INIT + one donation + propose (compressed Slice 5 prelude).
  let collateral = await ensureCollateral();
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
  console.log(`INIT: ${initHash}`);
  await waitTx(initHash, scriptAddress);
  await waitWalletSees(initHash);

  const dTx = new Transaction({ initiator: wallet });
  dTx.sendLovelace(
    { address: scriptAddress, datum: { value: donationDatum, inline: true } },
    "3000000"
  );
  const dHash = await wallet.submitTx(await wallet.signTx(await dTx.build()));
  console.log(`DONATE: ${dHash}`);
  await waitTx(dHash, scriptAddress);
  await waitWalletSees(dHash);

  // A State-spend builder shared by propose/freeze/lift: continuing
  // output preserves value + NFT, datum supplied by the caller.
  const stateSpend = async (
    redeemer: { alternative: number; fields: unknown[] },
    newDatum: { alternative: number; fields: unknown[] },
    required: { hash: string }[],
    tipTxHash: string
  ) => {
    const st = await stateUtxoFrom(tipTxHash);
    collateral = await ensureCollateral();
    const b = new MeshTxBuilder({ fetcher: provider, submitter: provider });
    b.spendingPlutusScriptV3()
      .txIn(st.input.txHash, st.input.outputIndex, st.output.amount, scriptAddress)
      .txInInlineDatumPresent()
      .txInRedeemerValue(redeemer)
      .txInScript(scriptCbor)
      .txOut(scriptAddress, st.output.amount)
      .txOutInlineDatumValue(newDatum)
      .txInCollateral(
        collateral.input.txHash,
        collateral.input.outputIndex,
        collateral.output.amount,
        collateral.output.address
      )
      .changeAddress(payerAddr)
      .selectUtxosFrom(await spendables(collateral));
    for (const s of required) b.requiredSignerHash(s.hash);
    return b.complete();
  };

  const propUnsigned = await stateSpend(
    mConStr0([0]),
    stateDatum(false, pendingTerms),
    [signers[0]],
    initHash
  );
  const propHash = await wallet.submitTx(await coSign(propUnsigned, [signers[0]]));
  console.log(`PROPOSE: ${propHash} (2 tADA pending)`);
  await waitTx(propHash, scriptAddress);
  await waitWalletSees(propHash);

  // --- 2. FREEZE: the Tribunal key, and only that key, flips the brake.
  const freezeUnsigned = await stateSpend(
    mConStr2([0]),
    stateDatum(true, pendingTerms),
    [tribunal],
    propHash
  );
  const freezeHash = await wallet.submitTx(await coSign(freezeUnsigned, [tribunal]));
  console.log(`FREEZE by tribunal: ${freezeHash}`);
  await waitTx(freezeHash, scriptAddress);
  await waitWalletSees(freezeHash);

  // --- 3. THE PROOF: a FULL-THRESHOLD release against a frozen state.
  const buildRelease = async (tipTxHash: string) => {
    const st = await stateUtxoFrom(tipTxHash);
    collateral = await ensureCollateral();
    const donations = (await utxosAt()).filter(
      (x) => !x.output.amount.some((a) => a.unit === stateUnit)
    );
    const stLove = Number(st.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? 0);
    const donLove = donations.reduce(
      (s, d) => s + Number(d.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? 0),
      0
    );
    const b = new MeshTxBuilder({ fetcher: provider, submitter: provider });
    // Explicit budgets; Mesh's per-redeemer defaults overflow the
    // network's per-tx memory cap once multiple scripts run.
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
      { unit: "lovelace", quantity: String(stLove + donLove - 2_000_000) },
      { unit: stateUnit, quantity: "1" },
    ])
      .txOutInlineDatumValue(stateDatum(false, null))
      .txOut(payerAddr, [{ unit: "lovelace", quantity: "2000000" }])
      .txInCollateral(
        collateral.input.txHash,
        collateral.input.outputIndex,
        collateral.output.amount,
        collateral.output.address
      )
      .changeAddress(payerAddr)
      .selectUtxosFrom(await spendables(collateral))
      .requiredSignerHash(signers[0].hash)
      .requiredSignerHash(signers[1].hash);
    return b.complete();
  };

  try {
    const frozenAttempt = await buildRelease(freezeHash);
    await wallet.submitTx(await coSign(frozenAttempt, [signers[0], signers[1]]));
    throw new Error("RELEASE WHILE FROZEN WAS ACCEPTED; do not ship this.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("do not ship")) throw e;
    console.log(
      `FULL-THRESHOLD RELEASE REFUSED WHILE FROZEN (the brake beats the engine): ${msg.slice(0, 180)}`
    );
  }

  // --- 4. LIFT: same key, brake off; pending survives intact.
  const liftUnsigned = await stateSpend(
    mConStr2([0]),
    stateDatum(false, pendingTerms),
    [tribunal],
    freezeHash
  );
  const liftHash = await wallet.submitTx(await coSign(liftUnsigned, [tribunal]));
  console.log(`LIFT by tribunal: ${liftHash}`);
  await waitTx(liftHash, scriptAddress);
  await waitWalletSees(liftHash);

  // --- 5. The SAME release now proceeds.
  const releaseUnsigned = await buildRelease(liftHash);
  const releaseHash = await wallet.submitTx(
    await coSign(releaseUnsigned, [signers[0], signers[1]])
  );
  console.log(`RELEASE after lift: ${releaseHash}`);
  await waitTx(releaseHash, scriptAddress);
  console.log(
    `FREEZE ROUNDTRIP COMPLETE. init=${initHash} propose=${propHash} freeze=${freezeHash} lift=${liftHash} release=${releaseHash}`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
