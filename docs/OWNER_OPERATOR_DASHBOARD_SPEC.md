# Owner/Operator Dashboard; Growth, Onboarding & Platform Health

**Status:** Draft implementation specification  
**Prepared:** 2026-08-25  
**Initial authorization:** `@shawnb` only  
**Initial environment:** AgoraNet testnet/staging and production read-only reporting

## 1. Purpose

AgoraNet currently exposes public aggregate growth information through
`/commons`, but the owner has no restricted operational view for answering:

- How many verified humans and active profiles exist?
- How many new people completed account creation recently?
- Where are new users stopping during onboarding?
- Is the platform gaining activity or merely accumulating dormant profiles?
- Are new users reaching their first meaningful action?

This dashboard provides that visibility without creating a people directory,
cross-identity map, or surveillance surface.

## 2. Product decision

Build a restricted, read-only dashboard available only to the active production
profile `@shawnb` during the first release.

The dashboard is an operational instrument, not a social directory. It reports
aggregates by default. It must not provide a browseable list of every person who
joined, expose True Self/Alias relationships, or allow the owner to search for a
person by email, Humanity Credential, access key, IP address, or wallet.

If a friend wants the owner to find them, they should provide their public
`@handle`. Exact-handle support lookup can be considered later as a separate,
audited capability.

## 3. Authorization and scope

### 3.1 Initial access rule

Access requires all of the following:

1. The request is authenticated as the currently selected profile.
2. The selected profile has the permanent handle `@shawnb`.
3. That profile has an active `SupportOperator` grant with role `lead`.
4. The dashboard feature flag is enabled for the environment.

The display name `ShawnB` is not an authorization value. The other local
profile `@shawn` must not receive access merely because it has the same display
name or a support grant.

The implementation should authorize by profile id after resolving the handle,
and should fail closed if the profile is missing, inactive, or no longer has an
active lead grant.

### 3.2 Environment separation

Local, testnet/staging, and production authorization are separate database
states. A local `@shawnb` grant does not authorize the production profile.

The dashboard must show an unmistakable environment label such as:

- `LOCAL`
- `TESTNET / STAGING`
- `PRODUCTION`

It must never combine counts from different environments.

### 3.3 Read-only first release

The first release may not mutate users, profiles, onboarding state, balances,
moderation, wallet links, or analytics data. It has no delete, suspend, edit,
impersonate, credential-reset, or export-secret controls.

## 4. Dashboard layout

### 4.1 Header and trust boundary

The page should begin with:

- `Owner operations` or `Restricted operations` label;
- signed-in profile: `@shawnb · lead`;
- environment label;
- data freshness timestamp;
- a plain-language notice: “Aggregate operational data. No credentials,
  wallet secrets, or True Self/Alias links are shown.”

### 4.2 Current population cards

Display the current values and a short definition for:

| Metric | Definition |
|---|---|
| Verified humans | Count of `Human` records; the closest unique-person measure available in Phase A. |
| Active True Selves | Active profiles where `face = TRUE_SELF`. |
| Active Aliases | Active profiles where `face = ALIAS`. |
| Active identities | All active profiles; this can exceed verified-human count because a person may have an Alias. |
| Pending identities | Profiles awaiting activation, if any. |
| Active wallet-linked profiles | Profiles with a confirmed testnet wallet link; aggregate only. |
| Profiles with a first contribution | Profiles with at least one qualifying public contribution, defined by the implementation rail. |

Each card needs an information tooltip or “What this means” link. The
dashboard must not imply that active identity count equals unique people.

### 4.3 Growth over time

Provide selectable windows:

- last 7 days;
- last 30 days;
- last 90 days;
- all available history.

Show daily or weekly aggregate series for:

- new verified humans;
- new True Selves;
- new Aliases;
- onboarding completions;
- first meaningful actions;
- active identities observed in the period, if the activity definition is
  ratified.

The first implementation should use counts, not names. For registration timing,
use the existing ledger registration events and their timestamps rather than
inventing a precise profile-created timestamp where the schema does not expose
one.

### 4.4 Recent signup summary

Show a compact summary, not a directory:

- new verified humans in the last 24 hours, 7 days, and 30 days;
- new True Selves in the same windows;
- new Aliases in the same windows;
- percentage change from the previous equivalent window;
- most recent registration time, rounded to the dashboard's stated precision.

Do not show handles, display names, emails, credentials, wallet addresses, or
raw registration payloads in this section.

### 4.5 Onboarding conversion funnel

Display both counts and conversion percentages for the approved funnel:

1. Saw the account setup page;
2. Began verification;
3. Completed proof-of-humanity verification;
4. Registered a True Self;
5. Accepted the permanence and Constitution acknowledgments;
6. Completed the values seed;
7. Completed orientation;
8. Hatched an Alias, where applicable;
9. Made a first qualifying contribution.

For every stage, show:

- stage count;
- conversion from the immediately prior stage;
- conversion from the first stage;
- whether the value is an event count or a deduplicated cohort estimate;
- the measurement window.

The existing `/commons` funnel is explicitly event-based. The dashboard must
not label those values “unique users” unless a deduplicated cohort calculation
has been implemented and documented.

### 4.6 First-action health

New-user conversion is incomplete if people register but never reach a useful
action. Include aggregate counts for:

- completed onboarding;
- first public read or exploration event, if retained;
- first discussion post or reply;
- first poll participation;
- first social action;
- first wallet connection;
- first wallet-mode action, when enabled;
- first support/helpdesk interaction.

These must be grouped by coarse cohort period. Do not expose an individual
user's path.

### 4.7 Operational health panel

