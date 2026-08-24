---
id: internal.escalation.core
title: Core helpdesk escalation matrix
summary: Establishes severity floors and the boundary between self-service and human review.
category: privacy-safety
document_type: escalation-matrix
audience: operator
status: approved
version: 1.1.0
effective_at: 2026-08-23
review_by: 2026-11-23
owner: support-operations
reviewers: [support, privacy, security]
risk: critical
keywords: [escalation, severity, compromise, missing funds, verification, moderation]
error_codes: []
onboarding_stages: []
source_refs: [help-support-spec, dual-identity-spec, moderation-spec]
escalate_when: Any mandatory category below is detected.
supersedes: null
links: []
---

Critical: active compromise, reported security vulnerability, exposed private data, or potentially missing funds. Stop self-service and route for urgent human review without promising a response time that operations has not ratified.

High: repeated onboarding blockage, verification review, lost keys, privacy or harassment concerns, moderation appeals, and suspected compromise without an active-loss signal.

Normal: repeatable feature malfunction, pending transaction, or technical failure that remains unresolved after approved safe steps.

Informational: supported how-to and policy questions. The model may raise severity but never reduce the deterministic application classification.

User-facing escalation language must state what the person should select in Help and Support, what non-secret information to include, and what Support can and cannot do. Do not answer only with an internal severity label.
