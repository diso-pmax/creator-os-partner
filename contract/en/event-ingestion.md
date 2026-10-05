# EVENT Channel — Event Ingestion Contract

Start here: [README.md](./README.md).

**Profile scope:** this page describes shared transport and legacy Reward examples. PROGRAM_LINK uses the same signed endpoint with its own strict payload and optional buyer externalUserId; Campaign LAUNCH does not apply. Follow [program-link.md](program-link.md) for the complete Link contract. Reward/session statements below apply only to legacy Reward.

> 🔴 An event only produces a reward if the user has already gone through the LAUNCH channel at least
> once. This channel alone is not sufficient — see [README.md § Required order](./README.md).

## 1. Overview

```text
Partner server                          Creator-OS
     │                                       │
     │  POST /api/v1/integrations/events     │
     ├──────────────────────────────────────▶│
     │                                       ├─ authenticate (Access Key)
     │                                       ├─ verify signature (HMAC-SHA256)
     │                                       ├─ verify timestamp freshness (±5 min)
     │                                       ├─ validate envelope + payload shape
     │                                       ├─ deduplicate by eventId
     │                                       ├─ persist (raw storage — always, even if step below fails)
     │                                       └─ resolve subject + credit reward (async, best-effort)
     │◀──────────────────────────────────────┤
     │  200 { eventId, deliveryId, deduplicated }
```

