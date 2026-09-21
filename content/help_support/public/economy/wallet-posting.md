---
id: help.economy.wallet-posting
slug: wallet-posting
title: Post or reply with your testnet wallet
summary: With wallet custody selected, Lace asks you to approve the displayed test dPOLL fee before AgoraNet publishes a Discussion post.
category: economy
document_type: procedure
audience: public
status: approved
version: 1.1.0
effective_at: 2026-08-23
review_by: 2027-02-24
owner: support-content
reviewers:
  - product
  - support
risk: normal
keywords:
  - wallet post
  - wallet reply
  - Lace popup
  - dPOLL fee
  - pending post
  - paid twice
  - wrong account
  - chamber wallet mode
  - workshop wallet mode
  - permanence acknowledgment
  - Constitution acknowledgment
error_codes: []
onboarding_stages: []
source_refs:
  - help-support-spec
  - progressive-token-rail
escalate_when: A testnet fee is confirmed but the post remains unpublished or marked for support review.
supersedes: null
links:
  - href: /settings
    label: Check wallet and participation settings
  - href: /support
    label: Open Help and Support
---

You can use AgoraNet without a wallet. This page applies only after you deliberately choose **wallet custody** in Settings.

Before an identity can make its first post, that identity must complete the two onboarding consent steps. This is separate for each True Self and Alias; completing them for one identity does not complete them for another. If the post button says **“The permanence and Constitution acknowledgments come first,”** open [`/verify/consents`](/verify/consents) while signed in as the identity that is trying to post. Complete the two buttons in order: **I understand what permanence means here**, then **I acknowledge the Constitution**. Then return to the discussion. The discussion composer does not show these buttons itself.

To make an ordinary Discussion post or reply with wallet custody:

1. Write the post and select the posting button.
2. AgoraNet checks the post before asking for payment.
3. Lace opens and shows the fake **dPOLL** fee. Cardano also requires test tADA for the network fee and the script output, so the wallet needs both fake dPOLL and enough test tADA. Check that Lace is on the test network named in Settings and is using the account linked to this AgoraNet identity.
4. Approve the transaction in Lace. AgoraNet never sees your spending password, seed phrase, or private key.
5. Wait while the page says **pending**. AgoraNet publishes the post only after the test network proves that the linked wallet sent the correct fake asset and amount to the expected script.

Pending does not mean failure. Cardano confirmation can take a little time. Do not pay again. If you close the page or the app restarts after the transaction was submitted, AgoraNet keeps the public transaction hash and can finish the post automatically.

When the post is confirmed, eligible fake dGRA and dPOLL rewards are queued to the linked wallet. Reward delivery may appear after the post because it is processed separately and verified on the chain.

Some actions may still use platform-held PC/G while their wallet settlement rail is being implemented. Wallet custody does not create another currency.

Chambers and workshop posts use the same PC and G, but they are the one place that charges in BOTH tokens at once: opening a chamber costs PollCoin and Gratium together, and neither covers the other's half. That is deliberate, so people building in the Pollinator carry a working stock of each.

You can pay either way. If AgoraNet holds your tokens, the chamber form spends your platform balance. If you hold your own keys, the Pollinator offers a self-custody option: Lace asks you to approve one transaction carrying both tokens at once, and the chamber opens only after the testnet confirms it. Choosing self-custody never costs you the ability to build here, and you are never asked to hand your tokens over first.

Workshop posts inside a chamber are still paid from platform-held balances; wallet settlement for the in-chamber micro-fee is not built yet, and the composer says so rather than failing quietly.

If Lace shows the wrong account, decline the request, switch accounts in Lace, and try again. If the transaction was already submitted and the post still does not appear, open Help and Support and include the public transaction hash and the exact non-secret message shown. Never include an access key, seed phrase, spending password, signing key, or private key.
