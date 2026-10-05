# Program Link — partner technical integration guide

[Start here](README.md) · [Credentials](credential-derivation.md) · [Generic transport](event-ingestion.md) · [Recovery](recovery.md)

This guide describes the implemented PROGRAM_LINK 1.0 profile. It covers external order attribution and SKU commission; a successful request does not prove attribution, commission issuance, Finance confirmation or payment. Live partner capture verification is a separate launch requirement.

## 1. Endpoints and anonymous buyers

Send server-to-server callbacks to `POST /api/v1/integrations/events`. The short navigation URL is `GET /l/:linkRef` (the prefixed `/api/v1/l/:linkRef` alias also exists); it redirects to the configured shop destination with tracking parameters. Fixed, pasted-URL and product links use the same callback contract. Do not call the removed `/integrations/link-conversions` endpoint.

Campaign LAUNCH is **not** required for this Link profile. The buyer can check out without Creator-OS login. `externalUserId` may be omitted for a valid LINK_ORDER_* + PROGRAM_LINK payload. If supplied, it is your opaque buyer/session identifier, not the publisher/CTV receiving the commission. Keep it stable across retries. Do not fabricate it from link_ref, click_ref or a publisher account. Legacy Reward profiles retain their externalUserId/LAUNCH requirements.

## 2. Setup before sending orders

1. Obtain the installation origin, accessKey, masterSecret and EVENT channel version. Derive the EVENT key using the credential contract; keep secrets server-side.
2. The installation operator maps each required `LINK_ORDER_*` type for this credential to the correct registered source namespace. A source must be active, DISCRETE, ECONOMIC_EVENT and ATTRIBUTED or NONE. Payload tenant/source fields cannot grant authority.
3. The Program operator enables/publishes Link and selects allowed event-source UUIDs. Issued tools freeze the selected source set; changing Program configuration does not upgrade old tools.
4. Provide exact external order/product/SKU identifiers. For commission, the operator must establish one eligible same-tenant NATIVE Commerce source with `CommerceSource.eventSourceCode == EventSourceRegistry.code` and matching `identityScopeId`, plus exact external Product/SKU refs. This is not matching CommerceSource.code, display name or shop label. Product/SKU aliases must already exist at or before `transaction.createdAt`; mapping backfilled after the order anchor cannot repair original qualification. Missing/ambiguous mapping blocks money. There is no automatic mapping from product names, URL parsing or matching IDs across shops.
5. Publish eligible SKU commission Terms before the order-created anchor. The policy is pinned at `transaction.createdAt`, independently of the link destination revision. No later rate publication repairs a missing original commitment.
6. Demonstrate tracking through your real checkout chain for platform capture review: same-device last-click scope, redirects, login, payment and order binding. VERIFIED capture authority must already apply at click and order anchor. A signed callback alone is insufficient; there is no partner-supplied flag to bypass this gate.

A product-only callback can resolve commission only when that product has exactly one variant, counting inactive variants, and that sole variant is eligible/active. One active plus one inactive is ambiguous. Prefer explicit `externalSkuId`. Native orders already owned by Sales, or awaiting native acceptance, cannot receive a second Link commission; future native aliases are also fenced.

## 3. Capture tracking at the shop

Read `source=creatoros`, `link_ref` and `click_ref` from the landing URL. Preserve exact UUID values across your checkout flow and bind the selected click to the order when the order is created. Each redirect creates a new click_ref. Keep tracking immutable for subsequent snapshots of that order; a later visit must not replace it. `sub1..sub3` are optional reporting labels, not identity; do not include them in the strict conversion.tracking object.

Use the actual eligible last click for the same buyer/device, never an arbitrary recent click from another buyer. Current attribution window is 30 days from click to order-created anchor, inclusive; the anchor cannot precede the click. Creator-OS evaluates consent, historical Program activity and allowed source as well. Cross-device attribution is not guaranteed. Do not expose credentials or buyer PII in URLs.

The schema permits missing refs so the event can be retained as unresolved; successful attribution requires a valid click_ref (link_ref can be derived from that click, but send both). A random example UUID is syntactically valid, not attribution evidence.

## 4. Events: what to send and when

| Outer type / inner type | Send when | Remaining snapshot |
|---|---|---|
| LINK_ORDER_CREATED / ORDER_CREATED | Order created; send promptly, before later states | Original complete lines, positive quantity; predecessor null |
| LINK_ORDER_COMPLETED / ORDER_COMPLETED | Your registered completion milestone occurs | Complete current lines; qualified commission may now ISSUE |
| LINK_ORDER_RETURNED / ORDER_RETURNED | Partial/full return changes remaining basis | All original lines, remaining quantity/net, including zero lines |
| LINK_ORDER_CANCELLED / ORDER_CANCELLED | Order cancelled | Every original line quantity0 and merchandiseNetMinor "0" |
| LINK_ORDER_CORRECTED / ORDER_CORRECTED | Explicit correction of immediate predecessor | Full corrected state plus correction evidence |

