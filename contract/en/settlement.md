# Settlement — We notify you when a POINT settlement is ready

Start at: [README.md](./README.md). *(this is the normative version — the Vietnamese copy under
`vi/` is a translation; if they ever disagree, this file wins)*

**Settlement is OPTIONAL**, same as [recovery.md](./recovery.md) — you integrate fully without it.
This document is for partners who want a push notification when we've closed out a point amount for
a user that needs handling on your side (e.g. conversion, internal bookkeeping).

> **Scope today: POINTS ONLY.** There is no equivalent contract for money yet.

🔴 **If you take part, you owe us two things:** answer correctly when we call you (§2.2 and §4), and send
us a `POINT_REDEEMED` event for **every line you paid** (§5). Without the second one the line never
closes on our side.

## 1. What this capability does

Unlike [recovery.md](./recovery.md) (that direction is READ-ONLY, you call us), this is a **WRITE**
direction: once the unit has confirmed the reconciliation and closed the points period (the points move
**once**, at that step, into a ready-to-pay state), our ops creates a payout batch and presses **Pay**.
We then **actively call you**, one notification per line, reporting one user's point amount that is
ready to hand off and needs handling on your side. **Pay only sends**: it does not move points a second time.

🔴 **This is NOT a transfer command.** It is a NOTIFICATION — "this amount is settled, please
process it on your end." You decide what to do with it (credit an internal wallet, convert, record a
liability…).

## 2. We call you — `POST <your settlement endpoint>`

### 2.0 Declaring the address

1. **You** give our ops a URL (the address that receives our `POST`).
2. **Our ops** enters it on your integration's screen, in the **Points receiving** tab. Until it is
   entered, our ops' **Pay** button is locked and says why — there is no way to force a call.
3. The address must be `https://` on the public Internet. We refuse an address that points at
   `localhost`, a private network or a link-local address, and one that carries `user:password` in
   it (a secret does not belong in the address).
4. **Keep the address exactly as you gave it**, character for character: the path and query are part of
   what we sign (§3).

The screen shows **Ready to send points** only when all four of these are true:

| Condition | Why |
|---|---|
| the unit has **exactly one** integration | we never guess which integration to call |
| an address is declared | nothing to call otherwise |
| a **usable SETTLEMENT key** exists | the call is signed with it (§3) |
| the integration has **exactly one** identity provider across its `DIRECT` event sources | we must know which of your identifier spaces `externalUserId` belongs to |

A missing condition is shown with its reason next to the **Pay** button.

### 2.1 Request body

```jsonc
{
  "settlementRef":        "…",     // batch reference — the END of the settled period, ISO 8601 UTC (e.g. "2026-09-30T16:59:59.999Z"); NOT a code that spells out campaign or denomination
  "campaignId":           "…",     // the campaign this batch settles — see below
  "settlementItemId":     "…",     // line reference — echo it back VERBATIM in your POINT_REDEEMED event (§5)
  "partyId":              "…",     // recipient, OUR internal id
  "externalUserId":       "…",     // recipient, YOUR id for this user — the very value you sent us at launch / on events
  "denominationCode":     "…",     // point denomination
  "pointAmount":          "100",   // points — FROZEN at batch creation, never recomputed afterward
  "exchangeRateSnapshot": "10",    // the rate of THIS point denomination, stamped when the batch was created (reference only)
  "moneyAmount":          "1000",  // money equivalent at that rate (reference only)
  "moneyCurrency":        "VND",
  "deliveryNonce":        "…"      // NEW on every real CALL — see §4
}
```

- **`externalUserId` is the field to credit by.** It is the identifier **you** gave us for this user. We
  never send a packet without it: when we cannot read it exactly for a line (none, or more than one),
  the **Pay** action refuses that line on our side and nothing reaches you.
- **`campaignId` tells you which campaign the money belongs to.** One batch settles exactly one campaign,
  so every line of a batch carries the same `campaignId`: the id of that campaign on our side (the same
  id you use in the launch path, `POST /campaigns/:campaignId/launch`). We send it on every packet. In the
  published schema it is not in `required`, and the schema is open (`additionalProperties: true`), as the
  last bullet of this list says: ignore fields you do not recognize. Before the release that added
  `campaignId` the published schema was CLOSED, so a validator built from a COPY of that older schema
  rejects our packets: refresh your copy of `SettlementPacket.json` (or ignore unknown fields) before that
  release reaches you. Two campaigns settled for the same period have the same `settlementRef` but
  different `campaignId`: **never key anything on `settlementRef` alone**.
