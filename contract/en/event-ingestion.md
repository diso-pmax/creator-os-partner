# EVENT Channel — Event Ingestion Contract

**Version 1.0 · 2026-08-25** · Start here: [README.md](./README.md).

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
API='https://<your-sandbox-host>/api/v1'
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
| `externalUserId` | string | **YES** | Your user's identifier | 🔴 MUST equal `externalUserId` on the LAUNCH channel, same format/case, for the same user (README) |
| `type` | string | **YES** | Event category | MUST be one of the closed catalog in §5.2; case-sensitive |
| `occurredAt` | RFC 3339 / ISO-8601 | **YES** | When the business event happened | timezone MUST be UTC (`Z`) |
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
{ "orderId": "SO-99881", "amountMinor": 250000000, "currency": "VND" }
```

`UI_ACTION` — **`actionKey` is REQUIRED**:

```jsonc
{ "actionKey": "BRAND_CLICK" }
```

🔴 **We define `actionKey`; you send that exact string.** It is the only thing that tells UI behaviors
apart — `UI_ACTION` is **one** type shared by every UI behavior, so without `actionKey` nobody knows
which behavior you just reported.

| Behavior | `actionKey` to send |
|---|---|
| user clicks a brand in Cashback Shopping | `BRAND_CLICK` |

⚠️ **Case-sensitive, compared as a raw string.** `BRAND_CLICK` ≠ `brand_click` ≠ `Brand_Click`. Get the
case wrong and the event is **still accepted and still returns `200`**, but the entitlement tied to that
behavior is **never counted** — and no error is raised to tell you.

⚠️ **Omitting `actionKey`** ⇒ `422 payload_field_missing` (see [error-codes.md](./error-codes.md)).

Beyond `actionKey` the shape is open — extra fields are stored verbatim and ignored, they never cause
an error.

Three fields you MUST NOT send inside `payload`: an internal `eventId`/`deliveryId` alias, anything
named `subject`, and any field intended to identify the user other than the top-level `externalUserId`.

## 6. `eventId` vs. `deliveryId` — do not confuse them

> **`eventId` identifies the business event.** You generate it. It MUST NOT change between retries of
> the same real-world event.
>
> **`deliveryId` identifies one delivery attempt.** We generate it. Each retry MAY get a new one.

```text
eventId = evt-123
   ├── delivery attempt #1   deliveryId = del-001   →  deduplicated: false
   └── delivery attempt #2   deliveryId = del-002   →  deduplicated: true
```

⭐ **Record `deliveryId` on your side.** When something goes wrong, it is the one term both sides can
use to refer to the exact same delivery attempt — instead of describing "the one around 9am".

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
| `429` | Rate limited | — | read `Retry-After`, wait, resend |
| `5xx` | Platform failure | — | retry with backoff |

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

**What changes across retries?** `deliveryId` — we mint a new one per delivery attempt (§6).

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

## 11. Recovery

Recovery (reconciliation, backfill, replay) is an **optional** capability, fully described in
[recovery.md](./recovery.md). You are fully integrated without it — see [README.md](./README.md).

## 12. Terminology

| Term | Meaning here |
|---|---|
| **event** | something that happened in your system — a completed order, a cancellation. One event = one `eventId` |
| **delivery** | one HTTP call carrying an event to us. One event MAY have multiple deliveries |
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

**Is there a payload size limit?**
Extra fields are stored verbatim and cause no issue, but do not put an entire business record inside
`payload`. Contact us first if you need to send a large block.
