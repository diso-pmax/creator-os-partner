# Go-live — checklist and incident runbook

Start at: [README.md](./README.md). This is the **single** go-live checklist and the page to open when
something goes wrong after launch. [testing.md](./testing.md) tells you how to test; this page tells you when
you are done and what to do when it breaks.

## Part A — Checklist before real users

Check every box before enabling this integration against real users. 🔒 items are security-critical.

### A.1 EVENT channel

**Signing and authentication**

- [ ] Your signing function produces **exactly** the result in [testing.md §2.1](./testing.md#21-event-channel--eventingresssignaturev1) — covered by a unit test that pins this vector
- [ ] Serialize **exactly once**: the string you sign **is** the string you send ([event-ingestion.md § Most common bug](./event-ingestion.md))
- [ ] 🔒 The signing secret lives on the **server**, not a mobile app, browser, or source repository
- [ ] 🔒 The EVENT channel secret is **different** from the LAUNCH channel secret — no shared signing function
- [ ] Server clock is NTP-synced, drift under 1 minute

**Payload correctness**

- [ ] `eventId` is generated per **business event**, not per HTTP call — conformance vector #2 ([event-ingestion.md §4](./event-ingestion.md#4-conformance-vectors--three-requests-to-fire-in-order)) returned `deduplicated: true`
- [ ] `orderId` is a **string**, not a number
- [ ] `occurredAt` is **when it happened**, not when you send it
- [ ] You know your two `occurredAt` limits — lateness and future skew — and your **worst-case** delivery lag (queue backlog, nightly batch, an outage you have actually had) fits inside the lateness one ([event-ingestion.md §5.4](./event-ingestion.md#54-occurredat--the-two-deadlines))
- [ ] 🔒 A `422 event_too_late` or `event_from_future` **never** makes your code mint a new `eventId` and resend — that turns one late event into two economic events
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

- [ ] Conformance suite **inbound 8/8 passing** ([testing.md §1.3](./testing.md#13-fifteen-cases--two-directions-measure-two-different-things)) — this is the go-live gate
- [ ] The three conformance vectors ([event-ingestion.md §4](./event-ingestion.md#4-conformance-vectors--three-requests-to-fire-in-order)) have been run against **sandbox** first

### A.2 LAUNCH channel

See the full checklist in
[campaign-launch.md §9](./campaign-launch.md#9-security-requirements) — not duplicated here.

### A.3 Cross-channel

- [ ] `externalUserId` is **provably** the same value on both EVENT and LAUNCH for the same user — test
      with one real user end to end, not just unit tests
- [ ] You have integrated **both** channels, or you have deliberately chosen EVENT-only for
      logging/reconciliation purposes only, understanding it produces no rewards ([README.md](./README.md))

### A.4 Web view

- [ ] The web view opens `launchUrl` unchanged and keeps the session cookie set on the `302` ([webview.md](./webview.md))
- [ ] The player always has a way out: `close_native_webview` is handled
- [ ] After 8 hours, or on `401 INVALID_LAUNCH_CODE`, your server creates a new `launchUrl`
- [ ] The web view shows no page for `403 feature_disabled` (raw JSON): your app builds the screen for it

### A.5 SETTLEMENT channel *(only if you receive point settlements)*

- [ ] 🔒 Your receiver verifies `PartnerSettlementSignatureV1` on the **raw** body, within ±5 minutes ([settlement.md](./settlement.md))
- [ ] 🔒 Your receiver rejects a `deliveryNonce` it has already seen with **`409`**, and remembers nonces across restarts
- [ ] The dedupe key is `deliveryNonce`, never `settlementItemId`
- [ ] The conformance suite's SETTLEMENT cases pass **8/8** against your receiver (see testing.md)
- [ ] You answer within 10 seconds and never with a redirect; the endpoint you declared is the final URL
- [ ] 🔒 The SETTLEMENT secret is different from every other channel secret and lives only on the server that receives

### A.6 Closing the loop

- [ ] For every settled line you paid out, you send us a `POINT_REDEEMED` event so the line can close
- [ ] You asked us to enable `POINT_REDEEMED` for your event source; without it the event is answered `422 event_type_not_registered` (a configuration gap on our side). Try it with one line on the sandbox first
- [ ] You can map each `settlementItemId` you received to your own record of the payout

## Part B — When something goes wrong

Two rules first: **never paste a secret** (`masterSecret` or a channel key) into a ticket, a chat or an
email, and **never retry a `422` blindly**.

### B.1 A settlement did not arrive, or arrived and failed

| What you see | Likely cause | Do |
|---|---|---|
| nothing arrives at your endpoint | the endpoint is not declared on our side, or our operations team has not pressed Send yet | check with your contact that the address is declared and the batch is confirmed |
| you answered `401` to us | none of the secrets you have verifies (after a key rotation, the new version is not loaded yet), a stale clock (±5 minutes), or a proxy that rewrote the path | verify against the path exactly as sent, check NTP; we do not retry on `401` |
| you answered `5xx` or timed out | your side was down or slow (>10 s) | fix it and tell us: our operations team resends the line with a **new** nonce. Before processing a packet, check your own records by `settlementItemId`: if you already paid that line, do not pay again, tell us so we record it with `POINT_REDEEMED` |
| you answered `409` to a **repeat** (our operations team pressed "Ask the partner again": same packet, same nonce) | you had already received it | nothing to do, we record the line as received |
| you answered `409` or `422` to a **first** delivery | for a normal send we record that as "rejected by the partner" | answer `2xx` on a first delivery; if your own nonce store collided, fix it and tell us, our operations team resends with a new nonce |
| you answered a non-`2xx` that is not `409`/`422` | any other code is treated as "outside the contract" | answer `2xx`, or `409` for a repeat |

### B.2 The amount looks wrong

The amounts in a packet (`pointAmount`, `exchangeRateSnapshot`, `moneyAmount`) are frozen when the batch is
created and are never recomputed. Do **not** recompute them on your side. Send your contact the
`settlementItemId` and `deliveryNonce` you received, and both of your figures.

### B.3 You need to change the address that receives settlements

Ask your contact to change it; it takes effect for the **next** send. A line already sent is not resent
to the new address. Keep the old receiver running until your contact confirms the change.

### B.4 A secret may have leaked (including `masterSecret`)

Treat the whole set as leaked, including if it only passed through a chat, a ticket or a log.

1. Ask us to **reissue the whole set** (a new `masterSecret`). Both sets work during an overlap you agree with us.
2. Derive the new channel keys and deploy them on every server that signs or verifies.
3. When your servers use the new set, ask us to **revoke the old set**. See [credential-derivation.md](./credential-derivation.md).
4. Re-run the conformance suite, and if you have sources that were not yet opened for rewards, re-run it before they are opened.
5. Never put the old or new secret in a ticket: describe the situation, we will not ask for the value.

### B.5 Who to contact

Use the contact your onboarding gave you. Always include: your `accessKey` (never a secret), the time of the
incident in UTC, the `deliveryId` / `settlementItemId` involved, and what you sent and received.
