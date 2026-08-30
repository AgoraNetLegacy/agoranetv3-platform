---
id: help.economy.donations-treasury
slug: donations-treasury
title: Donations and the treasury
summary: Check published treasury activity and distinguish platform-held PC/G from test-wallet custody and transactions.
category: economy
document_type: concept
audience: public
status: approved
version: 1.2.0
effective_at: 2026-08-23
review_by: 2027-02-23
owner: support-content
reviewers:
  - product
  - support
risk: normal
keywords:
  - donation
  - treasury
  - balance
  - funds
  - transaction
  - dPOLL
error_codes: []
onboarding_stages: []
source_refs:
  - help-support-spec
  - owner-directive-2026-07-21
  - economy-specs
  - owners-guide
  - progressive-token-rail
escalate_when: A confirmed transaction is absent from the platform, a balance
  changed unexpectedly, or compromise is suspected.
supersedes: null
links:
  - href: /transparency
    label: Transparency
  - href: /treasury
    label: Treasury
---

Open Transparency for published fees and system activity. Open Treasury for public treasury balances and transactions. AgoraNet uses PC and G as the canonical assets; internal ledger custody and fake dPOLL/dGRA testnet custody are shown as settlement details. A pending custody transfer is shown separately until the chain confirms delivery.

If a donation or treasury transaction looks missing, first check whether your wallet shows it as pending, failed, or confirmed. Save the transaction hash, which is the public reference shown by the wallet, and note the approximate time.

Do not retry a value-moving action repeatedly, and never send Support a wallet seed phrase, spending password, private key, or signing key. A confirmed transaction that is missing from AgoraNet, an unexpected balance change, or suspected theft requires a human support request.
