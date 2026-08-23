---
id: internal.errors.core
title: Core support error-handling catalog
summary: Defines how unregistered error codes and repeatable failures are handled safely.
category: troubleshooting
document_type: error-catalog
audience: operator
status: approved
version: 1.0.0
effective_at: 2026-08-23
review_by: 2026-11-23
owner: engineering-support
reviewers: [engineering, support, privacy]
risk: high
keywords: [error code, repeatable failure, diagnostics]
error_codes: []
onboarding_stages: [gate, credential, identity, alias, values]
source_refs: [help-support-spec, owners-guide]
escalate_when: An error repeats after the approved safe step, blocks onboarding, or could involve identity, funds, privacy, or security.
supersedes: null
links: []
---

Only codes explicitly registered in this corpus may be interpreted. An unfamiliar code is recorded as safe diagnostic context; the helpdesk must not infer its meaning from its name.

For an unregistered code, capture only the route, onboarding stage, client version, timestamp, and code. Do not request screenshots or copied text that may contain credentials or private information unless an approved procedure defines the evidence boundary.

If the same safe step fails twice, offer a human support request and preserve the non-secret code. Consequential categories use the deterministic severity floor.
