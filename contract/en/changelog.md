# Changelog

## 1.3.2 — 2026-08-29

`event-ingestion.md` §5.3 said `UI_ACTION` had an **open payload shape**. That was wrong: the gateway
has always required `actionKey` for `UI_ACTION` and rejects the event without it. **No protocol
change, documentation only** — but if you built against the old text, check your `UI_ACTION` payload.

- `event-ingestion.md` §5.3 — `actionKey` is documented as **REQUIRED** for `UI_ACTION`, with the
  concrete value to send. It is **case-sensitive and compared as a raw string**: the wrong case still
  returns `200`, and the entitlement is silently never counted.
- **`BRAND_CLICK`** — the `actionKey` for "user clicks a brand in Cashback Shopping". We define these
  values; you send them verbatim.
- `error-codes.md` — added `payload_field_missing` to the `422` business-code table. It was reachable
  from the gateway but listed nowhere.

## 1.3.1 — 2026-08-27

1.3 announced the `masterSecret` model in `README` and `changelog`, but the **two documents you
actually implement from** still showed a standalone per-channel secret (`whsec_…`) and never linked
to [credential-derivation.md](./credential-derivation.md). This release fixes exactly that — **no
protocol change, documentation only**.

- `event-ingestion.md` · `campaign-launch.md` — examples now **derive the channel key from
  `masterSecret`**, in both `bash` and `node`. All standalone-secret examples removed.
- `campaign-launch.md` §2 — states plainly: **we do NOT issue a separate "LAUNCH Secret Key."** The
  LAUNCH key differs from the EVENT key because the `info` string differs, not because two secrets
  are sent.
- `credential-derivation.md` — added a **10-second vector check**, a per-channel derive snippet, and
  a table of **four common integration mistakes** *(decoding `channelKey`, confusing base64 with
  base64url, lowercasing `CHANNEL`, mistyping `I`/`l`/`1`)*. All four produce the **same `401`**.
- `README.md` — corrected "each with its own secret" to "each channel has its own key, but **you
  derive them**", and made explicit that we tell you the host for your environment at handover.
- `testing.md` + conformance runner — accepts **`CONF_MASTER_SECRET`** and derives every channel key
  from it. Added `CONF_*_VERSION` *(default `1`)*. Standalone `CONF_*_SECRET` still accepted for
  integrations not yet re-issued, and **wins** when set explicitly. The runner now **prints the
  source of each key** on its first line — that line rules out two causes a `401` cannot.

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
