---
id: help.economy.money
slug: money
title: PC, G, and where your tokens are held
summary: AgoraNet has two currencies, PC and G; they may be held by the platform or in your connected testnet wallet.
category: economy
document_type: concept
audience: public
status: approved
version: 1.3.0
effective_at: 2026-08-23
review_by: 2027-02-23
owner: support-content
reviewers:
  - product
  - support
risk: normal
keywords:
  - PollCoin
  - Gratium
  - PC
  - fee
  - balance
  - platform custody
  - wallet custody
  - transfer
  - cost
error_codes: []
onboarding_stages: []
source_refs:
  - help-support-spec
  - owner-directive-2026-07-21
  - economy-specs
  - owners-guide
  - progressive-token-rail
escalate_when: null
supersedes: null
links:
  - href: /settings
    label: Choose platform or wallet custody
  - href: /transparency
    label: View current fees and balances
---

AgoraNet has two currencies: PollCoin (PC) and Gratium (G). There is no separate Credits currency. You do not need a crypto wallet: new profiles begin with platform custody, where AgoraNet holds that profile's PC and G.

If you already understand wallets, open Settings, connect a supported Cardano testnet wallet, and choose wallet custody. The header identifies wallet-held dPOLL and dGRA alongside any platform-held PC/G. These test assets have no real value. Your wallet remains under your control; AgoraNet never asks for its seed phrase or private key.

Wallet custody is an alternate location and settlement rail for the same PC/G assets, not another currency. Wallet-ready actions may ask Lace to approve the corresponding testnet token movement. Platform-held tokens can be used without a wallet signature.

The first wallet-ready action is an ordinary Discussion post or reply. Lace asks for the displayed dPOLL fee. After you approve it, the page may say **pending** while Cardano Preprod confirms the payment. Do not pay a second time. If the browser closes, AgoraNet keeps the public transaction hash and can finish the pending post automatically.

Settings shows **Your recent testnet wallet activity** for the current AgoraNet identity. It translates the technical steps into plain statuses such as waiting for Lace, being sent, waiting for testnet confirmation, confirmed, or support review needed. Confirmed and submitted items link to the public testnet transaction when a hash exists. Wallet addresses are not repeated in this timeline.

When testnet custody transfers are enabled, an internal PC/G balance may be moved to the linked wallet through an explicit, auditable settlement action. This is never automatic; the amount, destination, pending state, and confirmation are shown separately.

Small fees and refundable deposits discourage automated spam and repeated disruptive actions. A fee is not vote weight, reputation, or permission to break a rule. Current amounts and limits are published on Transparency and may change through the platform's approved voting process.

AgoraNet does not sell or rank attention. Views, time spent reading, and engagement tracking are not used to build a personal advertising profile or to decide what appears in search.
