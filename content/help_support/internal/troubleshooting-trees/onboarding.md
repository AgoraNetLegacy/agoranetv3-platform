---
id: internal.troubleshooting.onboarding
title: Onboarding troubleshooting tree
summary: Provides a bounded sequence for interrupted or repeatedly failing onboarding.
category: getting-started
document_type: troubleshooting-tree
audience: operator
status: approved
version: 1.2.0
effective_at: 2026-08-23
review_by: 2026-11-23
owner: onboarding-support
reviewers: [product, engineering, privacy]
risk: high
keywords: [onboarding stuck, verification failed, resume, gate]
error_codes: []
onboarding_stages: [gate, credential, identity, alias, values]
source_refs: [help-support-spec, onboarding-spec, dual-identity-spec]
escalate_when: The same stage fails twice, verification needs review, or a one-time secret may be lost or exposed.
supersedes: null
links: []
---

First identify the current account-setup step from allowlisted context or ask one focused question about the heading visible on the page. Do not expect the user to know an internal stage name. Do not ask the user to repeat a completed verification check or recreate a profile until the approved article establishes that it is safe.

If the browser was closed, send the user to the account setup page at `/verify` and ask them to open it in the same browser. If a profile was already created and its access key was saved, send them to Sign in at `/login` instead of telling them to begin again.

If a one-time secret was shown but may not have been saved, stop and apply the recovery-boundary guidance. If verification was rejected or the same step fails twice, offer a human support request with the stage and non-secret error code.
