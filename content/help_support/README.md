# AgoraNet Help & Support corpus

This directory is the canonical source for Help Center content and grounded helpdesk knowledge. Edit the Markdown source, then run `npm run corpus:build`. Never edit generated files under `lib/` directly.

Trust boundaries:

- `public/` may render to any reader and enter public search and public helpdesk retrieval.
- `internal/` is validated and compiled, but requires an explicitly authorized server-side retrieval path.
- `policy/` contains reviewed extracts, not an automatic mirror of the wider product corpus.
- `prompts/` configures assistant behavior and is not factual retrieval evidence.
- `evals/` tests behavior and is never included in a live prompt.

All retrievable documents require approved metadata, registered source references, an owner, and a future review date. The compiler fails closed on invalid or stale content.

## Evaluation

Start the approved local Gemma endpoint and run `npm run helpdesk:eval`. The runner loads every JSONL fixture under `evals/`, checks provider health, executes cases sequentially for the one-slot development runtime, and fails when retrieval, refusal, escalation, severity, or required generation differs from the approved expectation.

Use `npm run helpdesk:eval -- --verbose` to inspect safe synthetic outputs, `--json` for a machine-readable report, or `--filter <id-fragment>` for a focused rerun. Deterministic unit and route tests remain part of normal CI; the live model suite is an explicit acceptance gate because CI must not depend on a developer workstation.
