// Phase 8.6 slice 3; deploy + exercise the nullifier contract on Midnight
// testnet through the local dev proof server (TESTNET_RAILS_SPEC §6.4 step 3).
//
// What this proves, in gate vocabulary (lib/gate.ts):
//   1. CLEARED; a subject spends a nullifier in a scope; the ledger Set
//      records the opaque hash and nothing else.
//   2. DUPLICATE; the same subject in the same scope is refused by the
//      contract's member-check, with nobody learning who tried.
//   3. The collision guard; the same scope string through the per-profile
//      and per-human doors yields DIFFERENT nullifiers (distinct kind tags),
//      exactly as lib/nullifier.ts folds ScopeKind into its HMAC.
//   4. The derivation is public math; pureCircuits.nullifierFor re-derives
//      the on-chain value locally from (kind tag, scope, secret), the §1.5
//      recovery property carried onto the chain rail.
//
// Dev-grade by ratified scope: proofs run 20–60s each through the local
// proof server; consumer in-browser proving is explicitly NOT this phase's
// promise (scout appendix, honesty edit 3).
//
// Wallet/provider wiring adapted from midnightntwrk/example-counter
// (Apache-2.0, Midnight Foundation); the official reference for the
// wallet-sdk facade + midnight-js 4.1.1 pairing pinned in package.json.
//
// Secrets (MIDNIGHT_DEPLOY_SEED, MIDNIGHT_SUBJECT_COMMITMENT) live ONLY in
// the platform repo's gitignored .env, same law as every other chain secret.
//
//   cd infra/midnight && npm run exercise
//
// First run prints the wallet's unshielded address and waits; that is the
// owner's ONE faucet moment (tNIGHT to that address; dust registration then
// happens programmatically). Re-runs reuse MIDNIGHT_NULLIFIER_CONTRACT from
// .env and skip deployment.

import * as ledgerVm from "@midnight-ntwrk/ledger-v8";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js/contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { setNetworkId, getNetworkId } from "@midnight-ntwrk/midnight-js/network-id";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { HDWallet, Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import * as Rx from "rxjs";
import { WebSocket } from "ws";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

import { Contract, ledger, pureCircuits } from "./contract/build/contract/index.js";

// GraphQL subscriptions (wallet sync) need a WebSocket global in Node.
// @ts-expect-error; assigned for apollo's benefit
globalThis.WebSocket = WebSocket;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(HERE, "contract", "build");

// ---------------------------------------------------------------------------
// .env; the platform repo's single gitignored secrets home (§6.1).
// ---------------------------------------------------------------------------

function loadEnv(): Record<string, string> {
  const envPath = path.join(HERE, "..", "..", ".env");
  const out: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

const env = loadEnv();

// The one hard rule, mirrored from lib/chain.ts (§6.6): testnet only, by
// construction; a mainnet value anywhere fails loudly.
const MIDNIGHT_TESTNETS = new Set(["preview", "preprod", "undeployed"]);

function midnightNetwork(): "preview" | "preprod" | "undeployed" {
  const net = env.MIDNIGHT_NETWORK ?? "preview";
  if (!MIDNIGHT_TESTNETS.has(net)) {
    throw new Error(
      `MIDNIGHT_NETWORK must be a Midnight TESTNET ("preview", "preprod", or "undeployed"); got "${net}". ` +
        "Mainnet is out of scope for Phase 8.6 by ratified design (§6.6)."
    );
  }
  return net as "preview" | "preprod" | "undeployed";
}

const NETWORKS = {
  preview: {
    indexer: "https://indexer.preview.midnight.network/api/v3/graphql",
    indexerWS: "wss://indexer.preview.midnight.network/api/v3/graphql/ws",
    node: "https://rpc.preview.midnight.network",
    faucet: "https://midnight-tmnight-preview.nethermind.dev/",
  },
  preprod: {
    indexer: "https://indexer.preprod.midnight.network/api/v3/graphql",
    indexerWS: "wss://indexer.preprod.midnight.network/api/v3/graphql/ws",
    node: "https://rpc.preprod.midnight.network",
    faucet: "https://faucet.preprod.midnight.network/",
  },
  undeployed: {
    indexer: "http://127.0.0.1:8088/api/v3/graphql",
    indexerWS: "ws://127.0.0.1:8088/api/v3/graphql/ws",
    node: "http://127.0.0.1:9944",
    faucet: "(local standalone; fund via genesis wallet)",
  },
} as const;

const network = midnightNetwork();
setNetworkId(network);
const config = {
  ...NETWORKS[network],
  proofServer: env.MIDNIGHT_PROOF_SERVER_URL ?? "http://localhost:6300",
};

// ---------------------------------------------------------------------------
// Canonicalization; scope strings and kind tags, exactly as the contract
// folds them (and as lib/nullifier.ts folds their Phase A twins).
// ---------------------------------------------------------------------------

/** Compact's pad(32, s): UTF-8 bytes of s, zero-padded to 32 on the right. */
function pad32(s: string): Uint8Array {
  const out = new Uint8Array(32);
  out.set(Buffer.from(s, "utf8"));
  return out;
}

/** Scope strings arrive on-chain as their SHA-256 digest (fixed-width). */
function scopeBytes(scope: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(scope, "utf8").digest());
}

const KIND_PER_PROFILE = pad32("agoranet:kind:per-profile");
const KIND_PER_HUMAN = pad32("agoranet:kind:per-human");

// ---------------------------------------------------------------------------
// Wallet (adapted from example-counter's api.ts; Apache-2.0).
// ---------------------------------------------------------------------------

interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledgerVm.ZswapSecretKeys;
  dustSecretKey: ledgerVm.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

function deriveKeysFromSeed(seed: string) {
  const hd = HDWallet.fromSeed(Buffer.from(seed, "hex"));
  if (hd.type !== "seedOk") throw new Error("Failed to initialize HDWallet from seed");
  const derived = hd.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derived.type !== "keysDerived") throw new Error("Failed to derive keys");
  hd.hdWallet.clear();
  return derived.keys;
}

