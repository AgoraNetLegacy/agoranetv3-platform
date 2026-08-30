import Link from "next/link";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { getRail } from "@/lib/rails";
import {
  updateDisplayName,
  setSwitchAnimation,
  updateFeedWellbeing,
  updateEconomyMode,
  submitCreditClaim,
  submitWalletLink,
  submitSelfCustodyProof,
  submitScriptDonation,
} from "@/app/actions";
import { getRail as getRailDirect } from "@/lib/rails";
import {
  cardanoNetwork,
  walletLinkFor,
  donationsFor,
} from "@/lib/chain";
import {
  walletActivityView,
  walletModeActivationReady,
  creditClaimsTestnetEnabled,
} from "@/lib/progressiveEconomy";
import { synchronizedWalletBalanceView } from "@/lib/synchronizedWalletBalance";
import { donationScript, demoBeneficiaryHash } from "@/lib/chainDonation";
import { LaceConnect } from "@/components/LaceConnect";
import { SelfCustodySign } from "@/components/SelfCustodySign";
import { DonateToScript } from "@/components/DonateToScript";

export const dynamic = "force-dynamic";

// Settings are scoped to the active identity (Phase 8.5, PRESENTATION_SPEC
// §5.1). No surface shows both identities' settings together; a shared
// settings screen would itself be a linkage surface. Switch identities to
// settings; nothing here echoes across.
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const face = await activeFace();
  if (!face) redirect("/login");
  const [wellbeingRow, nudgeDefault] = await Promise.all([
    db.feedSettings.findUnique({ where: { profileId: face.id } }),
    getRailDirect(db, "feed.nudge.defaultAfterMin"),
  ]);
  const [cooldownDays, walletLink, donations, demoLovelace, demoLockMinutes, creditBalances, creditClaims, claimMaximum, walletActivity] =
    await Promise.all([
      getRail(db, "identity.displayNameCooldownDays"),
      walletLinkFor(db, face.id),
      donationsFor(db, face.id),
      getRail(db, "onchain.demoDonationLovelace"),
      getRail(db, "onchain.demoLockMinutes"),
      db.balance.findMany({
        where: { profileId: face.id, currency: { in: ["PC", "G"] } },
      }),
      db.creditClaim.findMany({
        where: { profileId: face.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      getRail(db, "onchain.claimMaxCredits"),
      walletActivityView(db, face.id),
    ]);
  const creditAmount = new Map(creditBalances.map((balance) => [balance.currency, balance.amount]));
  const network = cardanoNetwork();
  let demoAssets: Awaited<ReturnType<typeof synchronizedWalletBalanceView>>["balances"] | null = null;
  let demoAssetError: string | null = null;
  if (walletLink) {
    try {
      const synchronized = await synchronizedWalletBalanceView(face.id);
      demoAssets = synchronized.balances;
      demoAssetError = synchronized.error;
    } catch {
      // A missing chain configuration or temporary explorer outage must not
      // undo or hide a successful wallet link.
      demoAssetError = "On-chain demo balances are temporarily unavailable.";
    }
  }
  // Derived only when a wallet is linked; the donation section only
  // renders then, and an unconfigured beneficiary must not take the
  // whole settings page down with it.
  let donationAddress = "";
  let beneficiaryHash = "";
  let donationError: string | null = null;
  if (walletLink) {
    try {
      const [script, hash] = await Promise.all([donationScript(), demoBeneficiaryHash()]);
      donationAddress = script.address;
      beneficiaryHash = hash;
    } catch {
      donationError = "The donation testnet tools are temporarily unavailable.";
    }
  }

  return (
    <div className="ceremony">
      <h2>
        Settings <span className="lore">; for {face.displayName} @{face.handle} only</span>
      </h2>
      <p className="lore">
        Settings belong to the active identity. Your other identity has its
        own settings page, reachable only by switching. This separation keeps
        the two identities independent.
      </p>
      {m && <div className="notice">{m}</div>}

      <h3>Display name</h3>
      <p className="lore">
        Your <strong>@handle is forever</strong>; the attribution key on
        every record you sign. Your display name is yours to change (at
        most once every {cooldownDays} days): live surfaces update;
        anything in the permanent record keeps the name it was written
        under.
      </p>
      <form action={updateDisplayName}>
        <label>
          Display name
          <input
            type="text"
            name="displayName"
            defaultValue={face.displayName}
            required
            maxLength={60}
          />
        </label>
        <button type="submit">Change display name</button>
      </form>

      <h3>Identity-switch animation</h3>
      <p className="lore">
        How the room turns when you change identities. The card flip is the
        default; choose less motion if you prefer; by choice, never by
        detection.
      </p>
      <form action={setSwitchAnimation}>
        {(
          [
            ["flip", "The card flip; the page turns over like a playing card"],
            ["crossfade", "Crossfade; a quiet dissolve"],
            ["instant", "Instant; no animation at all"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} style={{ display: "block", margin: "0.3rem 0" }}>
            <input
              type="radio"
              name="method"
              value={value}
              defaultChecked={face.switchAnimation === value}
            />{" "}
            {label}
          </label>
        ))}
        <button type="submit">Save animation choice</button>
      </form>

      <h3>The Beacon; pacing</h3>
      <p className="lore">
        The feed&rsquo;s calm-pacing controls, yours to tune (or turn
        off). The timing runs entirely in your own browser; the
        platform measures nothing; it only remembers the numbers you
        choose here, per identity.
      </p>
      <form action={updateFeedWellbeing}>
        <label style={{ display: "block", margin: "0.3rem 0" }}>
          Go-act nudge after{" "}
          <select name="nudgeAfterMin" defaultValue={wellbeingRow ? (wellbeingRow.nudgeAfterMin === null ? "off" : String(wellbeingRow.nudgeAfterMin)) : String(nudgeDefault)}>
            <option value="off">off; never nudge</option>
            {[10, 20, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} minutes of reading
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "block", margin: "0.3rem 0" }}>
          Daily feed budget (minutes, blank for none){" "}
          <input
            type="number"
            name="dailyCapMin"
            min={10}
            max={600}
            defaultValue={wellbeingRow?.dailyCapMin ?? ""}
            style={{ width: "6rem" }}
          />
        </label>
        <button type="submit">Save pacing</button>
      </form>

      <h3>Notifications</h3>
      <p className="lore">
        The quietest defaults are on for everyone: two tiers (time-sensitive
        and the quiet inbox), aggregated per space, nothing manufactured to
        pull you back. There is nothing to configure yet; push delivery
        arrives as a fast-follow, and its preferences will live here, per
        identity, off by default.
      </p>

      <h3>The testnet rail; connect a wallet</h3>
      <p className="lore">
        <strong>Test network only, by design.</strong> Connecting shares
        one {network} address with the platform; no keys, no custody,
        nothing of real value anywhere on this rail. Real rails wait
        behind their own gate. Your True Self and Alias connect separately.
        If you connect both, use a different Cardano account for each.
      </p>
      {walletLink ? (
        <p className="lore">
          Linked to this identity:
          <br />
          <code style={{ wordBreak: "break-all" }}>{walletLink.cardanoAddress}</code>{" "}
          ({walletLink.network}, since {walletLink.connectedAt.toLocaleDateString()}).
          Switched wallets? The &ldquo;Connect Lace&rdquo; button below
          re-links this identity to whatever wallet is in your browser now.
        </p>
      ) : (
        <p className="lore">No wallet linked to this identity yet.</p>
      )}
      <LaceConnect
        network={network}
        identity={face.face === "TRUE_SELF" ? "True Self" : "Alias"}
        onLink={submitWalletLink}
      />

      <h4>Choose how this profile participates</h4>
      <p className="lore">
        Platform custody needs no wallet. Wallet custody is the advanced
        testnet path for people ready to approve token transactions in Lace.
        PC and G remain the same two currencies in either location. This choice
        belongs only to {face.displayName} @{face.handle}; your other profile
        keeps its own choice.
      </p>
      <form action={updateEconomyMode}>
        <label style={{ display: "block", margin: "0.3rem 0" }}>
          <input
            type="radio"
            name="economyMode"
            value="credits"
            defaultChecked={face.economyMode === "credits"}
          />{" "}
          Platform custody; AgoraNet holds this profile&apos;s PC and G
        </label>
        <label style={{ display: "block", margin: "0.3rem 0" }}>
          <input
            type="radio"
            name="economyMode"
            value="wallet"
            defaultChecked={face.economyMode === "wallet"}
            disabled={!walletLink || !walletModeActivationReady()}
          />{" "}
          Wallet custody; approve test dPOLL and dGRA actions in Lace on Cardano {network}
        </label>
        {!walletModeActivationReady() && (
          <p className="lore">
            Wallet custody is installed but remains safely off until a normal
            AgoraNet fee and reward work end to end with fake wallet assets.
          </p>
        )}
        {!walletLink && <p className="lore">Connect a testnet wallet before selecting wallet custody.</p>}
        <button type="submit">Save custody preference</button>
      </form>

      {walletLink && demoAssets && (
        <div className="notice">
          <strong>On-chain demo balances</strong>
          <br />
          PollCoin Demo: {demoAssets.PC}
          <br />
          Gratium Demo: {demoAssets.G}
          <br />
          <span className="lore">
            Read from Cardano {network}; observed {demoAssets.observedAt?.toLocaleString() ?? "not yet"}.
            These are wallet-held PC and G. Any platform-held PC/G remains under platform custody until you explicitly move it.
          </span>
        </div>
      )}
      {walletLink && demoAssetError && <p className="notice">{demoAssetError}</p>}

      {walletActivity.length > 0 && (
        <>
          <h4>Your recent testnet wallet activity</h4>
          <p className="lore">
            This list belongs only to the current AgoraNet identity. Pending does not mean
            failed, and it is never a reason to pay twice.
          </p>
          <ul className="lore">
            {walletActivity.map((activity) => (
              <li key={activity.id}>
                <strong>{activity.kindLabel}</strong>: {activity.amount} {activity.currency}
                {" — "}{activity.statusLabel}.{" "}
                {activity.resultHref ? (
                  <Link href={activity.resultHref}>
                    View published result
                  </Link>
                ) : activity.txHash ? (
                  <a
                    href={`https://${network}.cardanoscan.io/transaction/${activity.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View public transaction
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {walletLink && creditClaimsTestnetEnabled() && (
        <>
          <h4>Move platform-held PC/G to your testnet wallet</h4>
          <p className="lore">
            This optional test moves eligible platform-held PC or G into fake
            dPOLL or dGRA at your linked {network} wallet. The tokens are
            reserved now and deducted from platform custody only when delivery is confirmed. These
            test assets have no real value.
          </p>
          <form action={submitCreditClaim}>
            <input type="hidden" name="idempotencyKey" value={`settings:${face.id}:${randomUUID()}`} />
            <label>
              Token{" "}
              <select name="currency" defaultValue="PC">
                <option value="PC">PC ({(creditAmount.get("PC") ?? 0).toFixed(2)} platform-held)</option>
                <option value="G">G ({(creditAmount.get("G") ?? 0).toFixed(2)} platform-held)</option>
              </select>
            </label>{" "}
            <label>
              Amount{" "}
              <input type="number" name="creditAmount" min={1} max={claimMaximum} step={1} defaultValue={1} required />
            </label>{" "}
            <button type="submit">Move tokens to wallet</button>
          </form>
          {creditClaims.length > 0 && (
            <ul className="lore">
              {creditClaims.map((claim) => (
                <li key={claim.id}>
                  {claim.creditAmount} platform-held {claim.currency} → {claim.assetAmount}{" "}
                  {claim.currency === "PC" ? "dPOLL" : "dGRA"}: {claim.status}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {walletLink && (
        <>
          <h4>The self-custody proof</h4>
          <p className="lore">
            One small transaction ({network}), built in your browser and
            signed by <strong>your</strong> wallet; a ~2 tADA send from
            your address back to your address, so only the network fee is
            spent. The platform holds no keys and submits nothing; it
            records the transaction only after verifying it on {network}.
            This is the pattern every real flow will follow: your money
            moves only when you sign.
          </p>
          {walletLink.proofTxHash ? (
            <p className="lore">
              Proven {walletLink.proofAt?.toLocaleDateString()}:{" "}
              <a
                href={`https://${walletLink.network}.cardanoscan.io/transaction/${walletLink.proofTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                <code>{walletLink.proofTxHash.slice(0, 16)}…</code>
              </a>{" "}
; publicly verifiable; anyone can look it up. Sign again
              anytime to refresh it.
            </p>
          ) : (
            <p className="lore">No proof signed by this identity yet.</p>
          )}
          <SelfCustodySign network={network} onProof={submitSelfCustodyProof} />

          <h4>The non-custodial donation</h4>
          {donationError ? (
            <p className="notice">{donationError}</p>
          ) : (
            <>
          <p className="lore">
            The first real value movement on this rail: {(demoLovelace / 1_000_000).toLocaleString()} tADA
            from <strong>your</strong> wallet to the donation-lock{" "}
            <strong>script</strong>; {" "}
            <code>{donationAddress.slice(0, 24)}…</code>; an address
            governed by validator math, not by anyone&rsquo;s key. The
            platform cannot spend, redirect, or return what sits there;
            it never touches the funds at all. Honestly, the demo&rsquo;s
            shape: the lock opens after {demoLockMinutes} minutes, and
            the collector is the dev demo wallet; the real
            mission-treasury release (M-of-N attestation, no single
            collector) is the next track of this build. Testnet tADA
            only; nothing of real value.
          </p>
          {donations.length > 0 ? (
            <ul className="lore">
              {donations.map((d) => (
                <li key={d.id}>
                  {(d.lovelace / 1_000_000).toLocaleString()} tADA locked{" "}
                  {d.createdAt.toLocaleDateString()}:{" "}
                  <a
                    href={`https://${d.network}.cardanoscan.io/transaction/${d.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <code>{d.txHash.slice(0, 16)}…</code>
                  </a>{" "}
; publicly verifiable; the funds sit at the script,
                  not with us.
                </li>
              ))}
            </ul>
          ) : (
            <p className="lore">No donation from this identity yet.</p>
          )}
          <DonateToScript
            network={network}
            scriptAddress={donationAddress}
            beneficiaryHash={beneficiaryHash}
            lovelace={demoLovelace}
            lockMinutes={demoLockMinutes}
            onDonate={submitScriptDonation}
          />
            </>
          )}
        </>
      )}

      <h3>This identity&rsquo;s other controls</h3>
      <ul>
        <li>
          <Link href="/profile">The profile window</Link>; your about-me,
          standing, and score log
        </li>
        <li>
          <Link href="/feed/sources">Feed sources</Link>; choose what
          feeds this identity&rsquo;s feed
        </li>
        <li>
          <Link href="/search/history">Search history</Link>; private to
          this identity,
          deletable, never used to rank
        </li>
      </ul>
    </div>
  );
}
