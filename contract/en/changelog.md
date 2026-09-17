# Changelog

Sections are named after the **product release** that carries them — the same tag your installation's
image carries, for example `v1.0.3`. Find the tag your installation runs and read its section here; when
you upgrade, read every section between your release and the one you move to. From `v1.0.7` on, this
repository also carries a tag with the same name. No lookup table.

An entry that describes **gateway behavior** sits under the first release that **has that behavior** —
behavior can ship before its documentation does. An entry that only corrects the documentation sits
under the first release that carries the corrected text. A release with **no section here did not change
the contract**: it carries the same contract as the section directly below it. Contract changes that are
not in any release yet sit under **Unreleased**.

Each entry keeps its earlier contract number *(`1.0` … `1.6.0`)* as its own sub-heading, so a citation
such as "contract 1.4.0" still leads here.

| Marker | Meaning | What we do |
|---|---|---|
| 🔴 **BREAKING** | a running installation can break | announce ahead, with time to switch |
| 🟡 **CHANGED MEANING** | no code breaks, but an answer changes | announce ahead |
| 🟢 **ADDITIVE** | purely added; running code needs no change | release right away |

## Unreleased

No changes.

## v1.1.0 — 2026-09-14

🟡 **Recovery endpoints must now be public HTTPS.** `http://` addresses, and loopback, private, or
link-local hosts, are refused. Details: [recovery.md](./recovery.md).

