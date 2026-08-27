# Changelog

## 1.3 — 2026-08-26

- Partners now keep one `masterSecret` and derive isolated channel keys through
  [`IntegrationCredentialDerivationV1`](./credential-derivation.md).
- Per-channel rotation explicitly publishes the new version; old and new versions overlap until revoke.
- Added a machine-readable HKDF test vector shared with the Creator-OS backend tests.

## 1.2 — 2026-08-25

**AUTH channel removed.** No partner ever integrated it in production, so this carries zero migration
cost. `identity-transfer.md` is deleted; every cross-reference to it across this document set has been
removed or reworded to describe LAUNCH instead.

- [README.md](./README.md), [error-codes.md](./error-codes.md), [testing.md](./testing.md),
  [event-ingestion.md](./event-ingestion.md) — all AUTH-specific sections, checklist items, and
  identifier rows removed.
- The Access Key now pairs with **three** Secret Keys (EVENT, LAUNCH, RECOVERY), not four.
- `IdentityHandoffSignatureV1` no longer exists as a live scheme — see `1.1` below for the historical
  record of when AUTH was still active.

## 1.1 — 2026-08-25

**New channel: LAUNCH (Campaign Launch)** — see [campaign-launch.md](./campaign-launch.md). This is a
genuine contract change, not a restructuring: a new channel, a fourth Secret Key, two new endpoints
(`POST /api/v1/campaigns/:campaignId/launch`, `GET /api/v1/launch`).

- **AUTH is now deprecated.** `identity-transfer.md` carried a deprecation notice at the top. Existing
  AUTH integrations continued to work unchanged; new integrations were told to build against LAUNCH
  instead. *(AUTH was removed entirely in `1.2` — this document no longer exists.)*
- [README.md](./README.md) — channel table, required-order section, and identifier semantics table
  updated to describe LAUNCH as the current identity/session channel.
- [error-codes.md](./error-codes.md) — LAUNCH channel error reference added.
- LAUNCH reuses the EVENT channel's signing scheme (`EventIngressSignatureV1`) with its own secret — it
  does **not** introduce a new authentication protocol.

## 1.0 — 2026-08-25

Initial release of the English, developer-facing contract documentation set:

- [README.md](./README.md) — entry point, required-order rule between channels
- [event-ingestion.md](./event-ingestion.md) — EVENT channel contract
- `identity-transfer.md` — AUTH channel contract *(removed in `1.2`; this document no longer exists)*
- [recovery.md](./recovery.md) — optional reconciliation/backfill/replay capability
- [error-codes.md](./error-codes.md) — consolidated error reference
- [testing.md](./testing.md) — conformance suite, test vectors, key rotation, production checklist

This set supersedes the previous Vietnamese documents (`hop-dong-tich-hop-su-kien.md`,
`hop-dong-ban-giao-danh-tinh.md`). No protocol, endpoint, field, or signature scheme changed — this is a
documentation restructuring, not a contract change. Frozen behavior carries over unchanged: the HTTP
status table, the meaning of `200`, `eventId`-based deduplication, and the three named signature
schemes (`EventIngressSignatureV1`, `IdentityHandoffSignatureV1`, `PartnerRecoverySignatureV1`).

Breaking changes to the underlying contract will be announced here before taking effect.
