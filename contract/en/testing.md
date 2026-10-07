# Testing — Conformance Suite, Test Vectors, Key Rotation, Production Checklist

Start here: [README.md](./README.md).

Documentation and executable tests are both part of the contract:

```text
Documentation
      +
Executable conformance tests
      =
Partner integration contract
```

Read the docs → implement → run the tests → know whether you are done. Do not treat the test suite as
optional tooling.

---

## 1. Automated conformance suite (EVENT + RECOVERY channels)

We ship a **runnable test suite** with this documentation. Run it **against your own system**, see
whether you satisfy the contract, then onboard. **You do not need to wait for us to check it for you.**

### 1.1 Run it

```bash
CONF_API=https://<the host of the test environment we gave you>/api/v1 \
CONF_ACCESS_KEY=<your access key> \
CONF_MASTER_SECRET=<your masterSecret — 43-char base64url> \
CONF_EVENT_TYPE=ORDER_COMPLETED \
CONF_RECOVERY_URL=https://<your system>/api/recovery \
CONF_RECOVERY_SECRET=<your RECOVERY channel secret> \
  npx tsx run.ts
```

Exit code: **`0`** = all passed · **`1`** = at least one case failed · **`2`** = could not run
*(missing configuration)*.

| Variable | Required | Note |
|---|:--:|---|
| `CONF_API` · `CONF_ACCESS_KEY` · `CONF_EVENT_TYPE` | ✅ | missing ⇒ exits `2` |
| **`CONF_MASTER_SECRET`** | ✅ | the runner **derives** every channel key from this, per [credential-derivation.md](./credential-derivation.md) |
| `CONF_EVENT_VERSION` · `CONF_LAUNCH_VERSION` · `CONF_RECOVERY_VERSION` | ⬜ | default `1`. After a **key rotation** you MUST set these — otherwise the runner signs with the old key and gets a `401` that looks exactly like "bad signature" |
| `CONF_EVENT_SECRET` · `CONF_LAUNCH_SECRET` · `CONF_RECOVERY_SECRET` | ⬜ | **legacy path** — a standalone secret per channel. Only for integrations not yet re-issued. When set explicitly it **wins** over `CONF_MASTER_SECRET` |
| `CONF_RECOVERY_URL` | ⬜ | left empty ⇒ the 7 outbound cases report **SKIPPED** — **not** "passed" |
| `CONF_RECOVERY_SECRET` | ⬜ | left empty ⇒ runs unsigned, for use while you are still building |

⚠️ **If you built signature verification but forgot to set `CONF_RECOVERY_SECRET`, all 7 outbound cases
fail with `401`** — and that is the suite **working correctly**: you just correctly rejected an
unsigned call. Set the secret and rerun.

⚠️ **SKIPPED is not the same as PASSED.** Skipping does **not** raise your tier — it just means no one
asked.

### 1.2 ⚠️ Point at sandbox, not your production system

The 8 inbound cases fire **real events** at the event endpoint — every run sends **8 events** (**10** with an
order-type `CONF_EVENT_TYPE`, where `IN-8` adds two) to wherever `CONF_API` points. No money or points move (the synthetic users match no real profile), but it
is still real data.

⭐ Everything the suite creates carries the prefix **`conf-`** (`eventId`, `externalUserId`) so it can be
filtered and cleaned up. Rerunning any number of times is safe correctness-wise — it just accumulates
disposable rows.

### 1.3 Fifteen cases — two directions measure two different things

