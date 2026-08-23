---
id: help.identities.lost-keys
slug: lost-keys
title: Lost keys and recovery boundaries
summary: Understand what can be recovered, what cannot, and how to report a
  suspected compromise.
category: identities
document_type: recovery-boundary
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
risk: critical
keywords:
  - lost key
  - lost credential
  - seed phrase
  - recover account
  - compromised
  - stolen wallet
error_codes: []
onboarding_stages: []
source_refs:
  - help-support-spec
  - owner-directive-2026-07-21
  - dual-identity-spec
  - owners-guide
escalate_when: A key may be compromised, funds may be at risk, or you are unsure
  whether an existing signed-in session can be preserved.
supersedes: null
links: []
---

AgoraNet cannot read or resend a Humanity Credential or identity access key because it stores only their hashes. An Alias deliberately has no True-Self-routed recovery path; creating one would become a correlation path.

If you still have a signed-in browser, do not sign out until you understand the consequences. If you suspect compromise, stop using the affected key and open a critical support case. Support can explain and preserve evidence, but cannot promise to reverse an irreversible action.