Completion must correspond to the milestone agreed in your source registration; Creator-OS does not infer paid/delivered/return-window semantics from a shop status. CREATED commits a promise, not paid earnings. Return/correction adjusts cumulative targets using original rates; Finance handles adjustment history separately. No callback can authoritatively choose a payee, commission rate, PAID status or settlement.

## 5. Full CREATED payload

Replace both tracking UUIDs with values captured from a real redirect and external IDs with your mapped namespace identifiers. All dates are UTC ISO-8601; occurredAt is business event time, not send time. Outer eventId/occurredAt must equal the inner values, and outer type must equal `LINK_` + inner type.

```json
{
  "specversion": "1.0",
  "eventId": "order-1001-created",
  "type": "LINK_ORDER_CREATED",
  "occurredAt": "2026-10-03T03:00:00Z",
  "payload": {
    "profile": "PROGRAM_LINK",
    "schemaVersion": "1.0",
    "conversion": {
      "contractVersion": "1.0",
      "snapshotKind": "FULL_STATE",
      "eventId": "order-1001-created",
      "type": "ORDER_CREATED",
      "occurredAt": "2026-10-03T03:00:00Z",
      "transaction": {
        "externalOrderId": "order-1001",
        "sourceRevision": "1",
        "previousSourceRevision": null,
        "createdAt": "2026-10-03T03:00:00Z"
      },
      "tracking": {
        "source": "creatoros",
        "link_ref": "11111111-1111-4111-8111-111111111111",
        "click_ref": "22222222-2222-4222-8222-222222222222"
      },
      "money": { "unit": "MONEY", "denomination": "VND", "scale": 0 },
      "lines": [{
        "externalLineId": "line-1",
        "externalProductId": "product-42",
        "externalSkuId": "sku-42-red",
        "quantity": 2,
        "merchandiseNetMinor": "150001",
        "taxMinor": "15000",
        "shippingMinor": "20000"
      }]
    }
  }
}
```

`externalUserId`, `seq` and `confidence` are optional common-envelope fields; seq is a sender stream sequence, not an order revision or predecessor. The conversion/profile/transaction/line objects are strict: no custom fields. Keep order/line IDs stable (1–200 characters). Lines:1–100, unique externalLineId; quantity integer0–10000. Minor amounts are nonnegative decimal strings up to24 digits, no signs/decimal points/leading zero except "0". Money unit MONEY; denomination uppercase identifier, scale0–18 in transport, but current commission supports only VND/scale0 and blocks unsupported/range-invalid money. Merchandise net is the total remaining line merchandise value after discounts, excluding tax/shipping, not a per-unit price; never compute it from current catalog price.

## 6. Revisions, returns and corrections

Use increasing positive integer strings for sourceRevision (up to20 digits); previousSourceRevision names the exact prior accepted order snapshot. They need not be consecutive numerically. First CREATED has predecessor null. New business events have new eventId; transport retry reuses the original eventId/body. Send FULL_STATE every time, retaining every original line and its product/SKU ID even after a full return. CreatedAt, tracking, denomination/scale and line identities cannot change. Quantity and merchandise net cannot exceed original values. Non-correction updates cannot increase either relative to the previous snapshot; occurredAt cannot regress.

Example sequence derived from the CREATED body above (each row replaces both envelope and inner eventId/type/occurredAt; unchanged fields remain present):

| EventId | Outer type | occurredAt | Revision / predecessor | quantity / merchandiseNetMinor |
|---|---|---|---|---|
| order-1001-completed | LINK_ORDER_COMPLETED | 2026-10-03T04:00:00Z | "2" / "1" | 2 / "150001" |
| order-1001-returned | LINK_ORDER_RETURNED | 2026-10-04T04:00:00Z | "3" / "2" | 1 / "75001" |
| order-1001-corrected | LINK_ORDER_CORRECTED | 2026-10-04T05:00:00Z | "4" / "3" | 2 / "150001" |
| order-1001-cancelled | LINK_ORDER_CANCELLED | 2026-10-04T06:00:00Z | "5" / "4" | 0 / "0" |

For revision4, add only to conversion:

```json
{ "correction": { "reason": "Return record entered in error", "correctsSourceRevision": "3", "resultingState": "COMPLETED" } }
```

Correction is required only on ORDER_CORRECTED; reference must match previousSourceRevision. It can increase remaining basis within the original ceiling and select CREATED/COMPLETED/RETURNED/CANCELLED. A corrected cancellation must still be zero. Ordinary transitions: CREATED→COMPLETED/CANCELLED; COMPLETED→COMPLETED/RETURNED/CANCELLED; RETURNED→RETURNED/CANCELLED; CANCELLED has no ordinary successor. Reopening requires explicit correction evidence.

Partial return is cumulative remaining value: do not send the refund delta as remaining net. Tax/shipping remain explicit nonnegative amounts; cancellation requires zero quantity/net (set tax/shipping to actual remaining amounts, commonly zero). Original line identities cannot be removed or replaced by a new SKU, even through correction.

## 7. Sign and deliver

