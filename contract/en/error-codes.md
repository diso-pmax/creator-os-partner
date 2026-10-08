# Error Code Reference

Start here: [README.md](./README.md).

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

### Batch delivery codes — `POST /api/v1/integrations/events/batch`

Full context: [event-ingestion.md §14](./event-ingestion.md#14-batch-delivery). Whole-request refusals use the shapes above;
each element of an accepted batch is answered on its own, and the per-element `code` comes from this table too.

| Status | `code` | When | You do |
|:--:|---|---|---|
| `422` | `batch_not_enabled` | batch delivery is not enabled for your key | ask us to enable it — nothing was processed |
| `413` | `batch_too_large` | more events than your per-batch limit | split the batch (the limit is in `details.maxEventsPerBatch`) |
| `413` | `payload_too_large` | the request body is bigger than your byte limit | split the batch (the limit is in `details.maxBytes`) |
| `400` | `validation_error` | per element: this element is malformed | fix that element and resend only it |
| `500` | `internal_error` | per element: platform failure while handling this element | retry it — deduplication keeps this safe |

### `422` business codes

| You sent | Code | You do |
|---|---|---|
| a `type` outside the closed catalog (e.g. `order`, `order.v2.created`) | `unknown_event_type` | change the value — the error lists the valid values |
| `type: STREAK_REACHED` | `derived_event_not_accepted` | stop sending it — we derive this ourselves |
| a valid `type` not yet registered for your key | `event_type_not_registered` | contact us — this is a configuration gap on our side, your payload is correct |
| an `eventId` already used for a **different** `type` | `event_id_conflict` | mint a new id for this attempt |
| `type: UI_ACTION` with `payload` missing `actionKey` | `payload_field_missing` | add `actionKey` — the error names the missing field |
| an order type with `payload` missing `orderId`, or carrying `amountMinor` without `currency` | `payload_field_missing` | add the field the error names |
| an order type whose `payload` carries a `brandCode` that is **present but empty, blank, or not a string** | `payload_field_missing` | send a usable string *(not empty, not blank)*, or omit `brandCode` entirely — a merely mismatched value returns `200`, not this |
| `occurredAt` **older** than your lateness limit *(default 30 days)* | `event_too_late` | send sooner, or ask us to widen the limit — **do not** shift `occurredAt`, see [event-ingestion.md §5.4](./event-ingestion.md#54-occurredat--the-two-deadlines) |
| `occurredAt` **ahead of our clock** by more than your skew limit *(default 300 s)* | `event_from_future` | fix the clock on the sending machine — widening this limit removes your own guardrail |
| a `LINK_*` event for which no active attributed source is registered to your key | `LINK_SOURCE_UNAVAILABLE` | contact us — this is a configuration gap on our side, your payload is correct |
| a `LINK_*` event whose envelope or `payload` does not satisfy the Program Link conversion profile | `LINK_CONVERSION_INVALID` | fix the envelope so `eventId`, `type` and `occurredAt` match the conversion carried in `payload` |

⭐ **The two `occurredAt` codes are the only ones here a resend can escape.** They apply only to events
that are new to us — a retry of an event we already accepted returns `200 deduplicated: true` however
much later it arrives. Every other code in this table is a property of the payload and will answer the
same way forever, so retrying without changing anything is pointless.

⚠️ A `422` carrying `code: invalid_occurred_at` means the timestamp did not parse at all. You should
get a `400` for that instead — this code is a backstop that should not be reachable from this channel,
so if you ever see it, please report it.

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
| `400` | `validation_error` — malformed body (including a malformed `segments`: one wrong element refuses the whole call, no ticket); uses the plural `errors` field, shape shown above | ✅ |
| `401` | bad key, bad signature, or expired timestamp — same shape as every other channel's `401` (no `code` field) | ✗ |
| `404` | `CAMPAIGN_NOT_FOUND` — campaign does not exist, **or** belongs to a different tenant than your integration (intentionally indistinguishable, same reasoning as every other cross-tenant case in this integration) | ✅ |
| `422` | `CAMPAIGN_NOT_LAUNCHABLE` — campaign exists and is yours, but is not currently `active` / outside its display window | ✅ |

### `GET /api/v1/launch?code=` — WebView-facing, no HMAC

| Status | When | `code`? |
|:--:|---|:--:|
| `200` | consumed successfully, session established, `302` redirect to the campaign | — |
| `401` | `INVALID_LAUNCH_CODE` — code does not exist, has expired, or was already consumed; **one code covers all three causes, deliberately** (see [campaign-launch.md §8](./campaign-launch.md#8-error-codes)) | ✅ |
| `403` | `feature_disabled` — the campaign pays a reward, but the loyalty feature is not switched on for your tenant. The body is raw JSON, there is no page: your app shows its own screen. Do not retry, contact us | ✅ |

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

## SETTLEMENT channel — we call YOU (`POST <your settlement endpoint>`)

The direction is reversed here: **you** answer, and these codes are how **we read your answer**. Full
contract: [settlement.md](./settlement.md).

| Your answer | How we read it | Our ops can send again? |
|:--:|---|:--:|
| `2xx` | received | — (line marked as sent) |
| `409` | you have **already seen this `deliveryNonce`** — use it for nothing else ([settlement.md §4](./settlement.md#4-replay-protection--two-obligations-not-one)) | on a first send it is a rejection and ops can send again with a new nonce; on **Ask partner again** it closes the line as sent |
| `422` | you refuse the packet for a business reason | yes |
| `400` · `401` · `403` · `404` · `5xx` · any other code | send failed — *"response code outside the contract"* | yes, but fix the cause first (`401`/`403`: the key) |
| no answer in 10 seconds · connection error | send failed | yes |
| a `3xx` redirect | send failed — we never follow redirects | yes |

### When we refuse to send (you receive nothing)

Before any call to you, our **Send** action is refused with a `409` on our side if we cannot name the
recipient exactly. You see no request; these codes explain why none arrived:

| Code (on our ops' screen) | Meaning | Who fixes it |
|---|---|---|
| `settlement_item_partner_ref_missing` | we have no `externalUserId` of yours for this player (never launched or sent an event under this integration) | you — send the player's launch or event first; then ops sends again |
| `settlement_item_partner_ref_ambiguous` | more than one identifier of yours exists for the same player — we do not guess | us — resolve the duplicate identity, then send again |
| `settlement_item_partner_namespace_unresolved` | the integration has no single identity provider across its `DIRECT` event sources | us — fix the integration, then send again |

## Cross-channel notes

- A `401` on **any** channel means the same three possible causes: bad key, bad signature, or clock
  drift beyond the freshness window. It never means "this specific business rule failed" — that is
  always a `4xx` other than `401` (`403`, `409`, `422`) with a distinguishing code.
- `deliveryId` (EVENT channel) and `launchCode` (LAUNCH channel) are unrelated concepts that happen to
  both be opaque tokens — do not conflate them. See each channel's terminology section.

## Asynchronous processing codes — `processing[].errorCode`

These are not HTTP statuses. The door already answered `200`; the code appears later in the answer of
`POST /integrations/deliveries` ([event-ingestion.md §15](./event-ingestion.md#15-reading-the-result-after-200)) when the
processing of a `POINT_REDEEMED` event failed. After fixing the cause, resend the event with a **new** `eventId`.

| `errorCode` | Meaning | You fix it, or you wait? |
|---|---|---|
| `external_payment_amount_missing` | `amountMinor` (a whole number, VND ×1) or `currency` is missing from the event | **you fix**: send all four fields; the event stays failed, so send the corrected one with a **new `eventId`** |
| `settlement_item_not_found` | the `settlementItemId` is not a line we know | **you fix**: copy it again from the `Mã dòng` column of the statement |
| `settlement_item_already_confirmed` | the line was already paid under another reference | **neither**: stop and reconcile with us |
| `settlement_batch_not_confirmed` | the batch is not confirmed on our side yet | **you wait**: resend after we confirm the batch |
| `external_payment_amount_drifted` | the amount differs from the statement | **both sides**: the line waits for our operations team to reconcile with you, then resend the agreed amount |
| `processing_error` | any other failure; we do not publish a code for it | **you wait**: we retry; contact us if the status becomes `DEAD` |