- `partyId` is our internal id — keep it for logs; do not look users up by it.
- **The unit you receive is the point.** `exchangeRateSnapshot` / `moneyAmount` / `moneyCurrency` are
  shown **for reference only**; we do not convert anything on your behalf and you do not have to pay in
  money. What you do with the points is yours to decide.
- ⚠️ `pointAmount`, `exchangeRateSnapshot` and `moneyAmount` are already-settled numbers, **not inputs for
  you to recompute**. This is our declaration, not an offer to negotiate.
- `exchangeRateSnapshot` is the rate of **this point denomination** at the moment the batch was created (it can have up to six
  decimal places). `moneyAmount` is that rate times `pointAmount`, rounded **half-up to two decimal places per line**. Add up the `moneyAmount` of the lines of a batch if you need a total; it is
  **not** the rate times the total points, and the two can differ by a few cents (for example at a rate of 3.333333). A rate changed after the batch was created does not touch a batch that already exists.
- 🔒 **Every field, including `externalUserId`, sits inside the signed body.** Verify the signature on the
  **raw bytes** you received (§3) — never rebuild the body and then verify it.
- Ignore fields you do not recognize: we may add fields without a new contract version.

### 2.2 What you respond

| Response | What we do with it |
|---|---|
| `2xx` | **received** — the line is marked as sent |
| `409` | **rejected** — you tell us you have already seen this `deliveryNonce` (§4). **Use `409` for this and nothing else** |
| `422` | **rejected** — you refuse the packet for a business reason |
| any other code — `400` · `401` · `403` · `404` · `5xx` | **send failed** — our ops can send again |
| no answer within **10 seconds** | **send failed, answer unknown** — we do not send a new notification for this line; our ops ask again with the same `deliveryNonce` (§4) |
| a `3xx` redirect | **send failed** — we never follow redirects |

- `401`/`403` (your key check failed) are an ordinary failed send on our side — ops can send again, but
  **sending again cannot help until the key is fixed.**
- ⚠️ **Do not answer `409` for anything except a repeated `deliveryNonce`.** Our "Ask partner again" action
  re-sends the *same* packet with the *same* nonce and reads `409` as "the partner already has it" (§4).
  A `409` for another reason would make us mark a line as received that you never processed.
- `2xx` means "you received it" — not "you finished processing it". Take your time after responding.
- **Closing the line is up to you:** a line closes when you report the payment — with `POINT_REDEEMED` (§5), or, if you already know the result when you answer, in the answer itself (§2.2a). It is the same door: it is written once per `redemptionRef`.
- A line can also be **closed without your report**: when the unit has recorded that the payment was made through another channel, we close the line and do not send its packet again. A line is paid only once, so a report that arrives after the line is closed does not deduct points a second time.
- A result can also come in the answer itself: see §2.2a. A bare `200` is **not** a result.

### 2.2a The result in the answer (optional) — `settlement-result.v1`

If you already know the result when you answer, you may say it **in the answer itself**, so the line closes
without a second call. It counts **only** when the answer has exactly this shape. The status `200` alone
does not: a bare `200`, an empty body, a body of another shape, or a body over 4 KB is only **"received"**
(§2.2), and the result still reaches us with `POINT_REDEEMED` (§5), exactly as before.

```jsonc
// HTTP 200, Content-Type: application/json, body ≤ 4 KB
{
  "schemaVersion":    "settlement-result.v1",
  "result":           "PAID",                       // the only value in v1
  "deliveryNonce":    "…",                          // copy VERBATIM from the packet you just received
  "settlementItemId": "…",                          // copy VERBATIM from the packet
  "redemptionRef":    "PAYOUT-88213",               // YOUR reference of this payment, 1–128 characters, unique
  "amountMinor":      1000,                         // integer, the amount you paid in the smallest unit (VND × 1)
  "currency":         "VND",                        // 3 letters, the currency of the packet
  "paidAt":           "2026-11-05T07:30:12.000Z"    // ISO 8601 UTC, when you paid; not later than 5 minutes after we receive it
}
```

**It is official only when ALL of these are true** (miss one and it is only "received"):