Include read-only indicators that help explain apparent growth problems:

- application version/build identifier;
- database migration/schema status;
- last successful maintenance sweep;
- helpdesk provider/model availability;
- current moderation stage and whether the S0 solo fallback is active;
- routine cases currently in the designated bootstrap operator's queue;
- open, awaiting-review, heavy/severe, Tribunal, and resolved case counts;
- eligible and willing moderator-pool counts against the handover threshold;
- a link to the moderation workbench, without exposing case evidence or identities;
- pending support-case count by severity, aggregate only;
- wallet/testnet provider status, when configured;
- last successful chain reconciliation, when wallet features are enabled.

Operational failures must be visually distinct from zero activity. “No data”
and “zero users” are not interchangeable.

When the S0 solo fallback is active, the designated operator receives a
time-sensitive, per-profile inbox notification when a routine case enters the
queue. The notification contains no post text, reporter, accused identity, or
private evidence; it links only to the moderation workbench. Heavy, severe,
Tribunal, and other cases outside the solo fallback are not presented as the
operator's work.

### 4.8 Privacy and safety summary

Display a permanent reminder:

- no Humanity Credentials or access keys are shown;
- no wallet seed phrases, private keys, or signing secrets are shown;
- no True Self/Alias linkage is shown;
- no private messages, support descriptions, moderation evidence, or IP data
  are shown;
- aggregate results may be suppressed when a cohort is too small to avoid
  making a person's activity obvious.

## 5. Exact-person lookup; deferred capability

The first release should not include a “who joined” table. A list would create
a high-value internal directory and would conflict with AgoraNet's existing
privacy commitments.

If owner feedback shows that exact friend confirmation is necessary, implement
a separate second-stage capability with all of the following:

- exact `@handle` input only;
- no partial name or email search;
- public-profile fields only;
- no identity relationship, Humanity, wallet, support, moderation, or login
  data;
- access reason captured in an operator audit event;
- rate limiting;
- no bulk export;
- no “recently joined” browse mode.

The owner should normally ask a friend for their handle rather than discover
them through a hidden member list.

## 6. Data sources and definitions

Use existing canonical sources where possible:

- `Human` for verified-human count;
- `Profile` for face, status, and active identity counts;
- registration ledger events for time-bucketed True Self/Alias registrations;
- approved analytics events and crushed aggregates for onboarding funnel data;
- `TestnetWalletLink` for wallet-linked aggregate counts;
- public contribution tables for first-action cohorts;
- support, moderation, and chain status services for operational indicators.

Do not reconstruct metrics from raw application logs, browser analytics, IP
addresses, or credentials.

Every metric must declare:

- source table/service;
- inclusion predicate;
- time zone and window;
- whether it is unique, deduplicated, or event-based;
- retention behavior;
- suppression rule, if applicable.

## 7. Small-cohort protection

The dashboard is restricted, but restricted access does not eliminate the risk
of identifying a friend from a tiny time bucket. Apply a configurable small-
cohort rule to detailed trend rows:

- default suppress threshold: fewer than 3 events in a bucket;
- show `suppressed for privacy` rather than `0`;
- allow the owner to view the aggregate total for a wider window;
- never allow repeated filters to reconstruct a suppressed bucket.

The threshold is testnet-configurable but must not be disabled silently in
production.

## 8. Audit and security requirements

Record only dashboard access metadata:

- authorized profile id;
- environment;
- route/action name;
- timestamp;
- aggregate view/filter used;
- result status.

Do not record raw dashboard payloads, secrets, private content, or a user's
identity path.

Required controls:

- server-side authorization on every request;
- no authorization based solely on client UI state;
- no data in public API responses;
- cache disabled or scoped to the authorized operator;
- no search-engine indexing;
- rate limiting;
- clear `403`/not-found behavior for all other profiles;
- tests proving `@shawn`, Jane, ordinary support agents, and signed-out users
  cannot access it.

## 9. Proposed route and implementation slices

### Slice 1; restricted aggregate dashboard

- route: `/support/operations/overview` or `/operations/overview`;
- server-side `@shawnb` + active lead check;
- environment and freshness header;
- population cards;
- recent signup counts;
- existing onboarding funnel with honest event-count labels;
- tests for authorization and metric definitions.

### Slice 2; growth and first-action reporting

- time-series windows;
- cohort conversion calculations;
- first-action metrics;
- small-cohort suppression;
- regression tests for deduplication and time boundaries.

### Slice 3; operational health

- maintenance, helpdesk, moderation, wallet, and chain health indicators;
- stale-data warnings;
- read-only incident context;
- no repair controls in the first release.

### Slice 4; exact-handle support lookup, only if approved

- exact handle only;
- public fields only;
- audit and rate limits;
- separate approval before implementation.

## 10. Acceptance criteria

The first release is complete when:

- `@shawnb` can open the dashboard in the intended environment;
- `@shawn` cannot open it, even with a lead grant;
- Jane and ordinary platform users cannot open it;
- signed-out requests do not receive data;
- production and testnet counts never mix;
- verified-human and active-identity counts are clearly distinguished;
- recent signup counts are reproducible from documented sources;
- onboarding conversion labels identify event counts versus unique estimates;
- small cohorts are suppressed rather than exposed as identifiable counts;
- no credentials, wallet secrets, private messages, or identity links appear;
- `db:verify`, focused dashboard tests, typecheck, and production build pass.

## 11. Recommended first implementation decision

Implement Slices 1 and the authorization tests first. Do not add a member list
yet. The owner will be able to answer “are people joining and where are they
stopping?” without turning the dashboard into a private surveillance directory.
