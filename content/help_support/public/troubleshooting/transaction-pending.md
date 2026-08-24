---
id: help.troubleshooting.transaction-pending
slug: transaction-pending
title: A transaction is pending or failed
summary: Check the wallet status and test network, save the public transaction reference, and avoid sending the same transaction repeatedly.
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
links:
  - href: /transparency
    label: Check published transaction information
  - href: /support
    label: Open Help and Support
---

Open the wallet used for the action. Check whether it shows the transaction as pending, failed, rejected, or confirmed, and confirm that the wallet is using the same Cardano test network shown by AgoraNet.

Pending means the test network has not confirmed the transaction yet. Rejected means the wallet did not submit it. Confirmed means the network accepted it, although AgoraNet may need additional time to display the result.

Save the transaction hash, which is the public reference shown by the wallet. If there is no hash, save the non-secret error message and the action you attempted. Do not submit the same value-moving action repeatedly. Open a support request if a confirmed transaction is missing, the balance is unexpected, or you are unsure whether retrying would duplicate it.
