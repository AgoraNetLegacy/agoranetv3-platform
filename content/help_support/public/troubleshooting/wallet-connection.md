---
id: help.troubleshooting.wallet-connection
slug: wallet-connection
title: Wallet connection troubleshooting
summary: Unlock Lace, select the test network shown by AgoraNet, reload once, and approve the browser connection.
category: troubleshooting
document_type: troubleshooting
audience: public
status: approved
version: 1.1.0
effective_at: 2026-08-22
review_by: 2027-02-23
owner: support-content
reviewers:
  - product
  - support
risk: normal
keywords:
  - wallet not connecting
  - Lace
  - CIP-30
  - preprod
  - wrong network
  - wallet error
error_codes: []
onboarding_stages: []
source_refs:
  - help-support-spec
  - owner-directive-2026-07-21
  - owners-guide
escalate_when: The wallet remains unavailable after reload, the network is
  correct, and the wallet itself shows no pending approval.
supersedes: null
links:
  - href: /support
    label: Open Help and Support
---

AgoraNet's current wallet features use a Cardano test network, not Cardano mainnet. Confirm that the Lace browser wallet is installed and unlocked. In Lace, select the same test network named on the AgoraNet page.

Return to AgoraNet, reload the page once, select Connect wallet, and approve the request in the Lace window. If no wallet window appears, check whether the browser blocked a pop-up or whether the Lace window opened behind another window.

If it still does not connect, open Help and Support and include the browser name, selected network, and non-secret error message. A public wallet address or transaction hash may be included when needed. Never include a seed phrase, spending password, signing key, private key, or access key.
