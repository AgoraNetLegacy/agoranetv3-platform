---
id: help.troubleshooting.transaction-pending
slug: transaction-pending
title: A transaction is pending or failed
summary: Check network and chain status, then preserve the transaction hash for support.
category: troubleshooting
document_type: troubleshooting
audience: public
status: approved
version: 1.0.0
effective_at: 2026-08-22
review_by: 2027-02-23
owner: support-content
reviewers:
  - product
  - privacy
  - support
risk: high
keywords:
  - transaction pending
  - transaction failed
  - tx hash
  - chain
  - balance missing
error_codes: []
onboarding_stages: []
source_refs:
  - help-support-spec
  - owner-directive-2026-07-21
  - economy-specs
  - owners-guide
escalate_when: A confirmed transaction is not reflected, the balance is
  unexpected, or repeated attempts could duplicate the action.
supersedes: null
links: []
---

Confirm that the wallet and platform are using the same test network. A submitted transaction may remain pending while the network confirms it; a wallet rejection means it was not submitted.

If a transaction hash exists, keep it. If no hash exists, record the non-secret error text and the action you attempted. Never retry a value-moving action repeatedly without first checking whether the earlier transaction landed.
