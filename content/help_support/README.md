# AgoraNet Help & Support corpus

This directory is the canonical source for Help Center content and grounded helpdesk knowledge. Edit the Markdown source, then run `npm run corpus:build`. Never edit generated files under `lib/` directly.

Trust boundaries:

- `public/` may render to any reader and enter public search and public helpdesk retrieval.
- `internal/` is validated and compiled, but requires an explicitly authorized server-side retrieval path.
- `policy/` contains reviewed extracts, not an automatic mirror of the wider product corpus.
- `prompts/` configures assistant behavior and is not factual retrieval evidence.
- `evals/` tests behavior and is never included in a live prompt.

All retrievable documents require approved metadata, registered source references, an owner, and a future review date. The compiler fails closed on invalid or stale content.
