---
id: help.economy.wallet-posting
slug: wallet-posting
title: Post or reply with your testnet wallet
summary: In Wallet mode, Lace asks you to approve the displayed fake dPOLL fee before AgoraNet publishes a Discussion post.
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

You can use AgoraNet without a wallet. This page applies only after you deliberately choose **Wallet mode** in Settings.

Before an identity can make its first post, that identity must complete the two onboarding consent steps. This is separate for each True Self and Alias; completing them for one identity does not complete them for another. If the post button says **“The permanence and Constitution acknowledgments come first,”** open [`/verify/consents`](/verify/consents) while signed in as the identity that is trying to post. Complete the two buttons in order—**I understand what permanence means here**, then **I acknowledge the Constitution**—and return to the discussion. The discussion composer does not show these buttons itself.

To make an ordinary Discussion post or reply in Wallet mode:

1. Write the post and select the posting button.
2. AgoraNet checks the post before asking for payment.
3. Lace opens and shows the fake **dPOLL** fee. Cardano also requires test tADA for the network fee and the script output, so the wallet needs both fake dPOLL and enough test tADA. Check that Lace is on the test network named in Settings and is using the account linked to this AgoraNet identity.
4. Approve the transaction in Lace. AgoraNet never sees your spending password, seed phrase, or private key.
5. Wait while the page says **pending**. AgoraNet publishes the post only after the test network proves that the linked wallet sent the correct fake asset and amount to the expected script.

Pending does not mean failure. Cardano confirmation can take a little time. Do not pay again. If you close the page or the app restarts after the transaction was submitted, AgoraNet keeps the public transaction hash and can finish the post automatically.

When the post is confirmed, eligible fake dGRA and dPOLL rewards are queued to the linked wallet. Reward delivery may appear after the post because it is processed separately and verified on the chain.

Some AgoraNet actions are not wallet-ready yet, including workshop posts that require two token types, tips, permanence upgrades, and mission releases. AgoraNet will tell you when that happens. Switch this identity to Credits mode in Settings if you need one of those actions now. The platform will not silently use internal Credits while the identity remains in Wallet mode.

Chamber and workshop posts are currently in that not-yet-wallet-ready group. They use a two-token action, so Wallet mode will show **“This action is not available in Wallet mode yet.”** Switch the current identity to **Credits mode** in Settings, save the participation mode, and then post in the Chamber. This does not change another identity’s mode.

If Lace shows the wrong account, decline the request, switch accounts in Lace, and try again. If the transaction was already submitted and the post still does not appear, open Help and Support and include the public transaction hash and the exact non-secret message shown. Never include an access key, seed phrase, spending password, signing key, or private key.
