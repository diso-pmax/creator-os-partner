# Error Code Reference

**Version 1.0 · 2026-08-25** · Start here: [README.md](./README.md).

Consolidated reference across all channels. Each channel document links here; this page is the single
source of truth — if a channel document and this page ever disagree, this page is a bug report waiting
to happen, please report it.

## General HTTP semantics

Every status code below means **exactly one thing**, consistently, across every endpoint in this
integration. You are never required to guess whether a `200` is "real success" or "success but ignore
it" — read the channel-specific note where one exists.

| Status | Meaning | Partner action |
|:--:|---|---|
| `200` | Accepted / already-processed duplicate | stop retrying |
| `400` | Malformed request — wrong shape, broken JSON, invalid parameters | fix the request, then resend |
| `401` | Authentication failed — bad key, bad signature, or expired timestamp | check credentials and clock, then resend |
| `403` | Authenticated, but not authorized for this action/resource | fix configuration, or contact us |
| `404` | Route does not exist | fix the URL |
| `409` | Conflict — a replay of an identifier that must be unique per-attempt | mint a new identifier and retry |
| `422` | Correct shape, wrong business meaning | **do not blindly retry** — read the `code` field |
| `429` | Rate limited | read `Retry-After`, wait, then resend |
| `502` | We could not complete a downstream step | contact us |
| `503` | Configuration error on our side | contact us |
| `5xx` (other) | Platform failure | retry with backoff |

## Response body shapes

🔴 **There is no single error body shape shared by every status code.** The shape depends on **which
layer** rejected the request. Do not write one parser assuming `code` and `details` are always present.

**Business errors (`422`, most `409`s) — the shape you should design your parsing around:**

```jsonc
{
  "code": "event_id_conflict",
  "title": "event_id_conflict",
  "status": 422,
  "detail": "human-readable explanation",
  "details": { "deliveryId": "del_01J…", "...": "error-specific fields" }
}
```

`code` is the stable machine-readable identifier (matches the tables below). `details` (plural) is a
nested object carrying error-specific data. `deliveryId` inside `details` **MAY be absent** — it is
omitted whenever our delivery-tracking write did not complete in time, independent of which `code` was
raised; do not treat its absence as itself an error.

**Authentication failures (`401`) — a different, simpler shape, with NO `code` field:**

```jsonc
{ "statusCode": 401, "message": "human-readable explanation", "error": "Unauthorized" }
```

⚠️ Do not look for `code` or `details` on a `401` — they are not there. A `401` always means the same
three possible causes (bad key, bad signature, expired timestamp) regardless of channel; the `message`
text does not enumerate which one.

**Request validation failures (`400`) — a third shape, using `errors` (plural), NOT `details`:**

```jsonc
{
  "status": 400,
  "title": "validation_error",
  "code": "validation_error",
  "detail": "specversion: Invalid enum value. Expected '1.0', received 'banana'",
  "errors": { "specversion": ["Invalid enum value. Expected '1.0', received 'banana'"] }
}
```

⚠️ **This field is `errors`, plural, not `details`.** The two are not interchangeable and appear on
different status codes — a parser that only checks `details` will silently miss `400` validation
feedback.

## EVENT channel — `POST /api/v1/integrations/events`

Full context: [event-ingestion.md](./event-ingestion.md).

