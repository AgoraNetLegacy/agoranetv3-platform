# Minimal-Log Discipline Audit — the correlation-vector review

Phase 8 deliverable (BUILD_ORDER: "minimal-log discipline audit —
correlation vector review against DUAL_IDENTITY §7"). Conducted
2026-07-11 against every server-side log line and every persisted
network-adjacent field. **The rule under audit (§7.2): what is never
logged can never be subpoenaed or leaked.**

Verdict up front: **the codebase logs almost nothing, by design — and
now it is guarded, not just clean.** Two structural guards keep this
audit true after it's filed: source-level guards in
`tests/hardening.test.ts` (no console output in app code, no header
reads outside the one audited site, no network-identity columns in the
schema) and `db:verify` check 25 (HMAC-shaped counter keys, ops-event
payload allowlists) which runs on every push and every restore drill.

## 1. Inventory — every place the server writes anything

| # | Surface | Finding | Status |
|---|---|---|---|
| 1 | `console.*` in `lib/` + `app/` | **Zero occurrences.** The application code emits no log lines at all. Guarded by test. | ✅ clean |
| 2 | `scripts/*` CLI output | Operator CLIs (demos, verify, backup, drill) print to the operator's own terminal; backup/drill summaries carry file names and counts only. Their durable record is the public admin log (`admin.backup.*`), payload-allowlisted by check 25. | ✅ clean |
| 3 | Next.js runtime | Production `next start` logs startup + unhandled errors to stdout; **no per-request access logging is enabled anywhere in the app**. Framework error output can be captured by the host — see #4. | ✅ clean |
| 4 | **Host/proxy access logs** | The one log surface outside this repo: every host's load balancer writes `IP + path + timestamp` by default — the exact vector-4 record we refuse to keep ourselves. **Posture requirement (binding on any host choice, recorded in docs/DEPLOYMENT.md):** access logging disabled where possible, else minimum retention (≤7 days), never exported into app logs or analytics; log drains OFF. | ⚠ host config, required |
| 5 | `clientAddress()` (lib/webSession.ts) | The ONLY header read in the codebase. Reads `x-forwarded-for` transiently, solely behind `TRUST_PROXY=true`, feeds an HMAC (rate-limit bucket key), is never stored, logged, or returned. Guarded: any new `headers()` consumer fails the test suite. | ✅ audited |
| 6 | `RateLimitBucket` | Keys are `HMAC(secret, policy‖identifier‖window)` — no raw IP/session/profile id can persist as a counter. Rows carry no payload and are pruned after two day-cycles. db:verify check 25 asserts key shape forever. | ✅ clean |
| 7 | `GateRequest` | Stores scope + HMAC nullifier, never a raw network identity; enclosed acts (flags, chambers, social) clear in PRIVATE recording (checks 4/18/24). | ✅ clean (existing) |
| 8 | Schema-wide | **No column anywhere stores IP, user-agent, device fingerprint, or geolocation.** Guarded by test against the schema file. | ✅ clean |
| 9 | One-time secrets | Credentials/access keys travel via httpOnly cookies rendered once — never query strings, which leak into history and host logs (built Phase 2). | ✅ clean (existing) |

**Addendum, 2026-07-15 (not a full re-audit — a targeted check):**
Phase 8.6 added `scripts/chain/*.ts` and `infra/midnight/exercise.ts`,
none of which existed when this audit was conducted. Checked directly
against row #2's finding: `grep` across every chain script for
`console.*` calls near anything secret-shaped (seed, mnemonic, key,
password) returns nothing — they print wallet addresses, transaction
hashes, DIDs, and nullifiers, all either public once submitted or
intentionally opaque, to the operator's own terminal only, exactly
like every other operator CLI row #2 already covers. Verdict
unchanged: still clean, now inventoried by name rather than by
implication. A full audit re-run remains warranted before any
production posture change, per this document's own standing rules.

## 2. The honest finding — session co-residency (vector 4)

`SoulSession`/`SessionFace` is the one place both of a human's faces
can co-occur in operator space: signing both faces into one browser
session creates rows sharing a `sessionId`. This is **inherent to
Phase A** (the platform brokers sessions; there is no wallet to hold
them) and is covered by the ratified disclosure's exact words — "no
database row… links your Alias to your True Self. **During Phase A
this is operator policy, honestly disclosed**" — the co-residency
is transient session state, not an identity link, and it is treated
with the same discipline as the gate secret:

- **Short retention**: expired sessions and locks are purged, and
  db:verify check 10 *sweeps then asserts* — retention failure is a
  build failure.
- **Never queried across personas**: no feature reads another face
  through the session (the parking rule actively prevents co-presence
  per pillar); the linkage audit (Phase 2 checkpoint) showed 0
  co-occurrence rows on any public surface.
- **Dissolves at Phase 9**: wallet-held credentials end platform
  session brokerage; this finding is on the Phase 9 cutover checklist
  alongside the gate secret's retirement.

## 3. The six vectors (§7.1), platform status

| Vector | Status |
|---|---|
| 1. Timing | Parking rule (hard per-pillar lock) + cohort-batched randomized Alias activation + coarse `joinedPeriod`. Face-switch cooldown = NONE by owner decision (2026-07-11), risk disclosed at the ceremony as the soul's own. **Session-end jitter (OPEN_ITEMS #36's second half) dispositioned here:** no public surface renders session ends and no retained log records them (this audit's finding + guards), so in Phase A there is no observable signal to jitter — a jitter mechanism would be motion without cover. Re-check at the Phase 9 wallet-session cutover, where session brokerage changes hands. |
| 2. Stylometry | Cannot be fixed server-side; disclosed verbatim at hatch ("we cannot protect you from your own writing style"). |
| 3. Funding trails | Internal balances are per-profile with blinded fee entries; no chain until Phase 9, where the paymaster posture (OPEN_ITEMS #34) kills the trail. |
| 4. Network metadata | **This audit.** Nothing persisted (see table); host posture required; counters HMAC'd; session co-residency named in §2. |
| 5. Small-population inference | A launch-sequencing/UX-honesty concern — the Alias small-community warning (Circles, place-tagged) ships since Phase 6; early-platform crowd-size honesty belongs to the cold-start pass (this phase, slice 7). |
| 6. Self-disclosure | Disclosed at hatch; no system can help. |

## 4. Standing rules (the discipline going forward)

1. **No new log lines in `lib/` or `app/`** — the guard test makes
   this a conscious, reviewed exception, never a habit.
2. **No new `headers()` consumers** without extending this audit and
   the guard's allowlist in the same commit.
3. **New `admin.*` event types must be payload-allowlisted** in
   db:verify check 25 before they can ship (unaudited types fail).
4. **Any error-tracking/observability tooling** (none is installed
   today) gets its own §7 review before adoption — a stack trace with
   a session id in it is a log line like any other.
5. Host onboarding (staging or production) is not complete until the
   access-log posture (#4 above) is configured and noted in
   docs/DEPLOYMENT.md.
