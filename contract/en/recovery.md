# Recovery — Reconciliation, Backfill, and Replay

**Version 1.0 · 2026-08-25** · Start here: [README.md](./README.md).

**Recovery is OPTIONAL.** You are fully integrated without it, at the `INGEST_ONLY` tier (§5). This
document exists for partners who want to detect and self-heal gaps in event delivery.

## 1. What this capability does

Closing a delivery gap requires two things, and only your side has both: **detecting** it ("what should
I have received?") requires your own record; **fixing** it (resending the actual content) requires your
own data. We can tell you what we currently have; we cannot tell you what you never sent — that
comparison only works with your record as the other half. This is why reconciliation compares
**identity sets** (`eventIds`), not just counts: a count tells you something is off, not which one.

## 2. Reconciliation endpoint — `POST /api/v1/integrations/reconciliation`

Signed **identically** to the event endpoint (`EventIngressSignatureV1`, see
[event-ingestion.md](./event-ingestion.md#3-authentication)) — nothing new to learn.

```jsonc
// request
{ "eventSource": "<your source>", "from": "2026-08-10T00:00:00Z", "to": "2026-08-11T00:00:00Z" }

// response
{
  "eventSource": "…",
  "digestAlgorithm": "v1: sha256(hex) over eventIds sorted ascending, joined by \"\\n\"",
  "windows": [ {                          // newest → oldest
    "windowStart": "2026-08-10T18:00:00Z",
    "windowEnd":   "2026-08-11T00:00:00Z",
    "status":      "CLOSED",
    "eventCount":  3,
    "digest":      "v1:8d3f182a…",
    "eventIds":    ["evt-1", "evt-2", "evt-3"]
  } ],
  "capability": { "tier": "INGEST_ONLY", "meaning": "…", "closesLoop": false }
}
```

⭐ **`eventIds` is what you actually need.** Comparing `eventCount` only tells you "something differs";
comparing the **`eventIds` set** against your own record tells you **which ones** — then resend exactly
those through the [event endpoint you already use](./event-ingestion.md). Over-sending is harmless:
deduplication by `eventId` guarantees no double count.

### 2.1 Recomputing the digest yourself — do this at least once during integration

```text
deduplicate  →  sort ascending  →  join with "\n"  →  sha256  →  lowercase hex  →  prefix "v1:"
```

Worked example: the set `["evt-1","evt-2","evt-3"]` produces

```text
v1:8d3f182a04c6d2bcb51a2e6f0201039af53aa777c6aa18236b3c6eae53083b44
```

⚠️ **Sorting is mandatory.** The two sides will **never** naturally agree on order: you sort by your own
record, we sort by arrival time. Without sorting, the same set produces two different digests and
**every** window reports a mismatch.

⚠️ **10,000-identifier cap per window.** Overflow adds `"eventIdsTruncated": true` — but `eventCount`
and `digest` still cover the **entire** window. You still know for certain whether there is a mismatch;
only the "which ones" list is incomplete. **Do not read a truncated list as "the other side is
missing."**

⚠️ **Windows are anchored on `occurredAt`** (when it happened), not on when we received it. An event
that happened at 07:00 but arrived at 15:00 still belongs to the **06:00–12:00** window. This is why a
grace period exists, and why both sides can compare at all: **the time it happened is the one axis both
sides share.**

| Response | Meaning |
|---|---|
| `200` + `windows: []` | 🔒 the source **does not belong to you**, **or** does not exist — **intentionally indistinguishable**. We do not confirm whether another partner's source is real |
| `400` | `to` is not after `from`, or the range exceeds **30 days** in one call |
| `401` | key, signature, or freshness — same message as the event endpoint |

⚠️ **Reading reconciliation data does NOT count as "using the key."** This endpoint does not mark your
key as active — reading records is not sending events.

### 2.2 Window lifecycle

```text
OPEN → RECONCILED[_WITH_GAPS] → CLOSED
              └── you backfill → reconcile again → RESOLVED
```

| Status | Still accepting events? | Can we conclude "missing"? | Does backfill still count? |
|---|:--:|:--:|:--:|
| `OPEN` | ✅ | ✗ window not over yet | ✅ |
| `RECONCILED` | ✅ *(still in grace period)* | tentative | ✅ |
| `RECONCILED_WITH_GAPS` | ✅ *(still in grace period)* | mismatch seen, **not final** | ✅ **this is the entire point of the grace period** |
| `RESOLVED` | ✅ | ✗ mismatch gone | ✅ |
| `CLOSED` | ✗ | ✅ **final** | events still accepted, but they **do not change** the closed window's conclusion |

### 2.3 Operating cadence

| | |
|---|---|
| Event ingestion | **real-time** |
| Reconciliation cadence / window length | **6 hours** |
| Late-arrival grace period | **24 hours** |
| Window closes | **24 hours after the window ends** |
| Reconciliation evidence retention | program end + 30 days, floor **30 days** |
| Expected recovery horizon on your side | **≥ 7 days** *(only if you declare a recovery capability)* |

⚠️ These are **this platform's operating defaults, not an industry standard** — do not cite the 6-hour
figure as one. And **6 hours is a schedule, not a maximum detection-latency promise**: better capability
on your side detects gaps sooner; the contract itself does not change.

**Why a grace period exists:** *when it happened* **≠** *when we received it*. Without one, we would
conclude "lost" for an event that is merely **arriving late**.

## 3. The reverse direction — when we call you

Everything above is **you calling us**. This section is the other direction.

**Why it exists.** §1 already established: our records can never prove "you never sent that other one."
§2 gives you a door to compare **yourself** — but that door only runs **when you initiate it**. If you
never ask, we **never find out on our own** that we are missing something. ⇒ We need a way to ask you.

### 3.1 We ask three questions — you declare which ones you can answer

| # | Question | Used for |
|:--:|---|---|
| **1** | "Between X and Y, which business events did you send?" | **detecting** a gap |
| **2** | "Resend the event with id Z." | **filling** a gap |
| **3** | "Give me the status of the underlying resource" (an order, a transaction) | detecting, **when you have no concept of "event"** |

**Question 3 exists because you may legitimately have no concept of "event" at all.** Your own record
might only have orders. If the contract forced you to answer question 1, it would implicitly force you
to **build an event store just to integrate** — we do not do that.

### 3.2 🔒 You do not have to build our API shape

The most important point in this section, and it may run against your expectations:

```text
STANDARDIZED     :  the three QUESTIONS above, and the MEANING of their answers
NOT standardized :  the route · the HTTP shape · field names · how you store data internally
```

Already have `GET /orders?from=…&to=…`? Use it. Have `POST /transactions/search`? Use it. Only have an
**end-of-day reconciliation file over SFTP**? That works too. We maintain an **adapter layer** per
partner; your job is to **answer the three questions**, not mimic our shape.

Things we do **not** dictate, and never will: your data store, your internal order model, your queueing
system, your internal API design.

### 3.3 The three answers must be distinguishable from each other

| You return | We understand |
|---|---|
| **cannot answer** *(not supported / error / timeout)* | **no conclusion drawn at all** |
| an **empty** list | "in that range, you genuinely sent nothing" |
| a list with items **+ a continuation cursor** | there is more, we will ask again |

⚠️ **Do not return an empty list when you mean "I could not look this up."** The two produce opposite
conclusions: one says "nothing is missing," the other says "unknown." Returning the wrong one reassures
us **while we are actually losing events** — the most dangerous failure mode.

⚠️ **If you refuse us, return `401` or `403`. Do not return `200` with an empty body.** We distinguish
"you are BLOCKING us" from "you CANNOT answer" from "you genuinely have nothing in that range" — three
different responses drive three different actions on our side.

### 3.4 Cursor-based pagination — the cursor is yours

For a long range, return pages with a **continuation cursor**; we send it back **verbatim** on the next
call, until you report there is no more. We **do not interpret** it — it is your string, encode
whatever you want inside it.

### 3.5 Filling gaps through the endpoint you already have — not a new one

Once a mismatch is identified, you **resend** those events through
`POST /api/v1/integrations/events` — the same endpoint you already use. **There is no second endpoint
to learn.**

⭐ Resending is safe **as long as you keep the same `eventId`**: an event we already have returns `200
deduplicated`; a missing one is recorded. You do **not** need to know precisely which ones are
missing — **resending the whole range is also correct.**

⚠️ This protection only covers **the same `eventId`**. Minting a new id for an event you already sent
gives deduplication nothing to compare against, and that event is counted a second time — see
[event-ingestion.md § Deduplication](./event-ingestion.md#7-deduplication-behavior).

## 4. 🔒 We authenticate ourselves to you — `PartnerRecoverySignatureV1`

You will never have to open an endpoint for a caller that **cannot prove who it is**. This is the
signature scheme we use when calling you, published **before** any real call so you can build and test
verification before opening the door.

```text
signing_string = <X-Platform-Timestamp>  +  "."
               + <METHOD, uppercase>     +  "."
               + <path + query, EXACTLY as on the request line>  +  "."
               + <raw request body bytes — empty string if there is no body>

signature      = "sha256=" + lowercase_hex( HMAC-SHA256( RECOVERY_SECRET, signing_string ) )
```

| Header | Carries |
|---|---|
| `X-Platform-Key-Id` | which of our keys signed this — **use it to look up the right secret**, and it is what makes key rotation possible without downtime |
| `X-Platform-Timestamp` | Unix seconds |
| `X-Platform-Signature` | `sha256=<lowercase hex>` |

⚠️ **This scheme is different from `EventIngressSignatureV1`, deliberately.** The direction you call us
has exactly **one** endpoint, always with a body — so signing `timestamp + body` is enough. This
direction's endpoint is **yours**, and many partners will expose a bodyless `GET
/orders?from=…&to=…`. If we only signed `timestamp + empty body`, one valid signature would work for
**every** `GET` call in a 5-minute window — anyone who intercepts one call could redirect it to a
different resource of yours, and your verification would **still say valid**.

⇒ The signing string covers **method + path + query + body**. The hashing primitive is **identical** —
reuse the exact HMAC-SHA256 code you wrote for the other direction, just change the string being signed.

**Reference verification (Node.js):**

```js
const crypto = require('node:crypto');

function verifyPlatformSignature(req, secretsByKeyId) {
  const keyId = req.header('X-Platform-Key-Id');
  const ts    = Number(req.header('X-Platform-Timestamp'));
  const given = req.header('X-Platform-Signature') || '';

  // 1. ±5-minute freshness, rejects both directions
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts * 1000) > 5 * 60_000) return false;

  // 2. Secret looked up by keyId — lets BOTH secrets stay valid during rotation (§5)
  const secret = secretsByKeyId[keyId];
  if (!secret) return false;

  // 3. req.originalUrl = path + query EXACTLY as received. req.rawBody = raw bytes, pre-JSON-parse
  const base = Buffer.concat([
    Buffer.from(`${ts}.${req.method.toUpperCase()}.${req.originalUrl}.`, 'utf8'),
    req.rawBody ?? Buffer.alloc(0),
  ]);
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(base).digest('hex');

  // 4. Constant-time comparison — do NOT use ===
  const a = Buffer.from(expected), b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

⚠️ **Use the path exactly as received — do not re-normalize it.** The exact character sequence on the
request line — do not reorder the query, do not re-encode `%`. Re-normalizing makes a **correct**
signature fail intermittently.

⚠️ **There is a failure source outside your code on this direction — check it first.** Many reverse
proxies, API gateways, and CDNs **normalize `%`-encoding, collapse `//`, or reorder query parameters**
before the request reaches your signature-checking code. When that happens, **your code is entirely
correct and the signature still fails.**

⇒ If in doubt, **log the exact request line your verification layer actually sees** and compare it to
what we sent. A mismatch there is an infrastructure-layer issue, not a key issue — and it is the
easiest place to waste time looking in the wrong direction.

**±5-minute freshness**, the same figure as [event-ingestion.md §3](./event-ingestion.md#3-authentication),
rejects both directions.

🔒 **This Secret Key is entirely separate from your EVENT channel key** — issued separately, for the
same reason as [README.md](./README.md): different people touch it, different rotation cadence. Reusing
the EVENT key here means one leak compromises **both** directions at once.

**Key rotation does not interrupt this endpoint** ([testing.md § Key rotation](./testing.md#3-key-rotation)): there is a
window where **two** secrets are simultaneously valid. Check `X-Platform-Key-Id` to know which one we
signed with, and keep both accepted until we tell you the old one is revoked.

### 4.1 🔒 Two limits of this scheme — stated so you do not rely on what it does not promise

The signature does **not** cover the destination hostname, and has **no** `nonce`. Both are conditional
choices:

| Missing | Replaced by | Condition for it to be sufficient |
|---|---|---|
| signing the **hostname** | **one integration = one recovery endpoint = one secret** | If you run multiple servers (sandbox vs. production, multiple regions), **do not share a secret** across them. Each server is its own integration with its own key. Sharing lets a request signed for one server verify on another |
| **`nonce`** | ±5-minute freshness window alone | The three questions in §3.1 are all **read-only** and harmless to repeat. A replay inside 5 minutes is just a repeated read — there is no side effect to exploit |

⚠️ **The day this recovery channel gains a WRITE operation, `nonce` must be added first, not after.** A
time window alone does not prevent replay; it only bounds *how long* replay is possible. For a
read-only operation that difference does not matter; for a state-changing one, it is an actual hole.

⚙️ An operating guarantee on our side: **outbound calls do NOT follow redirects (`3xx`)**.
Following one would let a redirect configuration steer our signed payload to a destination we did not
choose — exactly what not signing the hostname leaves open.

## 5. Your integration tier

| Tier | You have | What you lose on incident |
|---|---|---|
| `FULL_RECOVERY` | ingest + receipts + **one** replay path | — |
| `INGEST_PLUS_DETECTION` | ingest + receipts + reconciliation, **no** replay | **you can detect, you cannot self-heal** |
| `INGEST_PLUS_REPLAY` | ingest + you can replay, **no** reconciliation | you can fill gaps but **do not know which ones** |
| `INGEST_ONLY` | ingest only | a loss is a **silent** loss |

### 5.0 Capability → tier mapping — the only two vocabularies in this document, tied together

Two distinct vocabularies appear across this documentation set. This is the single normative mapping
between them — do not derive one from the other by guessing.

- **Capabilities** (`QUERY_WINDOW`, `QUERY_RESOURCE`, `REDELIVER_BY_ID`) — the three primitives your
  system either has or does not, proven by the conformance suite's outbound cases (§1.3 of
  [testing.md](./testing.md)).
- **Tier** (`FULL_RECOVERY`, `INGEST_PLUS_DETECTION`, `INGEST_PLUS_REPLAY`, `INGEST_ONLY`) — the
  **published result** of combining your proven capabilities, per §1's two halves (detect / fix).

| Capability | Which half (§1) | Proven by conformance case |
|---|---|---|
| `QUERY_WINDOW` | **both** detect and fix | `OUT-1`, `OUT-2`, `OUT-5`, `OUT-6` |
| `QUERY_RESOURCE` | detect only | `OUT-7` |
| `REDELIVER_BY_ID` | fix only — but only usable once something else has told us **which id** is missing | `OUT-3`, `OUT-4` |

🔴 **`QUERY_WINDOW` covers both halves ONLY because its response MUST carry the full, resendable event
envelope for every item — not just an id.** Your `OUT-1`/`OUT-2` responses are read back into the same
schema you send **into** the EVENT channel (§5 of [event-ingestion.md](./event-ingestion.md)); we take
that content and resubmit it through our own ingest path directly, with no extra round-trip to you. If
your endpoint can only return `{ eventId, type, occurredAt }` per item — not the full envelope — you
have `QUERY_RESOURCE`-level detection, not `QUERY_WINDOW`: declare it as such, or the conformance suite
will fail when it tries to resubmit what you returned.

⚠️ **Do not confuse this with the `eventIds` field in the §2 response** (`POST
/api/v1/integrations/reconciliation`, the direction **you** call **us**). That field is a plain list of
ids with no envelope content — when using it, **you** are the one who resends through
[event-ingestion.md](./event-ingestion.md), we do not auto-resend from it. `QUERY_WINDOW` is the
opposite direction (§3): an endpoint **you** expose, that **we** call.

| Capabilities you have proven | Published tier |
|---|---|
| `QUERY_WINDOW` (alone is enough for both halves) | `FULL_RECOVERY` |
| `QUERY_RESOURCE` + `REDELIVER_BY_ID` (detect + fix, via two separate primitives) | `FULL_RECOVERY` |
| `QUERY_RESOURCE` only | `INGEST_PLUS_DETECTION` |
| `REDELIVER_BY_ID` only | `INGEST_PLUS_REPLAY` |
| none | `INGEST_ONLY` |

**Your tier is IN the reconciliation response**, not a line in this document. Every call to
`POST /api/v1/integrations/reconciliation` returns:

```jsonc
"capability": {
  "tier":       "INGEST_ONLY",
  "meaning":    "a loss is a silent loss — the system cannot answer \"whose fault\"",
  "closesLoop": false          // does the reconciliation loop close — needs BOTH detect AND replay
}
```

### 5.1 ⚠️ Declaring a capability is not enough — it must be proven

Your tier is the **intersection** of two things:

```text
  what calling you ACTUALLY achieves   (evaluated live, per call — not a flag someone set once)
∩ what your CONFORMANCE TEST has PASSED   (testing.md)
────────────────────────────────────────
  the tier published to you
```

**Declaring means you say you can do it; the tier only rises once you run the conformance test and it
PASSES.** Declaring without running it leaves your tier unchanged, and you will be waiting for
something that never arrives.

🔒 Why an intersection rather than either alone — each alone leaves exactly one hole open:

| Trusting the test result alone | Trusting live evaluation alone |
|---|---|
| you change your system after testing ⇒ the old result **lies** | wiring it up raises your tier **without ever passing a test** |

⇒ Remove your replay path ⇒ your tier **drops immediately**, no one has to update anything. Have not
passed yet ⇒ **no tier increase**, even if you have built everything.

⚠️ **Every partner's default today is `INGEST_ONLY`** — this is **deliberate fail-closed** behavior, not
a low opinion of you. Declaring a capability no one has tested would make you **believe you are
protected** when you are not — exactly the failure mode this whole tier system exists to avoid.

⭐ **All four tiers are valid integrations.** We do **not** reject anyone for lacking recovery capability
— doing so would turn the platform into "only partners with strong-enough systems allowed." But we
**must know and publish** your tier: at `INGEST_ONLY`, "whose fault" is a question the system **cannot
answer** — and that is a **declared** truth, not a hidden hole.

**Four accepted replay shapes — having ANY of them is enough, you do not need to build something new:**

| You already have | Shape |
|---|---|
| an endpoint listing events by time range | window query |
| an endpoint to resend one delivery | replay by identifier |
| an endpoint to read a business resource's state | resource query |
| an end-of-period reconciliation file | batch file |
| **none of the above** | `INGEST_ONLY` tier — you are still fully integrated |