🟢 **Conformance suite: one new case, one clarification.** New case `IN-8` checks that an order event
with a blank `brandCode` is rejected — this matches gateway behavior already in place, so nothing to
change on your side. Also clarified: `ORDER_CANCELLED` must carry the same `orderId` as the order it
cancels. Details: [testing.md §1.3](./testing.md#13-fifteen-cases--two-directions-measure-two-different-things) ·
[event-ingestion.md §5.3](./event-ingestion.md#53-payload--by-type).

🔴 **Two new rewards for orders at sponsor brands.** One rewards a player's first order at a sponsor
brand; the other rewards orders spread across several different sponsor brands. Both read the `brandCode`
field on `ORDER_*` events — if your campaigns use sponsor brands, make sure you're sending it. Details:
[event-ingestion.md §5.3](./event-ingestion.md#53-payload--by-type).

## v1.0.7 — 2026-09-11

### Contract versions now follow product releases

🟡 **The contract no longer has version numbers of its own.** Each section of this changelog is now named
after the product release that carries it — the same tag your installation's image carries.

- The earlier numbers `1.0` … `1.6.0` stay as sub-headings, unchanged, so existing citations still lead
  here. From now on, cite the release tag.
- A release with no section here did not change the contract.
- **This repository starts at `v1.0.7`.** Earlier releases have no tag here — their sections below record
  what each one carried. The earlier `v1.0.0` tag of this repository no longer exists; if you pinned it,
  pin a release tag instead.

No protocol, field, endpoint, or signature scheme changes with this entry.

## v1.0.6 — includes 1.6.0

### 1.6.0 — 2026-09-11

🔴 **`brandCode` on `ORDER_*` events — which sponsor brand an order belongs to.**

Some campaigns count only orders at the campaign's own list of sponsor brands. An order is counted for such
a reward only if its `brandCode` **exactly matches** *(case-sensitive, raw string)* one of the campaign's
configured brand codes — we define them *(e.g. `SHOPEE`, `LAZADA`)*, you send that exact string.

⚠️ **This entry documents an existing requirement, not a new gateway check.** `brandCode` is **optional
at the door** — an order without it is still valid and still returns `200`, it just cannot be counted for
a brand-scoped reward, and no error is raised. If any of your campaigns reward orders at specific sponsor
brands, start sending `brandCode` now — repeat it on **every** event of the order, including
`ORDER_CANCELLED`, which is the safe rule for all of them.

⚠️ **For a brand-scoped reward this is required, not just safe:** an `ORDER_CANCELLED` without
`brandCode` is not matched to the reward, so what the order earned is **not reversed**.

- `event-ingestion.md` [§5.3](./event-ingestion.md#53-payload--by-type) — `brandCode` added to the
  `ORDER_*` payload: the exact-match rule, that it is optional at the door but silently uncounted when
  wrong or absent, and the "send it on every beat" rule for cancellations.
- **The one exception to "no error is raised":** a `brandCode` that is **present but empty, blank, or
  not a string** is rejected with `422 payload_field_missing`. Omitting it is fine; sending a broken one
  is not.

## v1.0.3 — includes 1.4.0

### 1.4.0 — 2026-09-06

🔴 **`actionKey` VALUE CHANGED — breaking, both sides must switch together.**

The `actionKey` for *"user clicks a brand in Cashback Shopping"* changes from **`BRAND_CLICK`** to
**`brand`**.

- `event-ingestion.md` §5.3 — payload example and the action-code table now read `brand`.
- Still **case-sensitive, compared as a raw string**: `brand` ≠ `Brand` ≠ `BRAND`.

⚠️ **Why we call this breaking.** Sending the old value after the switch still returns **`200`** — the
envelope is well-formed so it is accepted, but it **counts for nobody**. No `422`, no warning,
**nobody earns points**. So your integration and the campaign configuration must switch **at the same
moment**, and you verify by clicking a brand and reading the wallet — not by watching for an error code.

📌 **Upgrading an installation to `v1.0.3` does not change which value counts.** The `actionKey` that
counts is set in the campaign configuration, not built into the release. It changes when the campaign
is reconfigured — switch your side at that moment, not when the installation is upgraded.

📌 Entry 1.3.2 announced `BRAND_CLICK`; that entry **stays** as a historical record.

## v1.0.2 — includes 1.5.0

### 1.5.0 — 2026-09-06

🔴 **`occurredAt` now has two deadlines. Missing either is a `422`.**

| Code | When | Default limit |
|---|---|:--:|
| `event_too_late` | `occurredAt` is **older** than your lateness limit | **30 days** |
| `event_from_future` | `occurredAt` is **ahead of our clock** by more than your skew limit | **300 seconds** |

⚠️ **This entry is the documentation catching up, not an announcement ahead of the change.** The
gateway already enforces both limits. Check your timestamps now rather than at your next release — and
if your integration backfills history, check it **before** its next run.

- `event-ingestion.md` [§5.4](./event-ingestion.md#54-occurredat--the-two-deadlines) — new section:
  both limits, the boundary *(exactly at the limit is accepted)*, the per-integration override, and why
  `event_from_future` must be fixed at your clock instead of by widening the limit.
- `error-codes.md` — both codes added to the `422` business table, with the one property that
  separates them from every other code there: **a resend can escape them.**
- `testing.md` §4.1 — two checklist items: know your two limits, and never answer a `422` by minting a
  new `eventId`.

⭐ **Nothing changes for a retry of an event we already accepted.** The deadlines apply only to events
that are new to us, so a queue draining after a week-long outage still returns `200 deduplicated:
true`. If you already treat `422` as "do not retry, do not re-mint", you have nothing to change.

📌 We did not have a per-partner limit before, so the defaults above are what you get until we set
yours. Tell us your worst-case delivery lag and we will set it — that is the number this contract
should be built around, not a guess.

## v1.0.1-release-05-09-26

### Campaign state and period decide whether an accepted event counts — 2026-09-04

🟡 **Nothing changes at the door, but an accepted event may no longer count.** The event is still
accepted with `200`, and no new error code is returned. It is simply **not counted** when the campaign is:

- paused, archived, not yet open, or past its closing deadline;
- for a campaign that enforces its eligibility period — outside that period.

After a campaign ends, it keeps counting events for a grace period — but only events whose `occurredAt`
falls **inside the campaign period**, and only if we **process them before the grace deadline**. An
order that happened after the campaign period ended never counts, however soon you send it. Send late
events as early as you can, not close to the deadline: the deadline is checked when we process the
event, after we have answered `200`, not when it reaches the door.

Cancellations are exempt: an `ORDER_CANCELLED` still reverses what its order earned, even after the
campaign has closed.

The contract did not say this before this release. Verify by reading the wallet, not by watching for an
error code — the same rule as for `actionKey` and `brandCode`.

## v1.0.0-demo — includes 1.0 · 1.1 · 1.2 · 1.3 · 1.3.1 · 1.3.2

### 1.3.2 — 2026-08-29

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

### 1.3.1 — 2026-08-27

1.3 announced the `masterSecret` model in `README` and `changelog`, but the **two documents you
actually implement from** still showed a standalone per-channel secret (`whsec_…`) and never linked
to [credential-derivation.md](./credential-derivation.md). This entry fixes exactly that — **no
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

### 1.3 — 2026-08-26

- Partners now keep one `masterSecret` and derive isolated channel keys through
  [`IntegrationCredentialDerivationV1`](./credential-derivation.md).
- Per-channel rotation explicitly publishes the new version; old and new versions overlap until revoke.
- Added a machine-readable HKDF test vector shared with the Creator-OS backend tests.

### 1.2 — 2026-08-25

**AUTH channel removed.** No partner ever integrated it in production, so this carries zero migration
cost. `identity-transfer.md` is deleted; every cross-reference to it across this document set has been
removed or reworded to describe LAUNCH instead.

- [README.md](./README.md), [error-codes.md](./error-codes.md), [testing.md](./testing.md),
  [event-ingestion.md](./event-ingestion.md) — all AUTH-specific sections, checklist items, and
  identifier rows removed.
- The Access Key now pairs with **three** Secret Keys (EVENT, LAUNCH, RECOVERY), not four.
- `IdentityHandoffSignatureV1` no longer exists as a live scheme — see `1.1` below for the historical
  record of when AUTH was still active.

### 1.1 — 2026-08-25

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

### 1.0 — 2026-08-25

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