HMAC-SHA256 over exact bytes `X-Timestamp + "." + rawBody`. X-Timestamp is Unix **seconds**, within ±5 minutes. X-API-Key is the accessKey; X-Signature is lowercase hex, optionally prefixed `sha256=`. EVENT channel key is the base64url string derived from masterSecret, used as-is for HMAC. Synchronize your clock and use HTTPS.

```js
// Node.js. Keep credentials on your server. Read body.json once; send these bytes.
const { readFileSync } = require('node:fs');
const { hkdfSync, createHmac } = require('node:crypto');
const eventKey = Buffer.from(hkdfSync(
  'sha256', Buffer.from(process.env.MASTER_SECRET, 'base64url'), Buffer.alloc(0),
  Buffer.from(`integration:channel:EVENT:v${process.env.EVENT_VERSION}`, 'utf8'), 32,
)).toString('base64url'); // use this STRING as HMAC key; do not decode it again
const rawBody = readFileSync('body.json');
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = 'sha256=' + createHmac('sha256', eventKey)
  .update(Buffer.concat([Buffer.from(timestamp + '.', 'utf8'), rawBody])).digest('hex');
fetch(process.env.CREATOROS_ORIGIN + '/api/v1/integrations/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.ACCESS_KEY,
    'X-Timestamp': timestamp, 'X-Signature': signature },
  body: rawBody,
}).then(async response => console.log(response.status, await response.text()));
```

On retry keep semantic event content, eventId, business dates and any buyer ID identical; generate a fresh signing timestamp/signature. Serialize once and sign/send the same bytes. Never put these secrets in browser/mobile code. For rotation use the supplied channel version and the credential contract, not a guessed key version.

New-event business occurredAt freshness is checked separately from signing headers. Limit precedence is integration `maxDeliveryLatenessMin` / `maxFutureSkewSec`, then installation `PARTNER_MAX_DELIVERY_LATENESS_MIN` / `PARTNER_MAX_FUTURE_SKEW_SEC`, then defaults: `ACCRUAL_GRACE_DAYS` (30 days if unset) for delivery lateness and 300 seconds future skew. Too-old/future events return422 event_too_late/event_from_future; ask the operator for the configured limits and recovery path, do not change business dates to make old events fresh. Existing accepted duplicates skip the new-event freshness check. This is not the 30-day click attribution window or a guarantee of historical money eligibility.

## 8. ACK, failures and recovery

A successful single-event response is:

```json
{ "eventId": "order-1001-created", "deduplicated": false, "deliveryId": "optional-attempt-reference" }
```

200 means durable common intake accepted/deduplicated the event for asynchronous processing. deliveryId is optional; do not expect a synchronous receiptRef/conversionRef, attribution or commission amount. Persist the response with your outbound event. Deduplicated true is success; do not mint another ID. The worker may later report GAP, ORIGINAL_MISSING, CONFLICT, STALE or unresolved attribution/commission. Receipt/case replay is an operator workflow, not a public partner status/payout callback API.

| Result | Sender action |
|---|---|
| 400 | Fix envelope/profile/schema or mismatched inner/outer fields; do not blindly retry |
| 401/403 | Resolve credentials/signature/clock/access configuration before retry |
| 422 | Resolve registered type/source/schema configuration or identity collision; retain response code/delivery reference |
| 429 | Honor Retry-After when present, apply backoff |
| 5xx or timeout/lost response | Retry same eventId/body with fresh signing headers and bounded exponential backoff |

Same source eventId with different conversion or buyer identity is a collision, not safe dedup. Source order identity is namespace+externalOrderId; channels sharing that namespace must report the same canonical history. An accepted gap does not advance the head: resend missing original/predecessor through the same intake, then ask the operator to replay the already-stored pending receipt. Simply resending a deduplicated gap event does not guarantee projection replay. Do not reset revisions or change eventId to conceal a conflict.

Keep an outbound durable log of eventId, order ID, revision/predecessor, body hash, business dates and each response. Agree optional sender manifest/query/replay capability using [recovery.md](recovery.md); Link does not expose a new dedicated recovery endpoint or guarantee every partner has backfill. The common receiver cannot detect an event you never sent without sender evidence. Program management can inspect source receipts/cases and replay with authorization; a case closure acknowledges an issue but does not create attribution, money or Finance approval.

## 9. Integration verification checklist

- Map all five types and exact source/product/SKU namespace; demonstrate no cross-shop collisions.
- Capture a real redirect through guest checkout/login/payment and preserve both refs at order creation; obtain platform capture review prospectively.
- Validate CREATED→COMPLETED→partial return→correction→cancel, immutable full lines and historical rate pinning.
- Test lost ACK/same-body retry, eventId collision, out-of-order original/predecessor, unresolved tracking and missing SKU.
- Confirm 200 intake separately from accepted fact, attributed order, qualified commission, official EE and Finance readiness. Never infer PAID.
- Keep live capture verification separate from synthetic sandbox examples. New authority cannot retroactively adopt an unverified original click/order.