const step = (msg: string) => console.log(`\n▸ ${msg}`);
const tick = (msg: string) => console.log(`  ✓ ${msg}`);

async function buildWallet(seed: string): Promise<WalletContext> {
  step("Building wallet");
  const keys = deriveKeysFromSeed(seed);
  const shieldedSecretKeys = ledgerVm.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledgerVm.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

  const shared = {
    networkId: getNetworkId(),
    indexerClientConnection: { indexerHttpUrl: config.indexer, indexerWsUrl: config.indexerWS },
  };
  const walletConfig = {
    ...shared,
    provingServerUrl: new URL(config.proofServer),
    relayURL: new URL(config.node.replace(/^http/, "ws")),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  };
  const wallet = await WalletFacade.init({
    configuration: walletConfig,
    shielded: (cfg: any) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg: any) =>
      UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (cfg: any) =>
      DustWallet(cfg).startWithSecretKey(dustSecretKey, ledgerVm.LedgerParameters.initialParameters().dust),
  });
  await wallet.start(shieldedSecretKeys, dustSecretKey);
  tick(`wallet started (network: ${getNetworkId()})`);
  console.log(`\n  Unshielded address (the faucet target; tNIGHT goes here):`);
  console.log(`  ${unshieldedKeystore.getBech32Address()}`);
  console.log(`  Faucet: ${config.faucet}`);

  step("Syncing with network");
  // Progress heartbeat; a fresh wallet's first sync can run minutes; the
  // difference between "slow" and "stuck" must be visible in the log.
  const heartbeat = wallet
    .state()
    .pipe(Rx.throttleTime(15_000))
    .subscribe((s: any) => {
      const big = (_: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);
      const p = (x: any) => JSON.stringify(x ?? "?", big);
      // The facade reports synced only when ALL THREE sub-wallets are
      // strictly complete; dust included (it syncs via the node RPC's
      // websocket, a separate connection from the indexer).
      console.log(
        `  … sync heartbeat: isSynced=${s.isSynced}` +
          ` shielded=${p(s.shielded?.state?.progress ?? s.shielded?.syncProgress)}` +
          ` unshielded=${p(s.unshielded?.progress ?? s.unshielded?.syncProgress)}` +
          ` dust=${p(s.dust?.state?.progress ?? s.dust?.syncProgress)}`
      );
    });
  const synced: any = await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s: any) => s.isSynced)
    )
  );
  heartbeat.unsubscribe();
  const balance = synced.unshielded.balances[unshieldedToken().raw] ?? 0n;
  tick(`synced; ${balance.toLocaleString()} tNIGHT`);

  if (balance === 0n) {
    step("Waiting for tNIGHT (the faucet moment; paste the address above into the faucet)");
    const funded: bigint = await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(10_000),
        Rx.filter((s: any) => s.isSynced),
        Rx.map((s: any) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
        Rx.filter((b: bigint) => b > 0n)
      )
    );
    tick(`funded; ${funded.toLocaleString()} tNIGHT`);
  }

  await registerForDustGeneration(wallet, unshieldedKeystore);
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