1. the status is exactly `200`, the content type is `application/json`, the body is at most **4 KB** and is valid JSON;
2. all seven fields are there with the right type (`amountMinor` an integer, `paidAt` an ISO 8601 UTC time ending in `Z`, `redemptionRef` 1–128 characters). Fields we do not know are ignored;
3. `schemaVersion` is `settlement-result.v1` and `result` is `PAID`;
4. `deliveryNonce` and `settlementItemId` are **the ones of the packet we just sent** (this ties the answer to this send; an old answer cannot be reused for another line).

**Then we compare the number**, with the same check we apply to `POINT_REDEEMED`:

| What you answered | What we do |
|---|---|
| right shape, `amountMinor` and `currency` **equal** the stamped amount of the line, the line can still be paid | the line is **matched** now and the points are marked as paid, **once**, by `redemptionRef` |
| right shape, but the amount or the currency **differs** | the line shows **"Partner reported a mismatch"**. Nothing is booked; our ops and you reconcile |
| right shape, but the line can no longer accept a result (already confirmed with another reference, excluded, its batch not confirmed) | nothing changes on the line; it is only "received" |
| anything else (see above) | only **"received"**; wait for `POINT_REDEEMED` |

- **One payment, one record.** If you answer with a result **and** later send `POINT_REDEEMED` with the **same**
  `redemptionRef`, it is recorded once. The second is told "already recorded". A **different** `redemptionRef`
  for the same line is refused: one line is paid once.
- **Asking again.** *Ask partner again* re-sends the same packet with the same `deliveryNonce`. If you have
  already seen it, answer `409` (§4); **the body of a `409` is ignored**, and the result reaches us with
  `POINT_REDEEMED`.
- **No separate signature on the answer.** We protect it by calling only the `https://` address you declared,
  never following a redirect, and tying it to the packet with `deliveryNonce` and `settlementItemId`. We keep the
  SHA-256 of the body and your `redemptionRef` in our audit trail, never the body itself.
- ⚠️ `2xx` still means "received". Only the shape above means "paid". Do not put `result: "PAID"` in an answer
  for a line you have not paid.

## 3. We authenticate ourselves to you — `PartnerSettlementSignatureV1`