| Status | When | `deliveryId`? |
|:--:|---|:--:|
| `200` | received and durably stored — **including duplicates** | ✅ |
| `400` | malformed envelope: broken JSON, an **invalid** `specversion` value, or a missing **required** envelope field — omitting `specversion` itself is fine, see [event-ingestion.md §5](./event-ingestion.md#5-request-schema) | ✗ |
| `401` | bad key, bad signature, or expired timestamp — one message covers all three | ✗ |
| `404` | route does not exist | ✗ |
| `422` | correct shape, wrong business meaning — see business codes below | MAY be present (in `details`) |
| `429` | rate limited | — |

### `422` business codes

| You sent | Code | You do |
|---|---|---|
| a `type` outside the closed catalog (e.g. `order`, `order.v2.created`) | `unknown_event_type` | change the value — the error lists the valid values |
| `type: STREAK_REACHED` | `derived_event_not_accepted` | stop sending it — we derive this ourselves |
| a valid `type` not yet registered for your key | `event_type_not_registered` | contact us — this is a configuration gap on our side, your payload is correct |
| an `eventId` already used for a **different** `type` | `event_id_conflict` | mint a new id for this attempt |
| `type: UI_ACTION` with `payload` missing `actionKey` | `payload_field_missing` | add `actionKey` — the error names the missing field |
| an order type with `payload` missing `orderId`, or carrying `amountMinor` without `currency` | `payload_field_missing` | add the field the error names |

⚠️ **`400` and `422` mean different things — do not conflate them.** `400` means "malformed, fix the
shape and resend"; `422` means "well-formed, wrong meaning — read `code` to know which side must act."
Treating a `422` as a `400` sends you fixing a shape that was never broken, and you never find the real
cause.

## LAUNCH channel — `POST /api/v1/campaigns/:campaignId/launch`

Full context: [campaign-launch.md](./campaign-launch.md). This is the **current** identity/session
channel — see [README.md § Required order](./README.md#-required-order-launch-before-event).

| Status | When | `code`? |
|:--:|---|:--:|
| `200` | Launch Grant created | — (returns `launchUrl`/`expiresAt`, not a `code` field) |
| `401` | bad key, bad signature, or expired timestamp — same shape as every other channel's `401` (no `code` field) | ✗ |
| `404` | `CAMPAIGN_NOT_FOUND` — campaign does not exist, **or** belongs to a different tenant than your integration (intentionally indistinguishable, same reasoning as every other cross-tenant case in this integration) | ✅ |
| `422` | `CAMPAIGN_NOT_LAUNCHABLE` — campaign exists and is yours, but is not currently `active` / outside its display window | ✅ |

### `GET /api/v1/launch?code=` — WebView-facing, no HMAC

| Status | When | `code`? |
|:--:|---|:--:|
| `200` | consumed successfully, session established, `302` redirect to the campaign | — |
| `401` | `INVALID_LAUNCH_CODE` — code does not exist, has expired, or was already consumed; **one code covers all three causes, deliberately** (see [campaign-launch.md §8](./campaign-launch.md#8-error-codes)) | ✅ |

⚠️ **Do not try to distinguish "expired" from "already used" from "never existed" on this response.**
Splitting it into separate statuses would let a prober learn which guess was closer to a real code —
see [campaign-launch.md §8](./campaign-launch.md#8-error-codes) for the full reasoning.

## RECOVERY channel — `POST /api/v1/integrations/reconciliation`

Full context: [recovery.md](./recovery.md).

| Response | Meaning |
|---|---|
| `200` + `windows: []` | the source **does not belong to you**, **or** does not exist — intentionally indistinguishable |
| `400` | `to` is not after `from`, or the range exceeds 30 days in one call |
| `401` | key, signature, or freshness — same message as the EVENT channel |

For the **reverse** direction (we call you): you choose your own HTTP shape, but your three possible
answers (cannot-answer / empty / list-with-cursor) must map to `401`/`403` (refusing us), a genuine
empty response (nothing in range), and a paginated list, respectively. See
[recovery.md §3.3](./recovery.md#33-the-three-answers-must-be-distinguishable-from-each-other) — do not
invent new codes here; use your own API's normal error conventions.

## Cross-channel notes

- A `401` on **any** channel means the same three possible causes: bad key, bad signature, or clock
  drift beyond the freshness window. It never means "this specific business rule failed" — that is
  always a `4xx` other than `401` (`403`, `409`, `422`) with a distinguishing code.
- `deliveryId` (EVENT channel) and `launchCode` (LAUNCH channel) are unrelated concepts that happen to
  both be opaque tokens — do not conflate them. See each channel's terminology section.