// tNIGHT does not pay fees directly: registered NIGHT UTXOs generate DUST
// (the non-transferable fee token) over time. This designation is the
// programmatic half of the faucet moment; no wallet clicking needed.
async function registerForDustGeneration(
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore
): Promise<void> {
  const state: any = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
  if (state.dust.availableCoins.length > 0) {
    tick(`dust already available (${state.dust.balance(new Date()).toLocaleString()} DUST)`);
    return;
  }
  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true
  );
  if (nightUtxos.length > 0) {
    step(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`);
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      unshieldedKeystore.getPublicKey(),
      (payload: Uint8Array) => unshieldedKeystore.signData(payload)
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    await wallet.submitTransaction(finalized);
    tick("registration submitted");
  }
  step("Waiting for dust to generate (accrues from registered tNIGHT)");
  await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s: any) => s.isSynced),
      Rx.filter((s: any) => s.dust.balance(new Date()) > 0n)
    )
  );
  tick("dust available; fees covered");
}

// Sign unshielded offers with the correct proof marker; works around the
// wallet SDK's signRecipe hardcoding 'pre-proof' (example-counter's fix).
function signTransactionIntents(
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => ledgerVm.Signature,
  proofMarker: "proof" | "pre-proof"
): void {
  if (!tx.intents || tx.intents.size === 0) return;
  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;
    const cloned = ledgerVm.Intent.deserialize<ledgerVm.SignatureEnabled, ledgerVm.Proofish, ledgerVm.PreBinding>(
      "signature",
      proofMarker,
      "pre-binding",
      intent.serialize()
    );
    const signature = signFn(cloned.signatureData(segment));
    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledgerVm.UtxoSpend, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledgerVm.UtxoSpend, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }
    tx.intents.set(segment, cloned);
  }
}

async function configureProviders(ctx: WalletContext) {
  const state: any = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
  const walletAndMidnightProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) }
      );
      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, "proof");
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, "pre-proof");
      }
      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => ctx.wallet.submitTransaction(tx) as any,
  };
  const zkConfigProvider = new NodeZkConfigProvider<"spendPerProfile" | "spendPerHuman">(BUILD_DIR);
  const accountId = walletAndMidnightProvider.getCoinPublicKey();
  const storagePassword = `${Buffer.from(accountId, "hex").toString("base64")}!`;
  return {
    privateStateProvider: levelPrivateStateProvider<"nullifierPrivateState">({
      privateStateStoreName: "agoranet-nullifier-private-state",
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
}

// ---------------------------------------------------------------------------
// The contract binding; subjectSecret is the WITNESS: it rides the proof,
// never the chain. Private state holds the hex commitment (slice 2's stable
// subject commitment, §1.5) and the witness hands its bytes to the circuit.
// ---------------------------------------------------------------------------

type PrivateState = { subjectSecretHex: string };

const nullifierCompiledContract = CompiledContract.make("nullifier", Contract).pipe(
  CompiledContract.withWitnesses({
    subjectSecret: (context: any): [PrivateState, Uint8Array] => [
      context.privateState,
      new Uint8Array(Buffer.from(context.privateState.subjectSecretHex, "hex")),
    ],
  }),
  CompiledContract.withCompiledFileAssets(BUILD_DIR)
);

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const result = await fn();
  tick(`${label} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return result;
}

async function main() {
  console.log("AgoraNet nullifier contract; Midnight testnet exercise (8.6 slice 3)");
  console.log(`network: ${network} · proof server: ${config.proofServer} (dev-grade; 20–60s per proof is normal)`);

  const seed = env.MIDNIGHT_DEPLOY_SEED;
  if (!seed || seed.length !== 64) {
    throw new Error(
      "MIDNIGHT_DEPLOY_SEED (64 hex chars) is required in the platform .env. " +
        "Generate one:  openssl rand -hex 32"
    );
  }
  const commitment = env.MIDNIGHT_SUBJECT_COMMITMENT;
  if (!commitment || commitment.length !== 64) {
    throw new Error(
      "MIDNIGHT_SUBJECT_COMMITMENT (64 hex chars) is required in the platform .env; " +
        "the demo's stable subject commitment (§1.5). Generate one:  openssl rand -hex 32"
    );
  }

  const ctx = await buildWallet(seed);
  const providers = await configureProviders(ctx);
  const initialPrivateState: PrivateState = { subjectSecretHex: commitment };

  // Deploy once; re-runs join the address recorded in .env.
  let contract: any;
  const existing = env.MIDNIGHT_NULLIFIER_CONTRACT;
  if (existing) {
    step(`Joining deployed contract ${existing.slice(0, 20)}…`);
    contract = await timed("joined", () =>
      findDeployedContract(providers as any, {
        contractAddress: existing,
        compiledContract: nullifierCompiledContract,
        privateStateId: "nullifierPrivateState",
        initialPrivateState,
      })
    );
  } else {
    step("Deploying the nullifier contract (proof + submit; patience)");
    contract = await timed("deployed", () =>
      deployContract(providers as any, {
        compiledContract: nullifierCompiledContract,
        privateStateId: "nullifierPrivateState",
        initialPrivateState,
      })
    );
    console.log(`\n  CONTRACT ADDRESS (add to platform .env):`);
    console.log(`  MIDNIGHT_NULLIFIER_CONTRACT=${contract.deployTxData.public.contractAddress}`);
  }
  const contractAddress = contract.deployTxData.public.contractAddress;

  // A fresh per-run scope plays the role of one poll/action; the secret; the
  // subject; stays fixed, exactly like one soul acting in one scope.
  const runScope = `demo-poll:${Date.now()}`;
  const runScopeB = scopeBytes(runScope);
  const secret = new Uint8Array(Buffer.from(commitment, "hex"));

  // 1. CLEARED; first act in the scope.
  step(`spendPerProfile("${runScope}"); expecting CLEARED`);
  const tx1 = await timed("CLEARED; nullifier spent on-chain", () => contract.callTx.spendPerProfile(runScopeB));
  console.log(`    tx ${tx1.public.txId} · block ${tx1.public.blockHeight}`);

  // 2. DUPLICATE; the same subject, the same scope, refused by math.
  step(`spendPerProfile("${runScope}") again; expecting DUPLICATE refusal`);
  let duplicateRefused = false;
  try {
    await contract.callTx.spendPerProfile(runScopeB);
  } catch (e: any) {
    duplicateRefused = String(e?.message ?? e).includes("DUPLICATE");
    if (!duplicateRefused) throw e;
  }
  if (!duplicateRefused) throw new Error("second spend was NOT refused; one-per-scope failed!");
  tick("DUPLICATE; refused by the contract's member-check, no identity revealed");

  // 3. The collision guard; same scope string, per-human door: DIFFERENT
  // kind tag, different nullifier, so it clears.
  step(`spendPerHuman("${runScope}"); same scope, other kind: expecting CLEARED`);
  const tx2 = await timed("CLEARED; kinds can never collide", () => contract.callTx.spendPerHuman(runScopeB));
  console.log(`    tx ${tx2.public.txId} · block ${tx2.public.blockHeight}`);

  // 4. Public math; re-derive both nullifiers locally and find them (and
  // only them, for this run) in the public ledger Set.
  step("Verifying the ledger Set against local re-derivation (pureCircuits)");
  const expectedProfile = pureCircuits.nullifierFor(KIND_PER_PROFILE, runScopeB, secret);
  const expectedHuman = pureCircuits.nullifierFor(KIND_PER_HUMAN, runScopeB, secret);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!contractState) throw new Error("contract state not found on indexer");
  const spent = ledger(contractState.data).spent;
  if (!spent.member(expectedProfile)) throw new Error("per-profile nullifier missing from ledger Set!");
  if (!spent.member(expectedHuman)) throw new Error("per-human nullifier missing from ledger Set!");
  if (Buffer.from(expectedProfile).equals(Buffer.from(expectedHuman))) {
    throw new Error("kind tags collided?!");
  }
  tick(`both nullifiers re-derived locally and found in the public Set (size now ${spent.size()})`);
  console.log(`    per-profile: ${Buffer.from(expectedProfile).toString("hex").slice(0, 24)}…`);
  console.log(`    per-human:   ${Buffer.from(expectedHuman).toString("hex").slice(0, 24)}…`);

  console.log(`\nEXERCISE_OK; contract ${contractAddress}`);
  console.log("The gate's one-per-scope law now holds on a public testnet by math, not policy.");
  process.exit(0);
}

main().catch((e) => {
  console.error("\nEXERCISE_FAIL:", e?.message ?? e);
  process.exit(1);
});
