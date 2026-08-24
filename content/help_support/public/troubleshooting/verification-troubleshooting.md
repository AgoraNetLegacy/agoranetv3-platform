---
id: help.troubleshooting.verification-troubleshooting
slug: verification-troubleshooting
title: Verification is pending, rejected, or interrupted
summary: Resume safely, understand the current test-rail limits, and know when a
  human must review the issue.
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
  - verification failed
  - verification pending
  - stuck onboarding
  - issuer
  - proof of humanity
error_codes: []
onboarding_stages:
  - gate
source_refs:
  - help-support-spec
  - owner-directive-2026-07-21
  - onboarding-spec
  - owners-guide
escalate_when: The same verification step fails twice, the issuer reports a
  rejection, or you suspect your credential was exposed.
supersedes: null
links:
  - href: /verify
    label: Open onboarding
---

Open [AgoraNet onboarding](/verify) again in the same browser. A page refresh or closed tab does not create a second identity; incomplete ceremonies simply return to the last safe boundary.

If the onboarding page reports an error, copy the non-secret error code and the stage where it happened. Never send your Humanity Credential, access key, wallet seed phrase, or private key to Support.

A verification decision that requires review cannot be changed by the helpdesk. Open a support case so a human can inspect the safe diagnostic record.