> **Sending many events at once?** See [§14 Batch delivery](#14-batch-delivery): `POST /api/v1/integrations/events/batch`.
> It is a different way to *carry* events — every event inside keeps exactly the same shape and rules described in this page.

This channel is one-directional: your server calls ours. We never call your server as part of this
channel (see [recovery.md](./recovery.md) for the one exception — the reverse direction used for
reconciliation).

## 2. Prerequisites

- You have an `accessKey` and an **EVENT** Secret Key (see [README.md](./README.md)).
- You have a server capable of computing HMAC-SHA256 and sending HTTPS `POST` requests.
- **Strongly recommended**: your LAUNCH integration ([campaign-launch.md](./campaign-launch.md)) is
  already sending the same user identifier as `externalUserId`. Events for a user who has never gone
  through LAUNCH are accepted but never rewarded — see [README.md § Required order](./README.md).

## 3. Authentication

| Item | Contract |
|---|---|
| Access Key header | `X-API-Key` |
| Timestamp header | `X-Timestamp` — **seconds** since epoch (not milliseconds) |
| Signature header | `X-Signature` |
| Algorithm | HMAC-SHA256 |
| Secret | EVENT channel Secret Key |
| Encoding | signature output is **lowercase hex**, prefixed `sha256=` |
| Canonical string | `<X-Timestamp>` + `"."` + `<raw request body, exact bytes>` |
| Timestamp tolerance | ±5 minutes |
| Invalid/expired timestamp | `401` |
| Invalid signature | `401` |
| Access Key unknown/revoked | `401` |

**Signing formula:**

```text
canonical_string = timestamp + "." + raw_body
signature        = "sha256=" + hex(HMAC_SHA256(EVENT_KEY, canonical_string))
```

🔴 **`EVENT_KEY` is not something we hand you.** You receive **one** `masterSecret` *(shown exactly
once when we issue your credential)* and **derive** each channel key yourself:

```text
EVENT_KEY = HKDF-SHA256( ikm  = base64url_decode(masterSecret),
                         salt = empty,
                         info = "integration:channel:EVENT:v<VERSION>",
                         len  = 32 )   → base64url, no padding
```

Full contract, rotation rules, and **test vectors to check your implementation against**:
[credential-derivation.md](./credential-derivation.md). If the vectors match, your derivation is
correct — no guessing.

⚠️ `<VERSION>` is that channel's own version number, which we tell you at issue time *(usually `1`)*.
Rotation increments it and you must follow — it cannot be inferred.
```

`raw_body` MUST be the **exact byte sequence** transmitted on the wire — not a re-serialization of the
parsed object. This is the single most common integration bug (see §3.1).

🔒 The EVENT Secret Key MUST live on your server only — never in a mobile app, browser, or source
repository. Anyone holding it can forge events as you.

🔒 The EVENT Secret Key MUST NOT be reused for the LAUNCH channel, even though both use the same
`accessKey`. See [README.md](./README.md) for why.

### 3.1 ⚠️ Most common bug: re-serializing before signing

This bug produces intermittent `401` on a **subset** of requests, which looks exactly like a wrong key
— teams routinely spend hours checking credentials before finding this.

```text
WRONG                                       RIGHT
───────────────────────────────────────     ───────────────────────────────────────
body = serialize(obj)                       body = serialize(obj)
sig  = sign(serialize(obj))   ← 2nd call!    sig  = sign(body)
send(serialize(obj))          ← 3rd call!    send(body)
```

Re-serializing can change key order, whitespace, or Unicode escaping. The signature covers **bytes**,
so a single differing byte breaks it.

**Rule: serialize exactly once, keep that string/byte-array, sign it, and send it.**

⚠️ If your framework has middleware that reads and reconstructs the body (some HTTP clients, some
logging layers), make sure it does not touch the body after you have signed it.

### 3.2 Worked example

```bash
API='https://<the host of the environment you are using>/api/v1'
ACCESS_KEY='AK-DEMO-001'
MASTER_SECRET='<your masterSecret — 43-char base64url, shown once>'
EVENT_VERSION=1                                       # EVENT channel version, we tell you at issue time

# ⬇️ DERIVE the EVENT channel key — do NOT sign with masterSecret directly.
EVENT_KEY=$(node -e '
  const { hkdfSync } = require("node:crypto");
  const ikm  = Buffer.from(process.argv[1], "base64url");
  const info = Buffer.from(`integration:channel:EVENT:v${process.argv[2]}`, "utf8");
  process.stdout.write(
    Buffer.from(hkdfSync("sha256", ikm, Buffer.alloc(0), info, 32)).toString("base64url"));
' "$MASTER_SECRET" "$EVENT_VERSION")

BODY='{"specversion":"1.0","eventId":"evt-88421","externalUserId":"12345","type":"ORDER_COMPLETED","occurredAt":"2026-08-14T09:12:33Z","confidence":"SERVER_OBSERVED","payload":{"orderId":"SO-99881","amountMinor":250000000,"currency":"VND"}}'
TS=1786698753

SIG="sha256=$(printf '%s.%s' "$TS" "$BODY" \
      | openssl dgst -sha256 -hmac "$EVENT_KEY" -r | cut -d' ' -f1)"   # base64url string, used AS-IS
# → sha256=ae00dc858385fdb65061fda5da1809772f8f602f5d653052e7672516c4d59176

curl -sS -D- "$API/integrations/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key:   $ACCESS_KEY" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  --data-binary "$BODY"
```

⚠️ **Use `--data-binary`, not `-d`.** `curl -d` can strip newlines and change the byte sequence being
sent, which will not match the bytes you signed.

**Node.js:**

```js
const crypto = require('node:crypto');

function signEvent(secret, rawBody, timestampSeconds) {
  const base = Buffer.concat([
    Buffer.from(`${timestampSeconds}.`, 'utf8'),
    Buffer.from(rawBody, 'utf8'),   // the EXACT string you will send
  ]);
  return 'sha256=' + crypto.createHmac('sha256', secret).update(base).digest('hex');
}

const body = JSON.stringify(event);            // serialize ONCE
const ts   = Math.floor(Date.now() / 1000);
const EVENT_KEY = Buffer.from(crypto.hkdfSync(
  'sha256', Buffer.from(MASTER_SECRET, 'base64url'), Buffer.alloc(0),
  Buffer.from(`integration:channel:EVENT:v${EVENT_VERSION}`, 'utf8'), 32,
)).toString('base64url');                      // derive ONCE at startup, keep in memory

const sig  = signEvent(EVENT_KEY, body, ts);   // ⚠️ channel key, not masterSecret
await fetch(`${API}/integrations/events`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': ACCESS_KEY, 'X-Timestamp': String(ts), 'X-Signature': sig },
  body,                                          // send the SAME string you signed
});
```

## 4. Conformance vectors — three requests to fire in order

| # | Send | Expect | Proves |
|:--:|---|---|---|
| **1** | valid event, new `eventId` | `200` `deduplicated: false` | signature correct · shape correct · `type` registered |
| **2** | **the exact same request again** | `200` `deduplicated: true` | deduplication works — retrying is safe |
| **3** | same request, one character changed in the body, signature unchanged | `401` | the signature really covers the content |

⚠️ **Step 2 is the most important step in this document.** It is what lets you retry freely on `429`,
`5xx`, network timeouts, or backfills without double-counting.

**If step 2 returns `deduplicated: false`**, your `eventId` is being generated **per HTTP call** rather
than **per business event** — everything downstream will be double-counted. Stop and fix this before
proceeding (see §6).

Two more, if you want certainty:

| # | Send | Expect |
|:--:|---|---|
| **4** | `X-Timestamp` off by 10 minutes | `401` (±5 min window) |
| **5** | `type` not registered for your key | `422` — **not** `401` |

## 5. Request schema

```jsonc
{
  "specversion":    "1.0",                   // envelope version — OPTIONAL
  "eventId":        "evt-88421",             // business event identity — dedup key
  "externalUserId": "12345",                 // your user id — MUST match LAUNCH's externalUserId
  "type":           "ORDER_COMPLETED",       // closed catalog, §5.2
  "occurredAt":     "2026-08-14T09:12:33Z",  // when it HAPPENED, not when you send it
  "confidence":     "SERVER_OBSERVED",       // §5.1
  "payload":        { "orderId": "SO-99881", "amountMinor": 250000000, "currency": "VND" }
}
```

| Field | Type | Required | Description | Constraints |
|---|---|:--:|---|---|
| `eventId` | string | **YES** | Business event identity — the deduplication key | MUST be unique in your system; MUST NOT change across retries of the same event; see §6 |
| `externalUserId` | string | **YES for legacy Reward; optional for validated PROGRAM_LINK** | Your user's identifier | 🔴 MUST equal `externalUserId` on the LAUNCH channel, same format/case, for the same user (README) |
| `type` | string | **YES** | Event category | MUST be one of the closed catalog in §5.2; case-sensitive |
| `occurredAt` | RFC 3339 / ISO-8601 | **YES** | When the business event happened | timezone MUST be UTC (`Z`); must be inside the freshness window, §5.4 |
| `payload` | object | **YES** | Type-specific business data | shape varies by `type`, §5.3 |
| `confidence` | string | OPTIONAL | Certainty level, §5.1 | one of `CLIENT_ASSERTED` / `SERVER_OBSERVED` / `SETTLED` |
| `specversion` | string | OPTIONAL | Envelope version | if present, MUST be exactly `"1.0"` — omitting it is fine (`200`); sending any other value is rejected (`400`) |

### 5.1 `confidence` — a certainty level, not a verdict

```text
CLIENT_ASSERTED   <   SERVER_OBSERVED   <   SETTLED
(client claims it)    (your server saw it)   (already settled/reconciled)
```

An event below the confidence level a reward requires is still `200`, still stored — it is just **not
counted for that reward**. This is **not an error — do not retry it.**

### 5.2 `type` — closed catalog

| `type` | You send it? | Meaning |
|---|:--:|---|
| `ORDER_CREATED` | ✅ | order just created, not yet completed |
| `ORDER_COMPLETED` | ✅ | order completed |
| `ORDER_CANCELLED` | ✅ | order cancelled **or refunded** — one type covers both |
| `UI_ACTION` | ✅ | a UI behavior on your side, attested by you |
| `POINT_REDEEMED` | ✅ | **you have paid the player** per the statement we handed over *(opened 2026-09-03)* |
| `CHECKIN` | ❌ | happens inside our product, we record it ourselves |
| `STREAK_REACHED` | ❌ | derived by us from check-in streaks, not accepted from you |

⚠️ **Cancel and refund are ONE type, not two.** Both reverse a previously counted event. There is no
`ORDER_REFUNDED`.

⚠️ **Case-sensitive.** `checkin` is not `CHECKIN`. Sending an unregistered value returns `422
unknown_event_type` (see [error-codes.md](./error-codes.md)), listing the valid values.

⭐ **You do not need to send `ORDER_CREATED`.** Sending only `ORDER_COMPLETED` is a complete, valid
integration. `ORDER_CREATED` only moves the recognition point earlier.

### 5.3 `payload` — by type

`ORDER_CREATED` / `ORDER_COMPLETED` / `ORDER_CANCELLED`:

```jsonc
{ "orderId": "SO-99881", "amountMinor": 250000000, "currency": "VND", "brandCode": "SHOPEE" }
```

🔴 **`brandCode` tells us which sponsor brand an order belongs to.** Some campaigns offer a reward only
for orders at a fixed list of sponsor brands *(e.g. a reward for a first order at a sponsor brand, or for
orders at several distinct sponsor brands)*. An order is counted for such a reward **only if** its
`brandCode` **exactly matches** one of the brand codes the campaign configured. **We define the brand
codes** *(e.g. `SHOPEE`, `LAZADA`)*; you send that exact string — same rule as `actionKey` below.

⚠️ **Case-sensitive, compared as a raw string.** `SHOPEE` ≠ `Shopee` ≠ `shopee`. Get the case wrong —
or omit `brandCode` — and the order is **still accepted and still returns `200`**, but it is **never
counted** for any brand-scoped reward, and no error is raised to tell you. `brandCode` is **not required
at the door**: an order without it is a valid order *(it still counts for rewards not tied to a specific
brand)*, it just cannot be counted for a brand-scoped one.

⚠️ **If you DO send `brandCode`, send a usable string.** Omitting it is fine (`200`), and a wrong-case
value is still accepted (`200`, just never counted). But a `brandCode` that is **present yet empty, blank,
or not a string** is a different case: the whole event is **rejected with `422 payload_field_missing`**
(see [error-codes.md](./error-codes.md)) — nothing stored, nothing counted. Our canonical codes are **at
most 64 characters**, so a longer value can never match a configured brand.

🔴 **Repeat `brandCode` on every event of a brand order, including `ORDER_CANCELLED`.** Always sending it
is the safe rule — it costs nothing where it is not needed, and for some brand-scoped rewards a
cancellation that omits it will not reverse the order correctly.

🔴 **`ORDER_CANCELLED` must carry the SAME `orderId` as the order it cancels** — and come from the same
`externalUserId`. That is how we find what to reverse: rewards counted per order *(an order-count
milestone, a first order at a sponsor brand)* are reversed by matching `orderId`. A cancellation with a
different `orderId` is still accepted with `200` and no error, but it is not matched to the original
order — those rewards stay counted. One order, one `orderId`, across `ORDER_CREATED` →
`ORDER_COMPLETED` → `ORDER_CANCELLED`, each with its own `eventId`.

`UI_ACTION` — **`actionKey` is REQUIRED**:

```jsonc
{ "actionKey": "<canonical-action-key-assigned-to-you>" }
```

`POINT_REDEEMED` — **you paid, you report back** *(opened 2026-09-03)*:

```jsonc
{
  "settlementItemId": "3f6a1c22-9d40-4b7e-8a11-2c5e77d09b41",
  "redemptionRef": "PAYOUT-88213",
  "amountMinor": 5000,
  "currency": "VND"
}
```

We hand you a **statement**: one line per player, with points, the stamped exchange rate, and the amount
to pay. You pay, then send **one event per line you paid**.

| Field | What it is |
|---|---|
| `settlementItemId` | **copy VERBATIM from the `Mã dòng` (Line ID) column** of the statement — it tells us which line you just paid |
| `redemptionRef` | **your** payout reference. Resending the same one means we record it **exactly once**, so retries are always safe |
| `amountMinor` | the amount you paid, **VND ×1** *(100,000đ ⇒ `100000`)* |
| `currency` | currency of the amount above |

The envelope's `occurredAt` is **when you paid**, not when you send the event.

**Which user.** The envelope's top-level `externalUserId` is the user you paid — the very value you received
in the settlement packet ([settlement.md §2.1](./settlement.md#21-request-body)) or in the statement's
`Mã người chơi (đối tác)` column. **We find the line by `settlementItemId`, not by `externalUserId`:** a
wrong `externalUserId` does not redirect the payment to another line, and a right one cannot rescue a wrong
`settlementItemId`.

**Required if you receive settlement packets.** If you declared a settlement address
([settlement.md §5](./settlement.md#5-after-you-pay--report-it-with-point_redeemed)), sending this event for
every line you paid is **mandatory**: it is the only thing that closes the line. Unreported lines appear on
our ops' overdue list after 7 days (default).

🔴 **The amount must MATCH the statement.** Off by one đồng and we **reject that line and record
nothing**. The `200` only tells you we stored your event; the result of booking it comes later, and you read it with
`POST /integrations/deliveries` ([§15](#15-reading-the-result-after-200)). The statement is a stamped
document and the money has already left your hands, so this is a conversation between two parties, not
something a machine should decide.

| Error code *(read it as `processing[].errorCode`, §15)* | Meaning | What you do |
|---|---|---|
| `external_payment_amount_missing` | `amountMinor` (a whole number, VND ×1) or `currency` is missing from the event | send all four fields, then resend with a new `eventId` |
| `settlement_item_not_found` | the line ID does not exist | re-copy it from the `Mã dòng` column |
| `settlement_batch_not_confirmed` | the batch is not confirmed on our side yet | **resend later** — not your fault |
| `settlement_item_already_confirmed` | this line was already paid under a different reference | stop and reconcile with us |
| `external_payment_amount_drifted` | the amount differs from the statement | reconcile, then resend |

⚠️ **Missing `settlementItemId` or `redemptionRef` is rejected at the door** *(`422
payload_field_missing`)*. Missing `amountMinor` is **accepted** at the door — but that event is **not
recorded**, because there is nothing to reconcile against. Always send all four fields.

🔴 **We define `actionKey`; you send that exact string.** It is the only thing that tells UI behaviors
apart — `UI_ACTION` is **one** type shared by every UI behavior, so without `actionKey` nobody knows
which behavior you just reported. `actionKey` is a **canonical semantic identifier the platform
defines** — you map your internal representation to it at your own boundary, you do not invent it and
report it to us.

We do not publish one fixed global list here — the exact strings depend on which UI behaviors your
integration is configured for, and that set changes whenever a campaign is configured. Read the current
set for your own campaign from its campaign screen in the console, or ask your onboarding contact. Do not copy an
`actionKey` you saw for a different integration or a different campaign — it may no longer be the value
that campaign is configured to match.

⚠️ **Case-sensitive, compared as a raw string.** Get the
case wrong and the event is **still accepted and still returns `200`**, but the entitlement tied to that
behavior is **never counted** — and no error is raised to tell you.

⚠️ **Omitting `actionKey`** ⇒ `422 payload_field_missing` (see [error-codes.md](./error-codes.md)).

Beyond `actionKey` the shape is open — extra fields are stored verbatim and ignored, they never cause
an error.

Three fields you MUST NOT send inside `payload`: an internal `eventId`/`deliveryId` alias, anything
named `subject`, and any field intended to identify the user other than the top-level `externalUserId`.

### 5.4 `occurredAt` — the two deadlines

`occurredAt` is checked against **our clock at the moment your request arrives**. Miss either deadline
and the event is rejected with `422`: nothing is stored, nothing is counted.

| Code | We rejected it because | Default limit | What you do |
|---|---|:--:|---|
| `event_too_late` | the event is **older** than your lateness limit | **30 days** | send sooner — or ask us to widen the limit for your integration |
| `event_from_future` | `occurredAt` is **ahead of our clock** by more than your skew limit | **300 seconds** | 🔴 **fix the clock on the sending machine.** Asking us to widen this one is the wrong direction — it removes your own guardrail |

Both codes are listed in [error-codes.md](./error-codes.md) alongside every other `422` this channel can
return.

**Exactly at the limit is accepted.** The rule is *past* the limit, not *at* it: with a 60-minute
lateness limit, 60 minutes late returns `200` and 61 minutes late returns `422`.

**The message names both numbers**, so you can reconcile without asking us:

```text
occurredAt trễ 61 phút, quá hạn 60 phút của tích hợp này
```

That reads *"occurredAt is 61 minutes late, past this integration's limit of 60 minutes"* — your actual
lateness and your own limit, in one line, so you never have to ask us which limit you were measured
against.

⚠️ The `detail` text is currently **Vietnamese**, as above. Branch on `code`, never on the wording —
that rule holds for every error in this integration, and this is where you are most likely to forget it.

**Both limits are set per integration, not globally.** We tell you your two values at handover; until
we set them, you get the platform defaults in the table above. They are deliberately not one shared
number — a partner batching overnight and a partner streaming in real time do not need the same
window, and a single ceiling would have to be generous enough for the slowest, which makes it
decoration for everyone else.

🔴 **A limit of `0` means forbidden, not unlimited.** With a future-skew limit of `0`, an `occurredAt`
one second ahead of our clock is rejected.

⭐ **A retry of an event we already accepted is never rejected for being late.** The deadline applies
only to events that are new to us. An event stuck in your outbox for a week still returns `200` with
`deduplicated: true`, exactly as it would have before the deadline passed. A draining queue is always
safe — so **never mint a fresh `eventId` because you feared a `422`.** That turns one late event into
two economic events, which is far worse than a late one.

⚠️ **This deadline is not the campaign window.** It compares `occurredAt` against **now** — not against
any campaign's start, end, or grace period. An event can clear this gate and still earn nothing because
the campaign it would have counted for is closed; that outcome is a `200`, same as the `confidence`
case in [§5.1](#51-confidence--a-certainty-level-not-a-verdict). A `422` here means one thing only:
**the timestamp itself is not credible.**

🔴 **Do not "fix" `event_too_late` by moving `occurredAt` forward.** This field selects which version of
the reward terms applies, so shifting it changes what the event is worth — for your users and on our
invoice. Send the true time. If your real delivery lag genuinely exceeds the limit, the limit is the
thing that should move; tell us.

## 6. `eventId`, `deliveryId`, `batchId` — three identifiers, three levels

```text
eventId     = one business event                 · YOU generate it   · used for DEDUPLICATION
deliveryId  = our receipt for ONE event          · WE generate it    · used for TRACING
batchId     = ONE HTTP call (batch route only)   · WE generate it    · used for CORRELATION (not stored)
```

> **`eventId` identifies the business event.** You generate it. It MUST NOT change between retries of
> the same real-world event.
>
> **`deliveryId` identifies our receipt of one event.** We generate it. Each retry MAY get a new one.
>
> **`batchId` identifies one call to the batch route.** We generate it and return it in that response so that
> you and we can point at the same call in logs. It is **not stored**, it is **never** an idempotency key, and
> you must **never send it** — a request body that contains `batchId` is rejected with `400`.

A single call to `POST /integrations/events` carries one event and therefore yields one `deliveryId`. A call to
the batch route carries N events and yields N `deliveryId` values (one per event) plus one `batchId`.

```text
eventId = evt-123
   ├── receipt #1   deliveryId = del-001   →  deduplicated: false
   └── receipt #2   deliveryId = del-002   →  deduplicated: true
```

⭐ **Record `deliveryId` on your side.** When something goes wrong, it is the one term both sides can
use to refer to the exact same receipt — instead of describing "the one around 9am".

⚠️ **`deliveryId` MAY be absent** in a response. That means our trace store did not record one for that
attempt — your event was still received and stored durably. Absence is not an error; do not retry
because of it.

⚠️ A `422` response MAY also carry `deliveryId` (inside `details`) — same "MAY be absent" rule as above,
not a guarantee. When present, it is the response you most need to trace, since a `422` never enters
business processing and leaves no other trace. When absent, fall back to tracing by `eventId` and
timestamp.

## 7. Deduplication behavior

```text
First request with eventId = "order-123"
  → accepted
  → processed / persisted

Same eventId sent again (any number of times)
  → 200, deduplicated: true
  → MUST NOT create a second economic consequence
```

**Normative rule: the sender MUST preserve `eventId` when retrying the same business event.**

### Correct

```jsonc
// first delivery
{ "eventId": "order-123", "type": "ORDER_COMPLETED", ... }
// retry after a timeout — SAME eventId
{ "eventId": "order-123", "type": "ORDER_COMPLETED", ... }
```

### Incorrect

```jsonc
// same business event, but a NEW id was minted for the retry
{ "eventId": "retry-456", "type": "ORDER_COMPLETED", ... }
```

🔴 **Deduplication matches on `(eventId, type)` only — `payload` content is never compared.** If you
resend the same `eventId` with the same `type` but a **different** `payload`, the response is still
`200 deduplicated: true`, and the **new `payload` is silently discarded** — the platform keeps whatever
`payload` arrived on the **first** delivery. This is first-write-wins, not last-write-wins, and there is
no error to tell you it happened.

```jsonc
// first delivery — this payload is the one that is kept
{ "eventId": "order-123", "type": "ORDER_COMPLETED", "payload": { "amountMinor": 10000, ... } }

// retry with a DIFFERENT payload, same eventId + type
{ "eventId": "order-123", "type": "ORDER_COMPLETED", "payload": { "amountMinor": 20000, ... } }
// → 200 { "deduplicated": true }  — amountMinor stays 10000, the 20000 is discarded
```

⚠️ **If your business event's payload can legitimately change before you have a final value** (e.g. an
amount that gets corrected), do not rely on resending the same `eventId` to update it. Instead wait
until you have the final value before sending, or model the correction as a separate event on
`ORDER_CANCELLED` + a new `ORDER_COMPLETED` with a new `eventId`.

Sending the same `eventId` with a **different `type`** is a different case — see `event_id_conflict` in
[error-codes.md](./error-codes.md).

This is treated as a **different** event and is **not** protected by deduplication — it produces a
second, duplicate reward.

`eventId` **MAY** use any string format (a UUID is enough). It **MUST** be unique within your
integration and **MUST NOT** change for retries of the same business event.

## 8. Response contract

| Status | Meaning | `deliveryId`? | Partner action |
|:--:|---|:--:|---|
| `200` | Received and durably stored — **including duplicates** | ✅ | none — stop retrying |
| `400` | Malformed envelope: broken JSON, an **invalid** `specversion` value (present but not `"1.0"`), or a missing **required** envelope field | ✗ | fix the request, then resend |
| `401` | Bad key, bad signature, or expired timestamp — one message covers all three | ✗ | check credentials/clock, then resend |
| `404` | Route does not exist | ✗ | fix the URL |
| `422` | Correct shape, wrong **business** meaning — see [error-codes.md](./error-codes.md) | MAY be present (in `details`) | **do not blindly retry** — read the `code` field |
| `413` | Request body over the **100 KB** ceiling — see [§10b](#10b-request-body-size-ceiling) | ✗ | **do not resend the same packet** — split it or trim `payload` |
| `429` | Rate limited | — | read `Retry-After`, wait, resend |
| `5xx` | Platform failure | — | retry with backoff |

> The batch route has its own contract — including which errors reject a whole batch — in [§14](#14-batch-delivery).

**`200` does not promise a reward was granted** — see §5.1 and [README.md § Required order](./README.md)
for the three reasons an accepted event can still produce zero reward.

## 9. Retry policy

**When to retry:**

```text
429            → retry
5xx            → retry
network error  → retry
4xx (validation) → DO NOT retry without fixing the request first
```

**How many times?** Creator-OS does not require a specific retry count or schedule. **The sender
controls its own retry policy.** Exponential backoff with jitter is **recommended, not required**.

**What must stay the same across retries?**

```text
eventId → MUST remain unchanged
payload → MUST remain semantically unchanged
```

**What changes across retries?** `deliveryId` — we mint a new one for each receipt (§6).

## 10. Rate limiting

| Header | Meaning |
|---|---|
| `RateLimit-Limit` | requests allowed per window |
| `RateLimit-Remaining` | requests left in the current window |
| `RateLimit-Reset` | **seconds** until the window resets — **not** a Unix epoch timestamp |
| `Retry-After` | present on `429` — seconds to wait before resending |

Limit: 600 requests/minute per Access Key.

If these headers are absent from a response: treat it as **no rate-limit information available** for
that request — do not infer you have unlimited quota.

## 10b. Request body size ceiling

A request body on the single-event route (`POST /integrations/events`) may be at most **100 KB** *(102,400 bytes; measured after decompression if
the request is gzip-encoded)*. Above it the gateway answers `413` with a **JSON** body in the same shape as every other error — not
an HTML page:

```json
{ "code": "payload_too_large", "title": "payload_too_large", "status": 413,
  "detail": "Thân request vượt trần cho phép.", "details": { "maxBytes": 102400 } }
```

`413` is a fault of the **packet**, not a transient failure: resending it unchanged returns `413` again. A normal
event is many times smaller than this ceiling; if your `payload` reaches it, contact us rather than splitting
ad hoc. A malformed JSON body returns `400` with `code: "invalid_json"` (also JSON, and it never echoes the
body you sent).

The batch route has larger, configurable ceilings — see [§14.5](#145-three-ceilings).

## 11. Recovery

Recovery (reconciliation, backfill, replay) is an **optional** capability, fully described in
[recovery.md](./recovery.md). You are fully integrated without it — see [README.md](./README.md).

## 12. Terminology

| Term | Meaning here |
|---|---|
| **event** | something that happened in your system — a completed order, a cancellation. One event = one `eventId` |
| **delivery** | our receipt of ONE event (it gets a `deliveryId`). A single-event call produces one; a batch call produces one per event. One event MAY have multiple deliveries |
| **batch** | one HTTP call to the batch route carrying N events. A transport convenience — not a business object, not stored, no idempotency of its own |
| **ingest disposition** | our answer for one event at the door: `accepted` · `deduplicated` · `rejected`. A closed set |
| **economic outcome** | what happens to the event *after* it is accepted (evaluation, reward). The door says nothing about it |
| **envelope** | the outer JSON shape (`eventId`, `type`, `occurredAt`, …), as opposed to `payload` |
| **deduplication** | the guarantee that a given `eventId` is counted exactly once, no matter how many deliveries carry it |
| **freshness** | the ±5-minute timestamp check that rejects replayed requests |
| **reconciliation window** | a 6-hour window, anchored on `occurredAt`, used to compare both sides' records — see recovery.md |

## 13. FAQ

**If we send the same event multiple times, do we get double-counted?**
No, as long as `eventId` stays the same. That is exactly what conformance vector #2 (§4) proves. If you
have not run that vector, run it before enabling retries.

**Does `200` mean the user already has the reward?**
Not necessarily. `200` only promises **received and durably stored**. Three reasons a `200` event can
still produce zero reward: ① it occurred outside a campaign's active window ② its `confidence` is below
what the reward requires (§5.1) ③ **the user has never gone through LAUNCH** — reason ③ is the
only one that is **permanent and never self-corrects later**; see [README.md § Required order](./README.md).

**We get `401` and we are certain the key is correct — what else could it be?**
In order of frequency: ① clock drift beyond 5 minutes ② re-serializing before signing (§3.1) ③ signing
with the wrong channel's secret ④ the secret was just revoked.

**Do we need to build a new API for recovery?**
No. We standardize **three questions and the meaning of their answers**, not an HTTP shape. If you
already have `GET /orders?from=…&to=…`, use it; an end-of-day reconciliation file works too. See
[recovery.md](./recovery.md).

**Are we rejected if we don't build recovery?**
No. All four integration tiers are valid. You are at `INGEST_ONLY`, and we publish that tier back to
you. See [recovery.md](./recovery.md).

**Does `eventId` need a specific format?**
No required format. A UUID is enough. It only needs to be **unique within your system** and **unchanged**
across retries of the same business event.

**Can we reuse the same key across sandbox and production?**
Not recommended, and for the **recovery** channel specifically, **not allowed** — each server is a
separate integration with its own key. Sharing means a request signed for one server verifies on the
other.

**Does `accepted` in a batch mean the reward was granted?**
No. `accepted` ≠ evaluated ≠ reward granted. See §14.3.

**Is there a payload size limit?**
Extra fields are stored verbatim and cause no issue, but do not put an entire business record inside
`payload`. Contact us first if you need to send a large block.

## 14. Batch delivery

`POST /api/v1/integrations/events/batch` carries **N events in one call** and answers **per event**. It is a transport
convenience for partners with bursts of events. Nothing about an individual event changes: the same envelope
(§5), the same `eventId` deduplication (§7), the same signature (§3), the same `payload` rules.

> ⚠️ The batch route is **off by default** for each integration. Ask us to enable it for your key; we tell you the
> limits (§14.5) that apply to you at the same time. While it is off, the route answers `422` with
> `code: "batch_not_enabled"` and processes nothing.

### 14.1 Request

Same headers as §3. The signature covers the **raw bytes of the whole body**, exactly as in §3.1.

```json
{ "events": [
  { "eventId": "evt-1", "type": "ORDER_COMPLETED", "occurredAt": "2026-09-19T08:00:00Z", "…": "…" },
  { "eventId": "evt-2", "type": "ORDER_COMPLETED", "occurredAt": "2026-09-19T08:00:05Z", "…": "…" }
] }
```

`events` is required and must not be empty. **Any other top-level key is rejected with `400`** (including `batchId`).
Each element is a complete event envelope, identical to the single-event route.

### 14.2 Response — `200` even when some events fail

```json
{
  "batchId": "bat_9c1f…",
  "errors": true,
  "accepted": 1, "deduplicated": 1, "failed": 1,
  "results": [
    { "eventId": "evt-1", "status": "accepted",     "deliveryId": "del-001" },
    { "eventId": "evt-2", "status": "deduplicated", "deliveryId": "del-002" },
    { "eventId": "evt-3", "status": "rejected", "code": "event_type_not_registered", "retryable": false, "detail": "…" }
  ]
}
```

Correspondence — you can rely on both lines, always, whenever the call reaches processing (a `200`):

```text
results.length      === events.length
results[i].eventId  === events[i].eventId      (null if that element had no usable eventId)
accepted + deduplicated + failed === events.length
```

Each result has one `status`:

| `status` | Meaning | Carries | What you do |
|---|---|---|---|
| `accepted` | received and durably stored | `deliveryId` | nothing — stop retrying that event |
| `deduplicated` | we already had this `eventId` | `deliveryId` | nothing — it is counted once |
| `rejected` | this event was not accepted | `code`, `retryable`, `detail` | if `retryable: true` resend **only this event** later; if `false` fix it first |

`retryable` follows from the error: `false` for shape/meaning errors, including `validation_error`, `event_type_not_registered`,
`unknown_event_type`, `payload_field_missing`, `derived_event_not_accepted`, `event_id_conflict`, `invalid_occurred_at`,
`event_too_late`, `event_from_future` — see [error-codes.md](./error-codes.md); `true` for `internal_error`, which is a
platform-side fault on that one event. Events are processed **one at a time**; a bad event never blocks the others.

**Resending a whole batch is safe.** It gets a **new** `batchId`, and every event we already have comes back
`deduplicated`. There is no "this batch was already processed" — deduplication happens per `eventId` (§7).
Duplicates inside one batch are also fine: `[E1, E2, E1]` returns `accepted · accepted · deduplicated`.

### 14.3 `accepted` does not mean the reward was granted

```text
accepted  ≠  evaluated  ≠  reward granted
```

`accepted` says only: *"this event is in our records."* It does **not** say it was evaluated against a
campaign, and it does **not** say a reward was granted (the reasons in §13 and the README still apply). A `200` for 500
events is not a bulk guarantee of 500 rewards — it is 500 receipts. Do not promise your users a reward on the strength
of `accepted`.

### 14.4 Array order is not chronological order

```text
✅ GUARANTEED:      results[i] ↔ events[i]
🔴 NOT guaranteed:  events[0] happened BEFORE events[1]
```

The order of the array only tells you which result belongs to which event. **When things happened is decided by
`occurredAt`** (and `supersedes`, where you use it), never by position. Sending `[E2, E1]` produces the same outcome as
`[E1, E2]`.

Two vocabularies, kept apart: the **ingest disposition** (`accepted` / `deduplicated` / `rejected`) is what the door
answers, and it is a closed set. The **economic outcome** happens downstream, and the door does not talk about it.

### 14.5 Three ceilings

Three independent ceilings protect the door. They are checked **after** authentication and **before** the first event
is processed. If **any** one is exceeded the **whole batch is refused**: no event is processed, the response has
**no `results`**, and nothing is consumed from your rate allowance.

| # | Ceiling | Exceeded → | Notes |
|:-:|---|---|---|
| ① | request size in bytes | `413`, `code: "payload_too_large"`, `details.maxBytes` | default **5 MiB**; we may set another value for your key; never above **10 MiB**. ⚠️ The 10 MiB hard cap is enforced when the body is read — **before** authentication, unlike ② and ③ |
| ② | events per batch | `413`, `code: "batch_too_large"`, `details.maxEventsPerBatch` | default **500**; `0` means batches are not allowed |
| ③ | events per minute | `429`, `code: "rate_limit_exceeded"`, `Retry-After` | counted **per event**, not per call |

**③ is per event.** A batch of N events uses N units of the same per-minute allowance as the single-event route (§10) —
one shared counter per Access Key, whichever route you use. `RateLimit-Remaining` tells you how many events you can still
send in the current window; if it is smaller than your batch, send a smaller batch or wait for `RateLimit-Reset`.
⚠️ A batch larger than your **whole** per-minute allowance can never be accepted — split it. Ask us for your allowance
when the batch route is enabled.

Batch-level errors (no `results`): `400` malformed body · `401` bad key/signature/timestamp · `413` (①, ②) ·
`422 batch_not_enabled` · `429` (③) · `5xx` platform failure (retry the whole batch with backoff; safe, per §14.2).

## 15. Reading the result after `200`

For some event types the `200` is only the first half of the story: we **store** the event right away and **process** it a
moment later. If processing fails for a business reason, the `200` you already got does not change. You find out by asking.

`POST /api/v1/integrations/deliveries` is the lookup door. Sign it exactly like the event route (§3), and send **exactly one**
of the two keys:

```jsonc
{ "deliveryId": "5b0e…" }      // the value we returned at 200
{ "externalId": "evt-123" }    // your eventId; may match several deliveries
```

```jsonc
// by deliveryId
{ "delivery": {
    "deliveryId": "5b0e…", "externalId": "evt-123", "eventSource": "…",
    "outcome": "ACCEPTED",                       // what the DOOR decided: ACCEPTED | DEDUPLICATED | REJECTED_SEMANTIC | REJECTED_STALE
    "receivedAt": "2026-10-04T10:00:00.000Z",
    "processing": [                              // what happened AFTER the 200
      { "consumer": "reward-payout", "status": "FAILED",
        "errorCode": "settlement_item_not_found", "updatedAt": "2026-10-04T10:00:05.000Z" }
    ] } }
// by externalId: { "deliveries": [ { …same shape… } ] }   (at most 50, newest first)
```

| `processing[].status` | Meaning | You do |
|---|---|---|
| `PENDING` | not processed yet | wait; ask again in a few seconds |
| `SUCCEEDED` | processed | nothing |
| `FAILED` | failed, and we retry automatically a few times | read `errorCode` |
| `DEAD` | failed and we stopped retrying | read `errorCode`; contact us if it is a code you cannot fix |

- **Today only `POINT_REDEEMED` has a `processing` list** (one entry, `consumer: "reward-payout"`). For every other event type, and for
  a delivery we rejected at the door, `processing` is an empty list: nothing is promised there.
- **`errorCode` is a code, never a sentence.** It is `null` unless the status is `FAILED` or `DEAD`. The codes are in
  [error-codes.md](./error-codes.md#asynchronous-processing-codes--processingerrorcode); a failure we do not publish a code for is
  reported as `processing_error`.
- **You only ever see your own deliveries.** A delivery that belongs to someone else answers exactly like one that does not
  exist: `{ "delivery": null }`.
- **Resending the same `eventId` does not run the work again.** After you fix the cause, send the event with a **new**
  `eventId`; keep the same `redemptionRef` for the same payment, so it is recorded exactly once.
- An empty list from `externalId` means "we have no delivery with that id", not "you never sent it".

