# Dependency security triage

**Last reviewed:** 2026-09-21

This document records known dependency-advisory decisions. It is not a claim
that the project is free of security defects. New findings should be reported
privately under [SECURITY.md](../SECURITY.md).

## Resolved in this review

| Dependency | Action | Verification |
| --- | --- | --- |
| Next.js | Updated from 15.5.19 to 15.5.25 to clear the critical Server Actions advisory. | Full test suite and production build passed. |
| Sharp | Updated from 0.34.5 to 0.35.4 to clear libvips/libheif high advisories affecting untrusted image processing. | Image and Chamber suites, full suite, and production build passed. |
| nanoid | Pinned transitively to 3.3.18 through npm overrides to clear its high advisories. | Chain, hardening, and wallet-mode suites passed. |

## Open upstream advisory: `ip-address`

`ip-address` remains present only through the Mesh/Cardano SDK dependency tree.
The current Mesh release still depends on Cardano SDK packages that request a
vulnerable `ip-address` range. The audit's automatic remedy would move Mesh to
a materially different release line, so it has not been applied without a
dedicated wallet-compatibility review.

### Reachability assessment

The affected Cardano SDK code is the stake-pool relay IP serialization helper
(`PoolParams/Relay/ipUtils`). AgoraNet does not import or invoke that helper.
AgoraNet's chain integration uses Cardano address serialization and fixed,
operator-configured Blockfrost HTTPS endpoints; it does not pass user-supplied
IP addresses or relay destinations to the affected library.

This limits the present application exposure, but does not remove the
dependency finding. Before adding stake-pool relay support, accepting
user-configured chain endpoints, upgrading Mesh, or publishing a release that
claims all dependency advisories are cleared, maintainers must re-evaluate the
Cardano/Mesh upgrade path and rerun the wallet and chain test suites.

## Remaining moderate findings

The dependency audit still reports moderate transitive advisories. They remain
in the release-readiness queue and should be triaged by reachability and
upgrade safety, not cleared with a blind forced update.
