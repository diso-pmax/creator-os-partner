# Creator-OS Partner Integration — Start Here

**Version 1.0 · 2026-08-25**

> This is a specification, not a proposal. The platform defines the contract; the integrating partner
> implements it. There is no back-and-forth required to start building.
>
> This document set is written for **an engineer who has never seen Creator-OS source code, issue
> tracker, or internal design discussion**. Anywhere you have to guess is a bug in the documentation —
> report it and we will fix it.

This page is the entry point. Read it first, then follow the links below for the channel you need.

*(A Vietnamese translation of this entire set is available at [../vi/](../vi/README.md). This English
version is the source of truth — if the two ever disagree, this one wins.)*

---

## What this integration does

Creator-OS turns real-world activity from your system — completed orders, cancellations, in-app
actions — into rewards for your users: points, entitlements, unlocked content. To make that work, two
independent channels connect your system to ours:

| Channel | Answers the question | Document |
|---|---|---|
| **EVENT** | "What did the user just do?" | [event-ingestion.md](./event-ingestion.md) |
| **LAUNCH** *(Campaign Launch)* | "Who just opened the app, for which campaign?" | [campaign-launch.md](./campaign-launch.md) |

Both channels use the same `accessKey`. You keep one `masterSecret` and derive an isolated key for each
channel with [`IntegrationCredentialDerivationV1`](./credential-derivation.md).

---

## What Creator-OS provides you

- **One Access Key** (`accessKey`) — shared across all channels, case-insensitive.
- **One Master Secret** (`masterSecret`) — displayed once. You derive separate channel keys from it:
  1. **EVENT** Secret Key — we use it to verify the signature on events you send.
  2. **LAUNCH** Secret Key — we use it to verify the signature on Campaign Launch requests you send (see [campaign-launch.md](./campaign-launch.md)).
  3. **RECOVERY** Secret Key *(only if you build a recovery endpoint)* — **we** use it to sign requests when we call you.
- A sandbox environment and a self-service conformance test suite.
- An event source code — maps the `type` you send to our internal system.

## What you provide Creator-OS

- A server capable of computing HMAC-SHA256 signatures (used on every channel, each with its own secret).
- **EVENT channel**: business events from your system (orders, UI actions) via `POST /api/v1/integrations/events`, called **from your server**.
- **LAUNCH channel**: a request to bootstrap a session for an already-known user, via `POST /api/v1/campaigns/:campaignId/launch`, called **from your server** — see [campaign-launch.md](./campaign-launch.md).
- *(optional)* A recovery endpoint on your side — so we can ask you what you sent when we need to reconcile or backfill.

---

## ⭐ Required order: LAUNCH before EVENT

**The two current channels are not interchangeable options — read this before deciding to integrate
only one.**

🔴 **LAUNCH establishes the user's Creator-OS session. EVENT reports the user's activity. Both are
required for partner-reported activity to produce a reward** — LAUNCH is a prerequisite, not an
alternative to EVENT. An event only produces a reward for a user if that user **already has at least one
established session** through the LAUNCH channel — once is enough, it does not need to repeat every
session. (Other conditions — an active campaign window, a sufficient `confidence` level — also apply;
see [event-ingestion.md](./event-ingestion.md).)

Sending an event for a user who has **never** gone through LAUNCH: we still return `200`, we still
**receive and store** the event verbatim — but it **never produces a reward, not even retroactively**
(there is no "catch-up" mechanism for a late session). And today **there is no warning or error code**
telling you this happened — the API call looks exactly as successful as one that did produce a reward.

⇒ Integrating **EVENT only, with no LAUNCH at all**, is only useful for **raw data logging /
reconciliation**. It does **not** reward real users. If your goal is for users to actually receive
points or entitlements, you **must** integrate both channels.

🔴 **`externalUserId` MUST be the exact same value — same format, same case — on both the EVENT channel
and the LAUNCH channel, for the same user.** This is the single most time-consuming bug in this entire
integration: any mismatch — even a casing difference or an added prefix — means the session establishes
normally but the user **never receives a reward**, and **no error fires** to reveal it. Use exactly one
internal variable to produce both values; do not let two teams (login vs. orders) mint separate IDs for
the same person.