| | Tests | Failing means |
|---|---|---|
| **INBOUND** *(8 cases)* | **our** endpoint, using **your** key — i.e. did you sign correctly, use the right shape, register correctly | ⚠️ **GO-LIVE GATE** — failing this means integration **cannot be turned on** |
| **OUTBOUND** *(7 cases)* | **your system** — can you answer the three recovery questions | you still onboard normally, just at a **lower tier** ([recovery.md §5](./recovery.md#5-your-integration-tier)) |

**Inbound**

| Case | Scenario | Expected |
|---|---|---|
| `IN-1` | valid event | `200` |
| `IN-2` | missing `eventId` | `400` — wrong **shape** |
| `IN-3` | timestamp of the wrong type | `400` |
| `IN-4` | `payload` missing a required field | **`422`** — right shape, wrong **meaning** |
| `IN-5` | resend the exact same event | `200` + `deduplicated: true`, **not** `409` |
| `IN-6` | wrong signature | `401` |
| `IN-7` | stale timestamp *(replay)* | `401` |
| `IN-8` | an order event whose `brandCode` is **present but empty or blank** *(only when `CONF_EVENT_TYPE` is an order type, `ORDER_*`)* | **`422`** `payload_field_missing`, and the error names `brandCode` |

⚠️ **`IN-4` is the case worth paying the most attention to.** `400` and `422` are **two different
things** for you: `400` means "malformed, fix and resend"; `422` means "well-formed, wrong business
meaning — read `code` to know who must act" (see [error-codes.md](./error-codes.md)). Mistaking one for
the other sends you fixing a shape that was never broken, and you **never find the real cause**.

⚠️ **`IN-8` is measurable only for order types.** `brandCode` only means something on `ORDER_*`. Leaving
it out is still a valid order (`200`), and a wrong-case value is also `200` — the gateway cannot tell you
about either; both only surface when you verify the wallet. A `brandCode` that is **present but empty or
blank**, though, gets the whole event rejected, and what must change is **your event**: send a usable
string, or leave the field out ([event-ingestion.md §5.3](./event-ingestion.md#53-payload--by-type)). Run
the suite with a non-order `CONF_EVENT_TYPE` and this case reports **passed — not applicable** and sends
nothing: firing `ORDER_*` with a key not registered for it would only measure "type not registered".

**Outbound**

| Case | Scenario | Proves capability |
|---|---|---|
| `OUT-1` | query by time window ⇒ returns a list of events | `QUERY_WINDOW` |
| `OUT-2` | pagination — continuation cursor present, `null` when exhausted | `QUERY_WINDOW` |
| `OUT-3` | query a **nonexistent** id ⇒ returns empty, **no error** | `REDELIVER_BY_ID` |
| `OUT-4` | replay by identifier ⇒ returns **exactly** that event | `REDELIVER_BY_ID` |
| `OUT-5` | query the same window twice ⇒ **identical** result | `QUERY_WINDOW` |
| `OUT-6` | a fabricated cursor ⇒ **errors**, does not silently return page 1 | `QUERY_WINDOW` |
| `OUT-7` | query the **underlying resource's** status ⇒ returns status (or `404`) | `QUERY_RESOURCE` |

⚠️ **`OUT-6` catches the most silent pagination bug there is.** A bad cursor that silently returns page
1 makes our replay loop run **forever on the same page** — every page looks valid, so **neither side
notices**.

⚠️ **`OUT-5` — two queries over the same window must return the same set.** Reconciliation runs on a
schedule; the same question producing two different answers means every "what's missing" conclusion is
a conclusion about a moving target.

Capability-to-tier derivation is documented in [recovery.md §5](./recovery.md#5-your-integration-tier).

### 1.4 Self-test is not go-live approval

**Self-test is for development verification only. It does not change your published integration tier
or constitute production approval. Our team performs the final conformance verification before
enabling the integration.**

⭐ The suite calls using the **default** shape. If your system uses a different shape, tell us and we
will plug in the matching adapter layer — the suite runs through it. **You do not need to change your
own API.**

### 1.5 LAUNCH channel — 8 cases, run separately

The 15 cases above (§1.3) only cover EVENT and RECOVERY. **LAUNCH has its own 8 cases**, requiring two
extra variables:

```bash
CONF_LAUNCH_SECRET=<your LAUNCH channel secret> \
CONF_LAUNCH_CAMPAIGN_ID=<a real, active campaign your integration can launch> \
  npx tsx run.ts
```

| Variable | Required | Note |
|---|:--:|---|
| `CONF_LAUNCH_SECRET` | ✅ | missing ⇒ exits `2`, same as the other required variables |
| `CONF_LAUNCH_CAMPAIGN_ID` | ✅ | must be `active`, within its display window, and belong to your tenant — see [campaign-launch.md §7](./campaign-launch.md#7-partner--campaign-scope--what-your-accesskey-is-allowed-to-launch) |

| Case | Scenario | Expected |
|---|---|---|
| `LAUNCH-1` | valid campaign + `externalUserId` | `200` + `launchUrl` |
| `LAUNCH-2` | open `launchUrl` | session established |
| `LAUNCH-3` | reuse the same `launchUrl` a second time | rejected |
| `LAUNCH-4` | `launchUrl` has expired | rejected |
| `LAUNCH-5` | invalid launch code | rejected |
| `LAUNCH-6` | campaign not authorized for this integration | rejected |
| `LAUNCH-7` | a code minted for campaign A cannot open campaign B | rejected |
| `LAUNCH-8` | `externalUserId` from launch matches the session created | correct user |

⏱️ **`LAUNCH-4` takes about a minute to run** — it waits out the real 60-second Launch Grant TTL. There
is no faster way to test this as a pure black box: expired, already-consumed, and never-existed codes
are **deliberately indistinguishable**, all returning the same `401 INVALID_LAUNCH_CODE` (see
[campaign-launch.md §8](./campaign-launch.md#8-error-codes)) — so the only honest way to prove expiry
specifically is to actually wait for it.

⚠️ **`LAUNCH-8` cannot literally decode "whose session this is"** — the session carries an internal
subject id, never your `externalUserId` (this is intentional — see
[campaign-launch.md §6.2](./campaign-launch.md#62-launchurl-is-not-a-permanent-credential)). What this
case actually proves: launching two **different** `externalUserId` values produces two **independently
successful, distinct** sessions — a black-box proxy for "identity isn't being conflated between users."

⚠️ **LAUNCH results are reported the same way as INBOUND, but are not (yet) wired into the automated
go-live gate described in §1.3** — that gate currently evaluates EVENT conformance only. We still
confirm your LAUNCH integration during onboarding review. Run this suite anyway: it is the fastest way
to find your own bugs before that review.

---

### 1.6 SETTLEMENT channel — 8 cases, run separately

If you receive settled point amounts ([settlement.md](./settlement.md)), test **your receiver** the same
way. The suite plays the platform: it signs `PartnerSettlementSignatureV1` and calls the URL you give it. It
moves no points and changes nobody's balance — the amounts in the packets are fixtures.

```bash
CONF_SETTLEMENT_URL=https://your-host.example/settlements \
CONF_SETTLEMENT_SECRET=<your SETTLEMENT channel secret> \
  npx tsx run.ts
```

| Variable | Required | Note |
|---|:--:|---|
| `CONF_SETTLEMENT_URL` | to run the axis | absent ⇒ the SETTLEMENT cases are reported as **not run** (never as passed) |
| `CONF_SETTLEMENT_SECRET` | ✅ when the URL is set | or set `CONF_MASTER_SECRET` and the suite derives the SETTLEMENT key itself (`CONF_SETTLEMENT_VERSION` picks the version, default `1`) |
| `CONF_SETTLEMENT_KEY_ID` | no | sent as `X-Platform-Key-Id`; default `conformance-settlement` |
| `CONF_SETTLEMENT_PREVIOUS_SECRET` | no | the secret a rotation replaces. When set, the suite adds a **ninth** case, `SETTLEMENT-9` (below) |

| Case | Scenario | Expected |
|---|---|---|
| `SETTLEMENT-1` | valid packet | `2xx` |
| `SETTLEMENT-2` | the same `deliveryNonce` again, freshly signed | `409` |
| `SETTLEMENT-3` | "ask again": the very same request, same nonce | `409` |
| `SETTLEMENT-4` | wrong signature | `401` (`403` accepted) |
| `SETTLEMENT-5` | timestamp older than 5 minutes, correctly signed | `401` (`403` accepted) |
| `SETTLEMENT-6` | same `settlementItemId`, new nonce | `2xx` — do not dedupe on `settlementItemId` |
| `SETTLEMENT-7` | reply time | within 10 seconds |
| `SETTLEMENT-8` | redirect | no `3xx`; declare the final URL |
| `SETTLEMENT-9` *(optional)* | signed with the **previous** secret, under the **same** `X-Platform-Key-Id` | `2xx` — during a rotation your receiver must keep BOTH secrets and try them newest first |

`SETTLEMENT-9` runs only when `CONF_SETTLEMENT_PREVIOUS_SECRET` is set, so the eight cases above stay eight. The key id does not change between versions (see [settlement.md §3](./settlement.md#3-we-authenticate-ourselves-to-you--partnersettlementsignaturev1)), which is why a receiver that picks one secret per key id fails this case.

`SETTLEMENT-3` matters more than it looks: when our operations team presses **Ask the partner again**, we
resend the same packet with the same nonce and read `409` as "you already received it". Any other answer
there can make us send a settled amount twice.

**A reference receiver is included**: `examples/node/settlement-receiver.mjs`
(Node, no dependencies, MIT). It passes all 8 cases, remembers nonces in a JSON file across restarts, and
prints every accepted packet. During a key rotation give it both secrets, newest first: `SETTLEMENT_SECRETS=<new>,<old>`. Check it without a network: `node examples/node/settlement-receiver.mjs --self-test`.

`SETTLEMENT-2` and `SETTLEMENT-3` require **`409`** specifically for a repeated nonce: our "Ask the partner again" reads `409` as "already received". Answering `400`, `422` or an idempotent `200` instead makes those two cases fail.

Behind a reverse proxy, verify the signature against the path and query exactly as we sent them; a proxy that rewrites the path turns every call into `401`.

⚠️ SETTLEMENT results are printed in their own block and are **not** part of the automated go-live gate in §1.3. The process still exits non-zero when a SETTLEMENT case fails, so treat that exit code accordingly in your own CI.

### 1.7 Send yourself a test settlement notification (sandbox only)

Instead of waiting for our operations team to press **Send**, you can ask the sandbox to send **one sample
settlement notification** to the address you gave us ([settlement.md §2.0](./settlement.md)).
It exists **only on the sandbox**: on any other cluster this route does not exist and answers `404`.

```bash
BODY='{}'
TS=$(date +%s)
SIG="sha256=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$EVENT_KEY" -r | cut -d' ' -f1)"
curl -sS -X POST "https://<the host of the test environment we gave you>/api/v1/integrations/settlement/test" \
  -H "Content-Type: application/json" -H "X-API-Key: $ACCESS_KEY" \
  -H "X-Timestamp: $TS" -H "X-Signature: $SIG" -d "$BODY"
```

It is signed like an event, with your **EVENT** channel key ([event-ingestion.md §3](./event-ingestion.md#3-authentication)); the
body is `{}`. You do not pass an address: we send to the one our operations team declared for your integration.

| Answer | Meaning |
|---|---|
| `{ "outcome": "SENT_OK", "httpStatus": 200, "code": "sent" }` | your receiver answered `2xx` |
| `PARTNER_REJECTED` · `partner_rejected` | your receiver answered `409` or `422`. On the first test it must answer `2xx` |
| `SEND_FAILED_HTTP` · `partner_unexpected_status` | any other code. Only `2xx` is "received" |
| `SEND_FAILED_TIMEOUT` · `partner_unreachable` | no answer in 10 seconds, a connection error, or a redirect |
| `NOT_CONFIGURED` · `not_ready_integration` · `not_ready_endpoint` · `not_ready_key` · `not_ready_namespace` | the integration is not ready to send points yet: ask our operations team to finish the address and keys |
| `429` | more than 6 test sends in a minute: wait for `Retry-After` |

What the sample looks like: the same packet as [settlement.md §2.1](./settlement.md#21-request-body), signed with your
SETTLEMENT key, with batch reference starting **`SANDBOX-`**, `externalUserId` `sandbox-user` and a denomination that
does not exist. **It is not a real line: do not book it in your own accounting.** It opens no batch on our side and
changes nobody's balance.

What to check on your side: the first test send is answered `2xx`; the same `deliveryNonce` repeated is answered `409`
(the cases of §1.6 check this); the signature is verified on the raw body.

---

## 2. Test vectors

Fixed numbers for **unit-testing your signing function** — no network, no real keys needed. A single
differing character means your implementation is wrong.

⚠️ **The `secret` in the vectors below is an ARBITRARY value**, used only to test the **signing**
step. In practice it is the **channel key you derive** from `masterSecret` — see
[credential-derivation.md](./credential-derivation.md), which carries its own vectors for the
**derivation** step. The two vector sets check two different things: *did you derive the right key*
and *did you sign correctly*. Getting either wrong produces the same `401`.

### 2.1 EVENT channel — `EventIngressSignatureV1`

```text
secret     :  whsec_demo_0123456789abcdef
timestamp  :  1786698753
body       :  {"specversion":"1.0","eventId":"evt-88421","externalUserId":"12345","type":"ORDER_COMPLETED","occurredAt":"2026-08-14T09:12:33Z","confidence":"SERVER_OBSERVED","payload":{"orderId":"SO-99881","amountMinor":250000000,"currency":"VND"}}
             (234 bytes, NO trailing newline)

signing string :  1786698753.{"specversion":"1.0",…}

RESULT     :  sha256=ae00dc858385fdb65061fda5da1809772f8f602f5d653052e7672516c4d59176
```

### 2.2 LAUNCH channel — reuses `EventIngressSignatureV1`

**Not a fourth signing scheme.** LAUNCH signs exactly like EVENT (§2.1) — same canonical string, same
algorithm — with its own secret. If your EVENT signing function already passes §2.1, point it at the
LAUNCH secret and body below; it should need **zero** changes beyond that.

```text
secret     :  launchsec_demo_0123456789abcdef
timestamp  :  1786701000
body       :  {"externalUserId":"ext-user-000001"}
             (36 bytes, NO trailing newline)

signing string :  1786701000.{"externalUserId":"ext-user-000001"}

RESULT     :  sha256=aa1844c56dfff66d53577aa4e35db6963ddd7a4425906782faa35f75119906bc
```

This is the body for `POST /campaigns/:campaignId/launch` — see
[campaign-launch.md §4](./campaign-launch.md#4-step-1--create-a-launch-grant). `GET /launch` (step 2)
carries no signature at all — the opaque `code` in the URL is the credential (§9 of that document).

### 2.3 RECOVERY channel — `PartnerRecoverySignatureV1`

```text
secret     :  rcv_demo_fedcba9876543210
timestamp  :  1786698753
method     :  GET
path       :  /api/recovery/orders?from=2026-08-10T00%3A00%3A00Z&to=2026-08-11T00%3A00%3A00Z
body       :  (empty)

signing string :  1786698753.GET./api/recovery/orders?from=2026-08-10T00%3A00%3A00Z&to=2026-08-11T00%3A00%3A00Z.

RESULT     :  sha256=9b136e1a47b2b5232b085a081a3c3ee9bbcfc541a7a74b2abde919ee93d71b84
```

⚠️ **Note the trailing `.`** in the signing string. An empty body means **an empty string joined after
the third dot**, **not** dropping that segment. This is the most common mistake when building
verification for `GET` calls.

⚠️ **Note the `%3A` in the path.** The signing string uses the path **exactly as it appears on the
request line** — decoding `%3A` to `:` before signing produces a different signature. See the
reverse-proxy warning in [recovery.md § We authenticate ourselves to you](./recovery.md).

### 2.4 Reconciliation digest

```text
eventId set :  ["evt-1", "evt-2", "evt-3"]
algorithm   :  deduplicate → sort ascending → join with "\n" → sha256 → lowercase hex → prefix "v1:"
hashed string :  evt-1\nevt-2\nevt-3

RESULT      :  v1:8d3f182a04c6d2bcb51a2e6f0201039af53aa777c6aa18236b3c6eae53083b44
```

### 2.5 Self-check with shell

```bash
# EVENT channel (§2.1)
printf '%s.%s' 1786698753 '{"specversion":"1.0","eventId":"evt-88421","externalUserId":"12345","type":"ORDER_COMPLETED","occurredAt":"2026-08-14T09:12:33Z","confidence":"SERVER_OBSERVED","payload":{"orderId":"SO-99881","amountMinor":250000000,"currency":"VND"}}' \
  | openssl dgst -sha256 -hmac 'whsec_demo_0123456789abcdef' -r | cut -d' ' -f1

# LAUNCH channel (§2.2) — same scheme as EVENT, different secret
printf '%s.%s' 1786701000 '{"externalUserId":"ext-user-000001"}' \
  | openssl dgst -sha256 -hmac 'launchsec_demo_0123456789abcdef' -r | cut -d' ' -f1

# reconciliation digest (§2.4)
printf 'evt-1\nevt-2\nevt-3' | openssl dgst -sha256 -r | cut -d' ' -f1

# SETTLEMENT channel (§2.6) — method and path are signed too
printf '%s.POST.%s.%s' 1786698753 '/hooks/settlement?src=bank-a' '{"settlementRef":"SR-2026-09-camp-01","campaignId":"7c2e9a14-6b3d-4f58-a1c0-5d8e2b4f9a36","settlementItemId":"5b0d8e7a-3c41-4f6a-9b52-7a1e0c9d2f64","partyId":"0b8a6f2e-1d34-4c57-8e90-a3b5c7d9e1f2","externalUserId":"12345","denominationCode":"PTS","pointAmount":"100","exchangeRateSnapshot":"10","moneyAmount":"1000","moneyCurrency":"VND","deliveryNonce":"9c1f4a7e-52b8-4d03-a6e9-0f3b8d2c7a15"}' \
  | openssl dgst -sha256 -hmac 'stl_demo_0123456789abcdef' -r | cut -d' ' -f1
```

### 2.6 SETTLEMENT channel — `PartnerSettlementSignatureV1`

We call **you**, so this is the signature you **verify**. Same shape as RECOVERY (§2.3) — method and
path are part of the signing string — but with a body, and with the SETTLEMENT secret.

```text
secret     :  stl_demo_0123456789abcdef
timestamp  :  1786698753
method     :  POST
path       :  /hooks/settlement?src=bank-a
body       :  {"settlementRef":"SR-2026-09-camp-01","campaignId":"7c2e9a14-6b3d-4f58-a1c0-5d8e2b4f9a36","settlementItemId":"5b0d8e7a-3c41-4f6a-9b52-7a1e0c9d2f64","partyId":"0b8a6f2e-1d34-4c57-8e90-a3b5c7d9e1f2","externalUserId":"12345","denominationCode":"PTS","pointAmount":"100","exchangeRateSnapshot":"10","moneyAmount":"1000","moneyCurrency":"VND","deliveryNonce":"9c1f4a7e-52b8-4d03-a6e9-0f3b8d2c7a15"}
             (393 bytes, NO trailing newline)

signing string :  1786698753.POST./hooks/settlement?src=bank-a.{"settlementRef":"SR-2026-09-camp-01",…}

RESULT     :  sha256=97dbddee1b7e935b602309c7cf90b01b9b0810458b66770d79c59631af8b4f73
```

⚠️ **The query string is part of the path** — `?src=bank-a` is signed. Verify against the path and query
exactly as they appear on the request line. ⚠️ **The body is signed as raw bytes**, including
`externalUserId` and `deliveryNonce`; do not parse and re-serialize it before verifying.

---

## 3. Key rotation

Derive the new channel key from the same master and the exact version returned by Creator-OS; see
[credential-derivation.md](./credential-derivation.md). Multiple versions are **simultaneously valid** during rotation. You can switch to a new secret at any
time, with **zero dropped requests** — this is not a scheduled cutover.

| Event | What you see |
|---|---|
| we return a new channel version `v` | keys derived with both the old and new version verify successfully |
| you switch to the new secret | nothing changes on our side |
| we revoke the old secret | takes effect **IMMEDIATELY**, no grace period |

⚠️ **Revocation is immediate.** Any server of yours still holding the old secret starts receiving `401`
the instant it is revoked. ⇒ Move **every** server to the new secret **before** telling us to revoke the
old one.

⭐ The reverse direction ([recovery.md](./recovery.md), [settlement.md](./settlement.md)) is **not** the same mechanism.
`X-Platform-Key-Id` stays the same across versions, and we sign with the **new** key the moment a rotation completes. Derive
and load the new version **before** it completes (it is always the current one plus one), accept both secrets and try
them newest first, and expect a short window of `401` if you were late.

This applies independently per channel — rotating the EVENT secret does not affect the LAUNCH secret, and
vice versa.

---

## 4. Production checklist

The go-live checklist now lives in one place: **[go-live.md](./go-live.md)**. It covers EVENT, LAUNCH, the web view,
SETTLEMENT and closing the loop, and the incident runbook.
