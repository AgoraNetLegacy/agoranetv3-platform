# AgoraNet v3

A purpose-built civic commons: deliberation, decision-making, permanent
records, and provable collective action — one verified human, two
protected faces, an economy of assent instead of attention, and a
constitution that hands the platform to its community on a seven-year
schedule.

**Status:** Phase 0 (Foundation) — construction began 2026-07-10
against a complete ratified specification corpus.

- Specifications: see `CLAUDE.md` for the corpus location and build law.
- Construction sequence: BUILD_ORDER phases 0–9.
- Stack: Next.js · Prisma (SQLite dev → Postgres at Phase 8) · Cardano +
  Midnight at Phase 9, behind a legal gate.

## Getting started

```bash
cp .env.example .env       # then set a real GATE_OPERATOR_SECRET
npm install
npx prisma db push         # create prisma/dev.db
npm run db:seed            # seed the canon (7 pillars, 49 questions)
npm run db:verify          # the invariant check — run after any session
npm test                   # unit + integration tests
```

## Phase 0 checkpoint (owner review)

```bash
npm run demo:phase0        # gate-cleared events landing on the ledger, pseudonymously
npm run demo:tamper        # the invariant check failing loudly, twice
```

Both demos run against a self-contained `prisma/demo.db`; nothing touches
your dev database.

## What exists (Phase 0)

- **The Civic Ledger** (`lib/ledger.ts`) — append-only, hash-chained from
  GENESIS, pseudonym-only. `npm run db:verify` re-verifies the whole chain
  and scans every event for internal ids.
- **The gate** (`lib/gate.ts`) — pending → proof → cleared, the one flow
  every gated action uses forever. Phase A: operator-trusted HMAC
  nullifier (honestly disclosed in-module); per-profile and per-human
  scopes both live from day one. No feature ever bypasses it.
- **The canon** (`lib/canon.ts`) — 7 pillars × 7 lenses = 49 questions,
  seeded as data with every seeding on the ledger.

*The six pillars diagnose. The Agora equips. The community inherits.*
