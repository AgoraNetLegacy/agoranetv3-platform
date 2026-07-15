import Link from "next/link";
import { db } from "@/lib/db";
import { getRail } from "@/lib/rails";
import { anchorStatus } from "@/lib/chainAnchor";
import {
  computeBooks,
  ensureDailySnapshot,
  KIND_CATEGORIES,
  type CategoryTotals,
} from "@/lib/transparency";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

// The transparency dashboard (TREASURY_DASHBOARD_SPEC): public, free, no
// account — the platform's proof-of-integrity artifact. When AgoraNet
// says "no ads, no data sales — participation fees fund everything,"
// this page is where that claim is checkable, by anyone, forever.
function CategoryTable({
  totals,
  drillDown,
}: {
  totals: CategoryTotals;
  drillDown?: boolean;
}) {
  const aggregateOnly = new Set(
    Object.values(KIND_CATEGORIES)
      .filter((k) => k.aggregateOnly)
      .map((k) => k.category)
  );
  const categories = Object.entries(totals).sort(([a], [b]) => a.localeCompare(b));
  if (categories.length === 0) {
    return <p className="lore">No flows in this direction yet — an honest zero.</p>;
  }
  return (
    <table className="books">
      <thead>
        <tr>
          <th>Category</th>
          <th>PollCoin</th>
          <th>Gratium</th>
          <th>Entries</th>
        </tr>
      </thead>
      <tbody>
        {categories.map(([category, t]) => (
          <tr key={category}>
            <td>
              {category}
              {aggregateOnly.has(category) && (
                <div className="lore">
                  aggregate only — itemizing would identify badge holders
                  (moderator anonymity beats itemization, by ratified law)
                </div>
              )}
            </td>
            <td>{t.PC.toFixed(2)}</td>
            <td>{t.G.toFixed(2)}</td>
            <td>
              {drillDown && !aggregateOnly.has(category) ? (
                <Link href={`/transparency/entries?category=${encodeURIComponent(category)}`}>
                  {t.entries} — inspect →
                </Link>
              ) : (
                t.entries
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function TransparencyPage() {
  const snapshot = await ensureDailySnapshot(db);
  const cadenceHours = await getRail(db, "treasury.snapshotCadenceHours");
  const balances: { PC: number; G: number } = JSON.parse(snapshot.balances);
  const inflows: CategoryTotals = JSON.parse(snapshot.inflows);
  const outflows: CategoryTotals = JSON.parse(snapshot.outflows);
  const { issuance } = await computeBooks(db);

  const [snapshots, adminEvents, anchors] = await Promise.all([
    db.treasurySnapshot.findMany({ orderBy: { day: "desc" }, take: 30 }),
    db.ledgerEvent.findMany({
      where: { eventType: { startsWith: "admin." } },
      orderBy: { seq: "desc" },
      take: 50,
    }),
    anchorStatus(db),
  ]);
  const dpollPolicy = process.env.TEST_POLLCOIN_POLICY_ID;
  const midnightContract = process.env.MIDNIGHT_NULLIFIER_CONTRACT;
  const cardanoNet = process.env.CARDANO_NETWORK ?? "preprod";
  const midnightNet = process.env.MIDNIGHT_NETWORK ?? "preview";
  const explorer = `https://${cardanoNet}.cardanoscan.io`;

  return (
    <>
      <h1><Icon name="temple" /> The transparency dashboard</h1>
      <p>
        Every fee on this platform flows to the treasury, and this page is
        the answer to &ldquo;where did the money go&rdquo; — readable by
        anyone on the internet, no account, forever. Three questions, one
        surface: <strong>what came in, what went out, and what have the
        operators done.</strong>
      </p>
      <p className="lore">
        Snapshot taken {snapshot.takenAt.toLocaleString()} (UTC day {snapshot.day}).
        Published schedule: aggregates refresh once per {cadenceHours}-hour
        cycle — the lag is a stated property, not an ambiguity. The{" "}
        <Link href="/ledger">civic ledger</Link> underneath stays live at all
        times, and every drill-down reaches current state.{" "}
        <Link href="/transparency/export">Export (CSV) →</Link>
      </p>

      <h3>What runs on real rails today</h3>
      <p className="lore">
        Phase 8.6 status, stated plainly: test networks, play money, real
        machinery. Each line below is either publicly checkable or an
        honest &ldquo;not yet.&rdquo;
      </p>
      <ul className="discussions">
        <li>
          <strong>The demo token.</strong> PollCoin Demo (dPOLL) is a real
          asset on Cardano {cardanoNet} — explicitly test-grade, no value,
          ever.{" "}
          {dpollPolicy ? (
            <a href={`${explorer}/tokenPolicy/${dpollPolicy}`}>
              Verify the minting policy on a public explorer →
            </a>
          ) : (
            <span className="meta">(not configured in this environment)</span>
          )}
        </li>
        <li>
          <strong>The ledger anchor.</strong> The{" "}
          <Link href="/ledger">civic ledger</Link>&rsquo;s head hash is
          witnessed by a public {cardanoNet} transaction on a{" "}
          {anchors.cadenceHours}-hour rhythm (a rail) whenever the ledger
          has moved — after an anchor, silently rewriting history here
          means beating a public blockchain too.{" "}
          {anchors.lastAnchor ? (
            <>
              Latest: seq {anchors.lastAnchor.anchoredSeq} anchored{" "}
              {anchors.lastAnchor.at.toLocaleString()} —{" "}
              <a href={`${explorer}/transaction/${anchors.lastAnchor.txHash}`}>
                verify the transaction →
              </a>
            </>
          ) : (
            <span className="meta">
              No anchor recorded on this database yet — the first cadence
              run writes it, and it will be linked here.
            </span>
          )}
        </li>
        <li>
          <strong>The identity issuer.</strong> A real Identus issuer runs
          on our test rails: the full issue → hold → verify credential
          ceremony works, and credential recovery is proven (a returning
          human gets their SAME identity back). Honest scope: it is
          platform-operated, on a test network, and the live gate has not
          cut over to it yet.
        </li>
        <li>
          <strong>The one-per-scope law, as math.</strong> A Midnight{" "}
          {midnightNet} testnet contract enforces the gate&rsquo;s
          one-voice-per-scope rule with zero-knowledge proofs — a spent
          nullifier is publicly auditable, linkable to no one, and a
          duplicate is refused by the chain itself.{" "}
          {midnightContract ? (
            <>
              Contract address:{" "}
              <code style={{ wordBreak: "break-all" }}>{midnightContract}</code>{" "}
              (verifiable via Midnight&rsquo;s public {midnightNet} indexer).
            </>
          ) : (
            <span className="meta">(not configured in this environment)</span>
          )}{" "}
          Honest scope: proofs run through a local dev proof server in
          20–60 seconds — a working demonstration, not yet consumer UX.
        </li>
        <li>
          <strong>What does NOT run on chain today,</strong> so nothing
          here oversells: the live gate still enforces one-per-scope with
          an operator-held secret (the Phase A disclosure stays up);
          PollCoin and Gratium balances are database rows; DM keys are
          operator-escrowed as disclosed in every thread. Each claim
          upgrades only when its layer truly lands — never before.
        </li>
      </ul>

      <h3>Treasury balances</h3>
      <div className="stat-row">
        <div className="stat">
          <div className="stat-number">{balances.PC.toFixed(2)}</div>
          <div className="stat-label">PollCoin (internal units)</div>
        </div>
        <div className="stat">
          <div className="stat-number">{balances.G.toFixed(2)}</div>
          <div className="stat-label">Gratium (internal units)</div>
        </div>
      </div>
      <p className="lore">
        Internal-balance era: both currencies are database rows, honestly
        disclosed. Chain-held balances and their addresses publish at the
        Phase 9 boundary for independent verification.
      </p>

      <h3>What came in — by source</h3>
      <CategoryTable totals={inflows} drillDown />
      <p className="lore">
        Deposits are held pending their case's outcome: refunds appear
        under outflows, so the net of the two is what bad faith actually
        forfeited. Vote-fee entries carry no poll reference by design —
        sealed means sealed.
      </p>

      <h3>What went out — by budget category</h3>
      <CategoryTable totals={outflows} drillDown />
      <p className="lore">
        The Constitution&rsquo;s must-guardrail, rendered structurally: an
        outflow without a budget category cannot exist — an unmapped flow
        fails this page loudly rather than rendering as &ldquo;misc&rdquo;.
        Per-category budget amounts await the ratified launch budget
        (TREASURY_DASHBOARD §7.1); utilization-vs-budget renders here the
        day they exist.
      </p>

      <h3>Issuance — the internal era&rsquo;s faucet, in the open</h3>
      <CategoryTable totals={issuance} />
      <p className="lore">
        Welcome Grants and participation accrual mint new internal units
        (they come from issuance, not the treasury). Shown here so the
        money story has no dark corners.
      </p>

      <h3>What have the operators done — the admin action log</h3>
      {adminEvents.length === 0 ? (
        <p className="lore">
          No privileged operator actions have been recorded — an honest
          empty log, not a missing one. When the operator console exists,
          every privileged action lands on the civic ledger reason-coded
          and individually attributed, including every break-glass use,
          and this section mirrors all of it.
        </p>
      ) : (
        <ul className="discussions">
          {adminEvents.map((e) => (
            <li key={e.seq}>
              <strong>{e.eventType}</strong> · {e.createdAt.toLocaleString()}
              <div className="meta">{e.payload}</div>
            </li>
          ))}
        </ul>
      )}

      <h3>History</h3>
      <table className="books">
        <thead>
          <tr>
            <th>Day</th>
            <th>Treasury PC</th>
            <th>Treasury G</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((s) => {
            const b = JSON.parse(s.balances) as { PC: number; G: number };
            return (
              <tr key={s.day}>
                <td>{s.day}</td>
                <td>{b.PC.toFixed(2)}</td>
                <td>{b.G.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p style={{ marginTop: "1rem" }}>
        <Link href="/transparency/moderation">Moderation statistics →</Link> ·{" "}
        <Link href="/commons">State of the Commons →</Link> ·{" "}
        <Link href="/treasury">The raw inspection page →</Link>
      </p>
    </>
  );
}
