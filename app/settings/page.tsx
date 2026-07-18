import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { getRail } from "@/lib/rails";
import {
  updateDisplayName,
  setSwitchAnimation,
  submitWalletLink,
  submitSelfCustodyProof,
} from "@/app/actions";
import { cardanoNetwork, walletLinkFor } from "@/lib/chain";
import { LaceConnect } from "@/components/LaceConnect";
import { SelfCustodySign } from "@/components/SelfCustodySign";

export const dynamic = "force-dynamic";

// Settings, per face (Phase 8.5, PRESENTATION_SPEC §5.1). THE RULE:
// this page renders for the ACTIVE face only — no surface ever shows
// two faces' settings together; a shared settings screen would itself
// be a linkage surface. Switch faces to change the other face's
// settings; nothing here echoes across.
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const face = await activeFace();
  if (!face) redirect("/login");
  const [cooldownDays, walletLink] = await Promise.all([
    getRail(db, "identity.displayNameCooldownDays"),
    walletLinkFor(db, face.id),
  ]);
  const network = cardanoNetwork();

  return (
    <div className="ceremony">
      <h2>
        Settings <span className="lore">— for {face.displayName} @{face.handle} only</span>
      </h2>
      <p className="lore">
        Settings are per-face. Your other face — if you have one — has its
        own settings page, reachable only by switching. That separation is
        the design: a shared screen would itself link your faces.
      </p>
      {m && <div className="notice">{m}</div>}

      <h3>Display name</h3>
      <p className="lore">
        Your <strong>@handle is forever</strong> — the attribution key on
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

      <h3>Face-switch animation</h3>
      <p className="lore">
        How the room turns when you change faces. The card flip is the
        default; choose less motion if you prefer — by choice, never by
        detection.
      </p>
      <form action={setSwitchAnimation}>
        {(
          [
            ["flip", "The card flip — the page turns over like a playing card"],
            ["crossfade", "Crossfade — a quiet dissolve"],
            ["instant", "Instant — no animation at all"],
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

      <h3>Notifications</h3>
      <p className="lore">
        The quietest defaults are on for everyone: two tiers (time-sensitive
        and the quiet inbox), aggregated per space, nothing manufactured to
        pull you back. There is nothing to configure yet — push delivery
        arrives as a fast-follow, and its preferences will live here, per
        face, off by default.
      </p>

      <h3>The testnet rail — connect a wallet</h3>
      <p className="lore">
        <strong>Test network only, by design.</strong> Connecting shares
        one {network} address with the platform — no keys, no custody,
        nothing of real value anywhere on this rail. Real rails wait
        behind their own gate. Per-face, like everything: your other
        face connects its own wallet, or none.
      </p>
      {walletLink ? (
        <p className="lore">
          Linked to this face: <code>{walletLink.cardanoAddress.slice(0, 24)}…</code>{" "}
          ({walletLink.network}, since {walletLink.connectedAt.toLocaleDateString()}).
          Reconnect below to update it.
        </p>
      ) : (
        <p className="lore">No wallet linked to this face yet.</p>
      )}
      <LaceConnect network={network} onLink={submitWalletLink} />

      {walletLink && (
        <>
          <h4>The self-custody proof</h4>
          <p className="lore">
            One small transaction ({network}), built in your browser and
            signed by <strong>your</strong> wallet — a ~2 tADA send from
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
              — publicly verifiable; anyone can look it up. Sign again
              anytime to refresh it.
            </p>
          ) : (
            <p className="lore">No proof signed by this face yet.</p>
          )}
          <SelfCustodySign network={network} onProof={submitSelfCustodyProof} />
        </>
      )}

      <h3>This face&rsquo;s other controls</h3>
      <ul>
        <li>
          <Link href="/profile">The profile window</Link> — your about-me,
          standing, and score log
        </li>
        <li>
          <Link href="/feed/sources">Feed sources</Link> — choose what
          feeds this face&rsquo;s feed
        </li>
        <li>
          <Link href="/search/history">Search history</Link> — per-face,
          deletable, never used to rank
        </li>
      </ul>
    </div>
  );
}
