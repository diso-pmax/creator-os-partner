# Testing — Conformance Suite, Test Vectors, Key Rotation, Production Checklist

**Version 1.0 · 2026-08-25** · Start here: [README.md](./README.md).

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
CONF_API=https://<our sandbox host>/api/v1 \
CONF_ACCESS_KEY=<your access key> \
CONF_EVENT_SECRET=<your EVENT channel secret> \
CONF_EVENT_TYPE=ORDER_COMPLETED \
CONF_RECOVERY_URL=https://<your system>/api/recovery \
CONF_RECOVERY_SECRET=<your RECOVERY channel secret> \
  npx tsx run.ts
```

Exit code: **`0`** = all passed · **`1`** = at least one case failed · **`2`** = could not run
*(missing configuration)*.

| Variable | Required | Note |
|---|:--:|---|
| `CONF_API` · `CONF_ACCESS_KEY` · `CONF_EVENT_SECRET` · `CONF_EVENT_TYPE` | ✅ | missing ⇒ exits `2` |
| `CONF_RECOVERY_URL` | ⬜ | left empty ⇒ the 7 outbound cases report **SKIPPED** — **not** "passed" |
| `CONF_RECOVERY_SECRET` | ⬜ | left empty ⇒ runs unsigned, for use while you are still building |

⚠️ **If you built signature verification but forgot to set `CONF_RECOVERY_SECRET`, all 7 outbound cases
fail with `401`** — and that is the suite **working correctly**: you just correctly rejected an
unsigned call. Set the secret and rerun.

⚠️ **SKIPPED is not the same as PASSED.** Skipping does **not** raise your tier — it just means no one
asked.

### 1.2 ⚠️ Point at sandbox, not your production system

The 7 inbound cases fire **real events** at the event endpoint — every run leaves **7–8 events** at
wherever `CONF_API` points. No money or points move (the synthetic users match no real profile), but it
is still real data.

⭐ Everything the suite creates carries the prefix **`conf-`** (`eventId`, `externalUserId`) so it can be
filtered and cleaned up. Rerunning any number of times is safe correctness-wise — it just accumulates
disposable rows.

### 1.3 Fourteen cases — two directions measure two different things

| | Tests | Failing means |
|---|---|---|
| **INBOUND** *(7 cases)* | **our** endpoint, using **your** key — i.e. did you sign correctly, use the right shape, register correctly | ⚠️ **GO-LIVE GATE** — failing this means integration **cannot be turned on** |
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

⚠️ **`IN-4` is the case worth paying the most attention to.** `400` and `422` are **two different
things** for you: `400` means "malformed, fix and resend"; `422` means "well-formed, wrong business
meaning — read `code` to know who must act" (see [error-codes.md](./error-codes.md)). Mistaking one for
the other sends you fixing a shape that was never broken, and you **never find the real cause**.

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

The 14 cases above (§1.3) only cover EVENT and RECOVERY. **LAUNCH has its own 8 cases**, requiring two
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

## 2. Test vectors

Fixed numbers for **unit-testing your signing function** — no network, no real keys needed. A single
differing character means your implementation is wrong.

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
```

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

⭐ On the reverse direction ([recovery.md § We authenticate ourselves to you](./recovery.md)),
you accept **two** secrets as valid at once and look one up by `X-Platform-Key-Id` — same mechanism, roles
reversed.

This applies independently per channel — rotating the EVENT secret does not affect the LAUNCH secret, and
vice versa.

---

## 4. Production checklist

Check every box before enabling this integration against real users. 🔒 items are security-critical.

### 4.1 EVENT channel

**Signing and authentication**

- [ ] Your signing function produces **exactly** the result in [§2.1](#21-event-channel--eventingresssignaturev1) — covered by a unit test that pins this vector
- [ ] Serialize **exactly once**: the string you sign **is** the string you send ([event-ingestion.md § Most common bug](./event-ingestion.md))
- [ ] 🔒 The signing secret lives on the **server**, not a mobile app, browser, or source repository
- [ ] 🔒 The EVENT channel secret is **different** from the LAUNCH channel secret — no shared signing function
- [ ] Server clock is NTP-synced, drift under 1 minute

**Payload correctness**

- [ ] `eventId` is generated per **business event**, not per HTTP call — conformance vector #2 ([event-ingestion.md §4](./event-ingestion.md#4-conformance-vectors--three-requests-to-fire-in-order)) returned `deduplicated: true`
- [ ] `orderId` is a **string**, not a number
- [ ] `occurredAt` is **when it happened**, not when you send it
- [ ] `amountMinor` is an **integer in the smallest currency unit**, paired with `currency`
- [ ] An order moving through multiple states produces **multiple `eventId`s**, sharing one `orderId`

**Operations**

- [ ] You handle `429`: read `Retry-After`, **wait, then resend unchanged**
- [ ] `RateLimit-Reset` is treated as **seconds**, not an epoch timestamp
- [ ] Exponential backoff exists for `5xx` and network timeouts
- [ ] `422` is **not** blindly retried — it goes to a dead-letter queue or pages someone
- [ ] `deliveryId` is recorded on every attempt, including `422`s
- [ ] There is an alert on a sudden rise in `401` rate — a signal of a revoked key or clock drift

**Go-live**

- [ ] Conformance suite **inbound 7/7 passing** ([§1.3](#13-fourteen-cases--two-directions-measure-two-different-things)) — this is the go-live gate
- [ ] The three conformance vectors ([event-ingestion.md §4](./event-ingestion.md#4-conformance-vectors--three-requests-to-fire-in-order)) have been run against **sandbox** first

### 4.2 LAUNCH channel

See the full checklist in
[campaign-launch.md §9](./campaign-launch.md#9-security-requirements) — not duplicated here.

### 4.3 Cross-channel

- [ ] `externalUserId` is **provably** the same value on both EVENT and LAUNCH for the same user — test
      with one real user end to end, not just unit tests
- [ ] You have integrated **both** channels, or you have deliberately chosen EVENT-only for
      logging/reconciliation purposes only, understanding it produces no rewards ([README.md](./README.md))
