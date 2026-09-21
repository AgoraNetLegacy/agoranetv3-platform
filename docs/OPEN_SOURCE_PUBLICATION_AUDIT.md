# Open-Source Publication Audit

**Prepared:** 2026-09-21

## Purpose and scope

This is a practical release-readiness audit for making the AgoraNet source
repository public. It records repository evidence and release decisions. It is
not a legal opinion, a penetration test, or a guarantee that the software is
safe for real-money use.

## Verified

### Repository hygiene

- `main` contains the AGPL-3.0 license, contribution guidance, code of conduct,
  governance model, security reporting policy, name-and-mark policy, issue
  forms, and a pull-request template.
- `package.json` identifies the project as `AGPL-3.0-only` and links to its
  canonical GitHub repository while retaining `private: true` to prevent
  accidental npm publication.
- The CI workflow runs on `main` pushes and pull requests. Its required job is
  named `check`.
- Current `main` is clean and synchronized with its remote.

### Secrets and local data

- Review of all reachable Git history found no private-key blocks or common
  cloud, GitHub, Google, or OpenAI token patterns.
- Reachable Git history contains `.env.example`, but not `.env`, `.env.local`,
  database dumps, or database files.
- Local `.env`, `.env.local`, and database-backup files exist only as ignored
  working-tree material. They must remain untracked.
- The repository documents variable names for Cardano and other operations.
  Variable names and public testnet identifiers are not credentials; the
  corresponding values must never be committed, pasted into issues, or included
  in screenshots.

### Dependency licensing

- Production dependency metadata is predominantly MIT, Apache-2.0, BSD, ISC,
  MPL-2.0, or similarly permissive licenses.
- Sharp's platform-specific libvips package is LGPL-3.0-or-later. It is a
  third-party runtime component; this finding does not change AgoraNet's own
  AGPL-3.0 licensing, but future distribution changes should re-check the
  dependency's notices and terms.
- `caniuse-lite` is CC-BY-4.0 and its package license notice remains available
  in the installed dependency. The project must not remove third-party license
  notices from redistributed dependencies.

## Items deliberately public

The source includes testnet, deployment, and operational documentation. It
mentions public testnet transaction references, contract addresses, provider
names, and production/staging hostnames. These are intentional project facts,
not secrets. Before each release, maintainers should ensure that the stated
status and links remain accurate.

## Release blockers and owner decisions

### 1. Remote draft branch

`origin/claude/chat-session-wfniah` is not merged into `main`. It contains
founder materials, draft agent specifications, and PDF documents that are not
part of the public release. A public repository exposes all remote branches.

**Required decision:** keep that material in a separate private repository or
archive, then delete the remote branch before the repository becomes public.
Do not treat the absence of token-pattern findings as permission to publish
private writing.

### 2. Brand ownership and provenance

The committed AgoraNet, PollCoin, and Gratium visual assets have Git history
attributed to the project maintainer. No separate source or license ledger for
those assets currently exists.

**Required decision:** the project owner must confirm they created the assets
or have permission to publish them under the repository's public project use.
If an asset came from a third party, record its source and license or replace
it before publication.

### 3. Organization and repository home

The name `AgoraNet` is already taken on GitHub. `AgoraNetCivic`,
`AgoraNetProject`, and `AgoraNetCommons` were available when checked on
2026-09-21.

**Recommendation:** create a dedicated organization before public release,
choose an available distinct name, and transfer the repository only after
checking Vercel, Railway, and any deployment integrations. An organization
allows multiple maintainers and avoids making a personal account the permanent
project boundary.

### 4. Manual product checks

Automated image-processing tests pass, but a maintainer has not yet recorded a
complete production confirmation that a user can upload, refresh, and view both
a profile image and a Chamber cover. Keep this as a visible testing issue until
it is manually confirmed.

## Public-release sequence

1. Resolve the draft-branch decision and confirm brand-asset rights.
2. Create the chosen GitHub organization and verify deployment integrations.
3. Transfer the repository if desired, then update external links if GitHub
   does not preserve them by redirect.
4. Make the repository public.
5. Configure protected `main` with required CI job `check`, require pull
   requests before merging, and restrict direct pushes to maintainers.
6. Enable repository security alerts and Dependabot where GitHub makes them
   available.
7. Create the initial contributor issues and label them, including the
   end-to-end image-upload verification issue.
8. Invite maintainers and contributors according to `GOVERNANCE.md`.

## Continuing responsibilities

- Treat a public codebase as a reason for fast patching and review, not as a
  reason to conceal defects.
- Keep secrets in deployment configuration, rotate anything that may have been
  exposed, and never use real production data in fixtures or examples.
- Keep security reports private under `SECURITY.md` and publish fixes with
  clear release notes after affected users are protected.
- Re-run dependency, history, and asset-provenance checks before major public
  releases.