🔒 **A SEPARATE signing scheme from `PartnerRecoverySignatureV1`**
([recovery.md §4](./recovery.md#4-we-authenticate-ourselves-to-you--partnerrecoverysignaturev1)),
sharing the underlying HMAC-SHA256 mechanics but kept distinct because this is a **WRITE**, not a
harmless read. The RECOVERY channel secret and the SETTLEMENT channel secret are **separate** — never
share them; one leak would compromise both directions.

```text
signing_string = <X-Platform-Timestamp>  +  "."
               + <METHOD, UPPERCASE — always "POST">  +  "."
               + <path + query, EXACTLY as on the request line>  +  "."
               + <raw request body bytes>

signature      = "sha256=" + lowercase_hex( HMAC-SHA256( SETTLEMENT_SECRET, signing_string ) )
```

| Header | Carries |
|---|---|
| `X-Platform-Key-Id` | the key identifier. It is the **same value for every version** of the key, so it does **not** tell you which secret signed: try the secrets you have, newest first (see *Key rotation* below) |
| `X-Platform-Timestamp` | Unix seconds |
| `X-Platform-Signature` | `sha256=<lowercase hex>` |

**±5 minute freshness window**, same number as every other signing scheme in this doc set.

**Key rotation.** The SETTLEMENT key is derived ([credential-derivation.md](./credential-derivation.md)). `X-Platform-Key-Id` **does
not change** when we rotate, and the moment a rotation completes **we sign with the new key**. So: agree the date with our
operations team; derive and load the new version **before** the rotation completes, and in any case before our operations team presses **Pay** or **Retry** next (it is always the current version plus
one); accept **both** secrets and try them newest first; drop the old one only after we tell you it is revoked. If the new
key is not loaded in time, our send fails with `401` for a short while: load the new key, then ask our operations team to send again — it is a failed send, not a lost settlement.
The reference receiver takes several secrets for one key id (`SETTLEMENT_SECRETS=<new>,<old>`, see [testing.md §1.6](./testing.md#16-settlement-channel--8-cases-run-separately)).

A worked example with a fixed secret, timestamp and body is in [testing.md §2.6](./testing.md#26-settlement-channel--partnersettlementsignaturev1).

**Reference verify code (Node.js)** — identical to
[recovery.md §4](./recovery.md#4-we-authenticate-ourselves-to-you--partnerrecoverysignaturev1), just
looking up the secret under the SETTLEMENT channel:

```js
function verifySettlementSignature(req, settlementSecrets) {
  // settlementSecrets: every secret you have for this channel, newest first. `X-Platform-Key-Id` is the same for every version, so it cannot pick one
  const ts    = Number(req.header('X-Platform-Timestamp'));
  const given = req.header('X-Platform-Signature') || '';

  // 1. ±5-minute freshness, rejects both directions
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts * 1000) > 5 * 60_000) return false;

  // 2. req.originalUrl = path + query EXACTLY as received. req.rawBody = raw bytes, pre-JSON-parse
  const base = Buffer.concat([
    Buffer.from(`${ts}.${req.method.toUpperCase()}.${req.originalUrl}.`, 'utf8'),
    req.rawBody ?? Buffer.alloc(0),
  ]);

  // 3. Try each secret in turn; constant-time comparison — do NOT use ===
  const b = Buffer.from(given);
  return settlementSecrets.some((secret) => {
    const a = Buffer.from('sha256=' + crypto.createHmac('sha256', secret).update(base).digest('hex'));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
```

A complete reference receiver you can run and adapt is `examples/node/settlement-receiver.mjs` in the
public repository; [testing.md §1.6](./testing.md#16-settlement-channel--8-cases-run-separately) lists the
eight cases that check it.

## 4. Replay protection — TWO obligations, not one

🔴 **Signature + freshness window are NOT ENOUGH for a WRITE operation.** Unlike RECOVERY (read-only
— a replay within 5 minutes is harmless), this operation has real side effects (you may credit a
wallet or record it on your side). The `deliveryNonce` in the request body (§2.1) covers that gap, and
it requires **both sides**:

- **YOUR obligation**: you **MUST** reject a `deliveryNonce` you've seen before for the same key — not
  just rely on the ±5 minute window — **and you MUST answer `409`**. Keep a record of the nonces you
  have seen (a log you check before processing).
- **OUR obligation**: a nonce is never reused for a *new* send. There are **two ways** we send, and they
  differ on purpose:

| Our ops clicks | Nonce | What it is for |
|---|---|---|
| **Pay** (first time) or **Retry** (after a send that failed with an HTTP answer, not after a timeout) | a **NEW** nonce | a fresh notification. The same `settlementItemId` can appear in several requests, each with its own nonce |
| **Ask partner again** (on a line still marked as in flight, e.g. our system stopped before it heard your answer) | the **SAME** nonce as the original call, same packet | to learn whether you already have it. If you **never saw** it, you process it now and answer `2xx`. If you **already have** it, you answer `409` and we close the line as sent |

That is why `409` is **mandatory** (not "recommended") and why it must mean exactly "I have already seen
this `deliveryNonce`": it is the only way "Ask partner again" can tell *received* from *rejected*.

⚠️ **Don't confuse `deliveryNonce` with `settlementItemId`.** Your duplicate check is on `deliveryNonce`.
Deduplicating on `settlementItemId` would wrongly reject a legitimate **Retry**.

🔒 **Our own safeguard.** Once a settlement item is already closed on our side — you confirmed it
matched, or you reported a mismatch we haven't resolved yet — our system refuses to send it again: the send fails on our side before any
network call reaches you. You will not receive two independent notifications for the same economic
event through this channel unless ops explicitly reopens the item first.

If you still have a packet you have not processed for a long time, ask the unit before paying it: the line may already have been closed through another channel. Paying it then is paying twice on your side, and we record no further points for a closed line.

⚙️ Same operational commitments on our side as RECOVERY: **we do not follow `3xx` redirects**, your
endpoint must be **`https://`** on the public Internet (no loopback/private network), **10 second**
timeout per call.

## 5. After you pay — report it with `POINT_REDEEMED`

For **every line you paid**, send us a `POINT_REDEEMED` event through the normal events door, as
described in [event-ingestion.md](./event-ingestion.md#15-reading-the-result-after-200) and its
`POINT_REDEEMED` section. Send it once you have actually paid; it is what closes the line on our side.

- We match the event to the line by **`settlementItemId`** — copy it **verbatim** from the packet. We do
  **not** match by `externalUserId`.
- Send `externalUserId` in the envelope as usual: it is the very value you received in the packet.
- 🔴 **If you never send it**, nothing breaks, but the line stays open: after **7 days** (default) it
  appears on our ops' **overdue** list, and ops will chase you for it.
- Using `POINT_REDEEMED` requires that your integration is allowed to send that event type on the
  order source — ask our ops to enable it when you declare the settlement address.

## 6. Operations

| | |
|---|---|
| Who triggers it | **our ops**, pressing **Pay** on screen — there is NO job that starts sending by itself |
| Bulk send | **sequential**, never parallel (**Send all**). **From release v1.4.1** a Reward campaign is paid with ONE button (**Pay**) that runs in the background: it only sends, one notification per player (the points already moved once, when the period was closed; **Pay** does not move them again), **at a default pace of 10 notifications per second per integration** (adjustable per unit). At that pace 6,642 lines take about **11 minutes** when you answer in under 100 ms per line; if you answer more slowly, the sending time is about *number of lines × your answer time per line* (for example 200 ms per line is about 22 minutes) |
| If you stop answering | **From v1.4.1:** after **20 failed sends in a row** (no answer in 10 seconds, or a non-`2xx`/`409`/`422` answer) the run **pauses by itself** and shows our ops *"the partner is not answering"*; ops presses **Resume** once you are ready and we send only the lines not yet sent. A configuration error on our side (no address, no key) stops the whole run at once |
| Send again after a failure | ops clicks **Retry** (from v1.4.1 also **Retry failed lines** for a whole run) — new nonce, same `settlementItemId` — except after "no answer within 10 seconds": then only **Ask partner again** (same nonce) |
| The address changed after the batch was created | at the moment ops presses **Pay** we check that the channel is still usable and send to the **current** address (from v1.4.1) |
| A line left in flight | ops clicks **Ask partner again** — same packet, same nonce (§4) |
| Send status | readable on our operations screen, **separate** from whatever you've told us through another channel about that item |

> The **Requeue** action on our screen is a different thing: it re-queues a packet *you sent to us* that
> got stuck while we were processing it. It never re-sends anything to you.

### The statement file (`.xlsx`)

Our ops can also download the batch's statement as a spreadsheet to hand to you. Columns, **in this
order**:

| # | Column header | Meaning |
|---|---|---|
| 1 | Mã đợt | batch reference — `settlementRef` |
| 2 | Mã dòng | line reference — `settlementItemId`; **copy it into your `POINT_REDEEMED` event** |
| 3 | Mã người chơi | our internal id — `partyId` |
| 4 | Mã người chơi (đối tác) | **your** id for the user — `externalUserId`; **empty** when we cannot read it exactly (the line state says why) |
| 5 | Mệnh giá điểm | point denomination |
| 6 | Số điểm | points |
| 7 | Tỷ giá đã đóng dấu | stamped rate (reference only) |
| 8 | Thành tiền | money equivalent (reference only) |
| 9 | Đơn vị tiền | currency |
| 10 | Trạng thái dòng | line state |
| 11 | Lý do loại | reason, for a line left out of this period |

Read columns **by header**, not by position: column 4 is new and every column after it moved right by
one (see [changelog.md](./changelog.md)).

## 7. Step by step: build your receiver and go live

A path for the developer who starts from nothing. Each step names the section that holds the detail.

| # | You do | Done when |
|---|---|---|
| 1 | Read [credential-derivation.md](./credential-derivation.md) and derive the **SETTLEMENT** key from your `masterSecret` (a different key from RECOVERY and EVENT) | you can reproduce the test vector |
| 2 | Build one **HTTPS** endpoint that accepts `POST` with a JSON body ([§2](#2-we-call-you--post-your-settlement-endpoint)) and give its address to our ops ([§2.0](#20-declaring-the-address)). Keep the address character for character | our ops see **Ready to send points** |
| 3 | In the handler, **in this order**: (a) verify the signature on the **raw bytes** and the ±5-minute window, answer `401` if it fails ([§3](#3-we-authenticate-ourselves-to-you--partnersettlementsignaturev1)); (b) read `deliveryNonce`: if you have seen it, answer `409` and stop ([§4](#4-replay-protection--two-obligations-not-one)); (c) validate the body, answer `422` if you refuse for a business reason; (d) store the line (`settlementItemId`, `externalUserId`, `pointAmount`, `deliveryNonce`) **before** answering; (e) answer `2xx` | the conformance cases ([testing.md §1.6](./testing.md#16-settlement-channel--8-cases-run-separately)) pass |
| 4 | Pay the player by **`externalUserId`**, at most **once per `settlementItemId`** in your own records: a **Retry** carries the same `settlementItemId` with a new `deliveryNonce`, so if you already applied that line, answer `2xx` and do **not** apply it again. (Reject on `deliveryNonce` only; never answer `409` for a repeated `settlementItemId`) | a replayed line is never applied twice |
| 5 | Answer fast (well under 10 seconds) and **do the real work after answering**. Slow answers count as failed sends, and 20 in a row pause the whole run ([§6](#6-operations)) | your p99 answer time is a few hundred milliseconds |
| 6 | After you **really paid** a line, send the `POINT_REDEEMED` event with that line's `settlementItemId` copied verbatim and the **exact** amount of the statement ([§5](#5-after-you-pay--report-it-with-point_redeemed), [event-ingestion.md](./event-ingestion.md)) | the line shows **Matched** for our ops |
| 7 | On the **sandbox**, send yourself a test notification (`POST /api/v1/integrations/settlement/test`, [testing.md §1.7](./testing.md#17-send-yourself-a-test-settlement-notification-sandbox-only)); the first answer must be `2xx`, the same nonce repeated must be answered `409`. The sample is **not** a real line: do not book it | the test answers `SENT_OK` |
| 8 | Ask our ops to enable the `POINT_REDEEMED` event type on your integration and agree the go-live date ([go-live.md](./go-live.md)); then they pay a **small first batch** and watch the first lines close | the first real line is **Matched** |

**What our ops see for each of your answers** (so you can tell what happened from the other side):

| You answered | Our ops see on the line |
|---|---|
| `2xx` | *Waiting for partner* (received, not yet reported paid) |
| `200` with the `settlement-result.v1` shape (§2.2a), same amount | *Partner confirmed* (**Matched**) right away: the line is closed |
| `200` with the `settlement-result.v1` shape, another amount | *Partner reported a mismatch*: **nothing is applied**, ops contacts you |
| `2xx`, then `POINT_REDEEMED` with the exact amount | *Partner confirmed* (**Matched**): the line is closed |
| `2xx`, then `POINT_REDEEMED` with another amount | *Partner reported a mismatch*: **nothing is applied**, ops contacts you |
| `409` on a first send | *Partner rejected* |
| `422` | *Partner rejected*, with the reason shown as a label |
| anything else | *Send failed* (ops can **Retry**) |
| no answer in 10 seconds | *Send failed, answer unknown* (we **ask again**, same nonce) |
| no `POINT_REDEEMED` after 7 days | the line is flagged **Overdue**; ops asks you for it |

**Tell us as soon as** your endpoint changes address ([go-live.md B.3](./go-live.md#b3-you-need-to-change-the-address-that-receives-settlements)), you rotate the key ([§3](#3-we-authenticate-ourselves-to-you--partnersettlementsignaturev1)), or you will be down for a while: a long outage pauses a run (above), and lines stay open until you report them.

## 8. Checklist

```text
[ ] Give our ops an https:// address that receives the notification (§2.0)
[ ] Ask our ops to enable the POINT_REDEEMED event type for your integration (§5)
[ ] Derive the SETTLEMENT channel key from masterSecret (see credential-derivation.md) — SEPARATE from the RECOVERY key
[ ] Implement PartnerSettlementSignatureV1 verification on the RAW body (§3)
[ ] Credit by externalUserId, not by partyId (§2.1)
[ ] Keep a record of seen deliveryNonce values and answer 409 for a repeat — 409 for nothing else (§4)
[ ] Apply a line at most once per settlementItemId in your own records; answer 2xx (not 409) to a Retry of a line you already applied (§7 step 4)
[ ] Return 2xx once received, well under 10 seconds — you don't need to finish processing before responding 2xx; 20 failed sends in a row pause the whole run (§6)
[ ] Send POINT_REDEEMED for every line you paid, with settlementItemId copied verbatim (§5)
[ ] Run the settlement conformance cases against your endpoint (testing.md §1.6) and send yourself a sandbox test notification (testing.md §1.7)
```
