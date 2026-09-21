# Contributing to AgoraNet

Thank you for considering a contribution. AgoraNet is an experimental civic
social platform. We are building it in public so its technical and governance
foundations can be examined, challenged, and improved together.

## Before you begin

- Read the [README](README.md), [governance model](GOVERNANCE.md), and
  [security policy](SECURITY.md).
- Treat all chain and currency features as **testnet or internal-demo work**
  unless a document explicitly says otherwise. Do not send real funds, publish
  secrets, or use a production database in a contribution.
- Use an issue or discussion to propose material changes before investing in a
  large pull request. Small fixes, documentation corrections, and tests may be
  submitted directly.

## Local setup

```bash
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm test
```

The example environment file contains names and placeholders only. Never add
real credentials, access keys, seed phrases, database exports, backups, or
production data to the repository, issues, pull requests, or test fixtures.

## Pull requests

1. Create a focused branch from `main`.
2. Keep one concern per pull request and explain both the user-facing effect
   and any privacy, security, or governance consequences.
3. Add or update tests when behavior changes.
4. Run `npm test`, `npx tsc --noEmit`, and `npm run build` before requesting
   review when practical.
5. Do not merge your own pull request. A maintainer reviews all changes to
   protected areas and release branches.

Contributions must be your own work, or work you have the right to submit. By
submitting a contribution, you agree that it is licensed under the repository's
[GNU Affero General Public License v3.0](LICENSE).

## Areas needing extra care

Please request discussion before changing these areas:

- identity, privacy, Alias unlinkability, and authentication;
- ledger, permanence, moderation, economic, and wallet rules;
- production operations, deployment, backups, and access controls;
- the Constitution or rules presented to platform participants.

Security vulnerabilities must be reported privately under
[SECURITY.md](SECURITY.md), not opened as public issues.

## Conduct

All participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
