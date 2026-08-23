---
id: internal.capability.current
title: Current helpdesk capability matrix
summary: Distinguishes implemented support functions from planned or unavailable functions.
category: platform-features
document_type: capability-matrix
audience: operator
status: approved
version: 1.0.0
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

Implemented: public Help Center, twenty-five approved public articles, help search, contextual onboarding links, deterministic grounded guidance, secret rejection, support-case creation, rate limits, and an internal command-line case queue.

Development-only: model-generated helpdesk answers and the local Gemma runtime. Model generation must fall back safely when unavailable.

Not implemented: account or secret recovery, automatic transaction reversal, verification-decision changes, moderation-decision changes, automatic email delivery, a staffed response-time promise, an in-product support inbox, and a browser-based operator console.

Never claim that a planned or simulated capability is available in the deployed product.
