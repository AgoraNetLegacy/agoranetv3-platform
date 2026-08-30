---
id: help.troubleshooting.wallet-connection
slug: wallet-connection
title: Wallet connection troubleshooting
summary: Unlock Lace, select the test network shown by AgoraNet, reload once, and approve the browser connection.
category: troubleshooting
document_type: troubleshooting
audience: public
status: approved
version: 1.4.0
effective_at: 2026-08-23
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
  - identity consents
  - chamber wallet mode
error_codes: []
onboarding_stages: []
source_refs:
  - help-support-spec
  - owner-directive-2026-07-21
  - owners-guide
  - progressive-token-rail
escalate_when: The wallet remains unavailable after reload, the network is
  correct, and the wallet itself shows no pending approval.
supersedes: null
links:
  - href: /support
    label: Open Help and Support
  - href: /settings
    label: Open wallet and participation settings
---

You can keep using platform-held PC/G without a wallet. Connect one only if you want to test wallet custody.

AgoraNet's current wallet features use a Cardano test network, not Cardano mainnet. Confirm that the Lace browser wallet is installed and unlocked. In Lace, select the same test network named on the AgoraNet Settings page.

Return to Settings, reload the page once, select Connect Lace, and approve the request in the Lace window. After it connects, choose wallet custody if you want to use the wallet directly, or keep platform custody. If no wallet window appears, check whether the browser blocked a pop-up or whether the Lace window opened behind another window.

Wallet connection does not finish every onboarding requirement. If posting later says **“The permanence and Constitution acknowledgments come first,”** the current identity still needs its own consent steps. Open [`/verify/consents`](/verify/consents), complete both buttons in order, and return to the post. True Self and Alias consent records are separate.

If AgoraNet says Lace opened the wrong account, open Lace and select the same account you linked to the current AgoraNet identity. Your True Self and Alias should use separate Cardano accounts. Then return to the page and try again.

If a post says its payment was submitted or pending, **do not click again and do not make a second payment**. Leave the page open if convenient, but it is safe to close it: AgoraNet stores the public transaction hash and its recovery process can finish the post after the test network confirms. A message that says the payment needs support review means the fake payment was preserved even though the post could not be published automatically.

If it still does not connect, open Help and Support and include the browser name, selected network, and non-secret error message. A public wallet address or transaction hash may be included when needed. Never include a seed phrase, spending password, signing key, private key, or access key.

If a Chamber or workshop says wallet settlement is unavailable, the wallet is not necessarily broken. Select platform custody in Settings to use platform-held PC/G for that action.
