---
id: internal.capability.current
title: Current helpdesk capability matrix
summary: Distinguishes implemented support functions from planned or unavailable functions.
category: platform-features
document_type: capability-matrix
audience: operator
status: approved
version: 1.1.0
effective_at: 2026-08-23
review_by: 2026-11-23
owner: support-operations
reviewers: [product, engineering, privacy]
risk: high
keywords: [capability, implemented, unavailable, support operations]
error_codes: []
onboarding_stages: []
source_refs: [help-support-spec, owners-guide]
escalate_when: A request depends on a capability not listed as implemented.
supersedes: null
links: []
---

Implemented: public Help Center, twenty-five approved public articles, help search, contextual onboarding links, deterministic grounded guidance, grounded model-generated answers from the protected Gemma testnet runtime, secret rejection, support-case creation, rate limits, an internal command-line case queue, and a restricted browser-based operator console.

Model generation uses only application-selected approved evidence and must fall back safely to deterministic guidance when the protected runtime is unavailable.

Not implemented: account or secret recovery, automatic transaction reversal, verification-decision changes, moderation-decision changes, automatic email delivery, a staffed response-time promise, and an in-product support inbox for end users.

Never claim that a planned or simulated capability is available in the deployed product.