---

## Identifier semantics — one table, four identifiers

This integration uses four distinct identifiers. Confusing any two of them is the most common source of
integration bugs. Each row is defined once here; the channel documents link back to this table instead
of repeating it.

| Identifier | Channel | Generated by | Scope | Retry / reuse behavior |
|---|---|---|---|---|
| `eventId` | EVENT | **you** | one business event | retry MUST reuse the **same** id |
| `deliveryId` | EVENT | **us** | one delivery attempt | a new one **may** be issued per attempt |
| `externalUserId` | EVENT + LAUNCH | **you** | one user, shared across both channels | MUST be the exact same value on both channels for the same user (§ above) |
| `launchCode` | LAUNCH | **us** | one launch attempt | single-use, issued at step 1, 60-second lifetime — see [campaign-launch.md](./campaign-launch.md#6-launch-grant--security-invariants-frozen-do-not-implement-around-them) |

⚠️ **`eventId` and `launchCode` have opposite retry rules.** `eventId` identifies a business event —
resending it with the same value is safe and expected. `launchCode` identifies one launch attempt — it
is consumed on first use and cannot be reused; call step 1 again for a new one. Do not apply one
channel's retry logic to the other.

---

## Integration checklist

```text
[ ] Implement EVENT sender (HMAC-SHA256 signing, POST /api/v1/integrations/events)
[ ] Implement LAUNCH (two-step flow, POST /api/v1/campaigns/:campaignId/launch + GET /api/v1/launch)
[ ] Use the SAME externalUserId value for the same user on both channels
[ ] Implement RECOVERY endpoint (OPTIONAL — see recovery.md)
[ ] Handle 2xx (200 = accepted, including duplicates)
[ ] Handle 4xx (400/401/403/404/409/422 — see error-codes.md)
[ ] Handle 429 (read Retry-After, back off)
[ ] Handle 5xx (retry with backoff)
[ ] Preserve eventId across retries of the same business event
[ ] Verify deduplication works (send the same eventId twice, confirm the second is deduplicated)
[ ] Run the conformance test suite against sandbox (testing.md)
[ ] Pass the inbound conformance cases (7/7 — this is a go-live gate)
[ ] Complete the production checklist (testing.md)
```

---

## Document map

| Document | Covers |
|---|---|
| [event-ingestion.md](./event-ingestion.md) | EVENT channel: authentication, request schema, responses, retry, rate limits |
| [campaign-launch.md](./campaign-launch.md) | LAUNCH channel: two-step flow, Launch Grant invariants, session |
| [recovery.md](./recovery.md) | Optional reconciliation and backfill capability |
| [error-codes.md](./error-codes.md) | Consolidated error reference across all channels |
| [testing.md](./testing.md) | Conformance test suite + production checklist |
| [credential-derivation.md](./credential-derivation.md) | HKDF contract, versions, test vectors, and rotation |
| [changelog.md](./changelog.md) | Version history |

The documents above are the **generic contract** — they apply to any partner, including **MSHT**, which
builds exactly the default shape described here with no partner-specific customization.

---

## Notation

| | |
|---|---|
| ⚠️ | Common mistake — read carefully |
| 🔴 | More severe than ⚠️ — getting this wrong usually **fails silently**, with no error to alert you |
| 🔒 | Security-relevant |
| ⭐ | Time-saving tip |
| **MUST / MUST NOT** | Normative requirement — not optional |
| **MAY / OPTIONAL** | Your choice — no penalty either way |

Timestamp conventions **can differ per field within a document** (e.g. ISO-8601 for a business
timestamp like `occurredAt` vs. Unix seconds for a signing `X-Timestamp` header) — see the top of each
document, do not assume they match.

---

## Contact and changes

Anywhere you have to guess is a bug in this documentation — report it and we will fix it and publish a
new version. See [changelog.md](./changelog.md) for version history.
