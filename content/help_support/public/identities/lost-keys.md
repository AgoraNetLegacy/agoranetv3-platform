---
id: help.identities.lost-keys
slug: lost-keys
title: Lost keys and recovery boundaries
summary: AgoraNet cannot resend private sign-in codes; protect any browser that is still signed in and get help if a code may be exposed.
category: identities
document_type: recovery-boundary
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
links:
  - href: /login
    label: Sign in if you still have the access key
  - href: /support
    label: Open Help and Support
---

AgoraNet cannot read, resend, or reset a Humanity Credential or profile access key because it does not store a readable copy. Support cannot recover one for you.

If one browser is still signed in, leave that session open. Do not clear its cookies, remove its site data, or sign out while you decide what to do. An Alias, which is a separate private profile, cannot be recovered through the public True Self profile because that would reveal a connection AgoraNet is designed not to store.

If someone else may have seen or copied a code, stop pasting or using that code and open an urgent support request. Describe what happened without including the code itself. Support can help document and assess the problem, but cannot promise to undo actions that are already final.
