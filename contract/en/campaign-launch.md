# LAUNCH Channel — Campaign Launch Contract

**Version 1.0 · 2026-08-25** · Start here: [README.md](./README.md).

## 1. Overview

Two calls, two different callers. The first is server-to-server; the second comes from the user's
WebView and carries no credential of its own beyond a single opaque code.

```text
Your server                              Creator-OS                          User's WebView
     │                                       │                                       │
     │  1. POST /campaigns/:campaignId/launch│                                       │
     ├──────────────────────────────────────▶│                                       │
     │                                       ├─ authenticate (LAUNCH channel HMAC)   │
     │                                       ├─ verify campaign: exists, your        │
     │                                       │  tenant, active                       │
     │                                       ├─ create one-time Launch Grant         │
     │◀──────────────────────────────────────┤                                       │
     │  200 { launchUrl, expiresAt }         │                                       │
     │                                       │                                       │
     │  2. you open launchUrl in the user's WebView                                  │
     ├────────────────────────────────────────────────────────────────────────────▶ │
     │                                       │                                       │
     │                                       │  3. GET /launch?code=…                │
     │                                       │◀──────────────────────────────────────┤
     │                                       ├─ consume code (atomic, single-use)    │
     │                                       ├─ resolve identity + campaign from the │
     │                                       │  Launch Grant record — NOT from the   │
     │                                       │  request                              │
     │                                       ├─ establish a Creator-OS session       │
     │                                       │  302 → campaign URL, session cookie set│
     │                                       ├──────────────────────────────────────▶│
```

**What you do:** one server-to-server call (step 1), then open the URL you received in the user's
WebView (step 2). That is the entire integration surface on your side.

**What we do:** create a one-time Launch Grant (step 1), then — when the WebView opens the URL —
consume it exactly once and establish a Creator-OS session for that user (step 3).

⚠️ **We never call your server in this flow.** There is no "your callback URL" that we invoke. Your
only two responsibilities are the POST call and opening `launchUrl` in the user's WebView.

## 2. Prerequisites

- You have an `accessKey` and a **LAUNCH** Secret Key (see [README.md](./README.md)). This is a
  🔴 **We do NOT issue a separate "LAUNCH Secret Key."** You derive it from `masterSecret`:
  `LAUNCH_KEY = HKDF-SHA256(base64url_decode(masterSecret), "", "integration:channel:LAUNCH:v<VERSION>", 32)`
  → base64url, no padding. See [credential-derivation.md](./credential-derivation.md). It differs from
  your EVENT key because the `info` string differs — not because we send two secrets.
- Your server can compute HMAC-SHA256 and knows the identifier you use for this user on the EVENT
  channel (`externalUserId`) — see §7 for why the same value matters here too.
- The campaign you intend to launch already exists on our side and is in a launchable state (`active`,
  within its display window).

## 3. Authentication — same signing scheme as EVENT, different secret

**The LAUNCH channel does NOT define a new authentication protocol.** It reuses the exact signing
scheme documented in [event-ingestion.md §3](./event-ingestion.md#3-authentication) —
`EventIngressSignatureV1` — with one difference: the secret.

| Item | Contract |
|---|---|
| Access Key header | `X-API-Key` |
| Timestamp header | `X-Timestamp` — **seconds** since epoch |
| Signature header | `X-Signature` |
| Algorithm | HMAC-SHA256 |
| Secret | **LAUNCH** channel Secret Key — different value from your EVENT secret, same `accessKey` |
| Encoding | lowercase hex, prefixed `sha256=` |
| Canonical string | `<X-Timestamp>` + `"."` + `<raw request body, exact bytes>` |
| Timestamp tolerance | ±5 minutes |

```text
canonical_string = timestamp + "." + raw_body
signature        = "sha256=" + hex(HMAC_SHA256(LAUNCH_KEY, canonical_string))
```

This only applies to **step 1** (`POST .../launch`). Step 2 (`GET /launch`) is called by the WebView,
not your server, and carries no HMAC — see §5 for why that is safe.

⚠️ `LAUNCH_KEY` is a base64url string — use it **as-is** as the HMAC key; do NOT base64-decode it again.

🔒 `masterSecret` and every derived key MUST live on your server only.
🔒 Do NOT reuse the EVENT secret here, even though both share the same `accessKey`. A compromised LAUNCH
secret only grants the capability to request launches — it never grants event submission.

## 4. Step 1 — Create a Launch Grant

```text
POST https://<our sandbox host>/api/v1/campaigns/:campaignId/launch
Content-Type: application/json
```

🔴 **This endpoint MUST only be called from your server — never directly from a partner mobile app or
browser.** This is a contractual boundary (like every other server-to-server call in this
integration), not something enforced by a technical mechanism you can observe.

### 4.1 Request

| Field | Where | Type | Required | Description |
|---|---|---|:--:|---|
| `campaignId` | URL path | string | **YES** | the campaign you want to launch |
| `externalUserId` | JSON body | string | **YES** | 🔴 the same identifier you use as `externalUserId` on the EVENT channel for this user — see §7 |

```jsonc
// POST /api/v1/campaigns/camp_01J.../launch
{ "externalUserId": "usr_4471" }
```

### 4.2 Response

**Success — `200`:**

```jsonc
{
  "launchUrl": "https://<our sandbox host>/api/v1/launch?code=<opaque code>",
  "expiresAt": "2026-08-25T10:31:00.000Z"
}
```

`launchUrl` is only valid until `expiresAt` — **60 seconds** from creation in this version (v1
parameter, not a protocol invariant — see §6, item 4). Open it in the user's WebView immediately; do
not cache or delay.

**Failure** — see the full table in [error-codes.md](./error-codes.md#launch-channel--post-apiv1campaignscampaignidlaunch).

## 5. Step 2 — The WebView consumes the code

```text
GET https://<our sandbox host>/api/v1/launch?code=<opaque code>
```

You do not call this endpoint yourself — you only open `launchUrl` (the full URL, code included) in the
user's WebView. The browser/WebView does the rest.

**What we do:** consume the code atomically (exactly one success even under concurrent attempts —
§6, item 7), resolve the user's identity and the target campaign **from the Launch Grant record itself**
— never from anything the request carries — establish a Creator-OS session, set the session cookie, and
redirect to the **root of the Reward webview**. The destination carries no `campaignId`: the webview asks
the server which campaign is running for the tenant on the ticket (#1188).

**Success:**

```jsonc
HTTP/1.1 302 Found
Location: https://<reward-portal>/
Set-Cookie: __Host-player_session=<JWT>; HttpOnly; Secure; SameSite=Lax   // expires in 8 hours
```

The session cookie, its 8-hour lifetime, and the economic subject it resolves to (**Party**) are the same
mechanism used everywhere else in this integration — LAUNCH only changes how the session gets
established.

**Failure:** `401 INVALID_LAUNCH_CODE` — see §8. No neutral HTML error page is defined for this version;
if you need a specific fallback UX in the WebView, build it on your own side around this status code.

⚠️ **No HMAC is required — and none is checked — on this call.** This is intentional, not an oversight:
the opaque `code` in the URL **is itself the one-time credential**. See §6 for the full list of
guarantees that make this safe.

## 6. Launch Grant — security invariants (frozen, do not implement around them)

These ten invariants are the security core of this mechanism — every one of them was reviewed and
frozen before this channel was built. If your integration ever seems to require working around one of
these, stop and contact us rather than finding a way past it.

```text
1.  launchCode MUST be cryptographically random.
2.  launchCode MUST be opaque — MUST NOT encode externalUserId or campaignId.
3.  launchCode MUST be single-use.
4.  launchCode MUST have a short expiration (60 seconds for v1 — this invariant is about the
    EXISTENCE of a short expiry, not about the specific number 60).
5.  launchCode MUST be bound to: partner + campaign + externalUserId (all three).
6.  The Launch API (POST .../launch) MUST be authenticated server-to-server — MUST NOT accept calls
    directly from a partner mobile app or browser.
7.  Consuming the same launchCode concurrently MUST allow at most one successful session
    establishment (atomic consume).
8.  The Launch URL MUST use HTTPS.
9.  🔴 Creator-OS MUST NOT trust campaignId or externalUserId supplied by the browser/WebView at
    GET /launch time — see §6.1.
10. The browser/WebView only ever presents the launchCode; identity and campaign scope come from the
    server-side Launch Grant record, resolved by looking up the code — never from the request.
```

### 6.1 Why invariant #9 matters — a concrete attack scenario

```text
You call:        POST .../launch  { campaignId: A, externalUserId: X }
We return:        { launchUrl: "https://creator-os.example/api/v1/launch?code=ABC" }
WebView opens:    GET /launch?code=ABC&campaignId=B     ← campaignId added/altered on the URL
```

We only ever read `code` from the query string at this endpoint — every other parameter, if present, is
silently ignored. The `campaignId` and `externalUserId` that decide what happens next always come from
the Launch Grant record created in step 1, never from anything appended to `launchUrl` after we issued
it. Appending or editing query parameters on `launchUrl` has no effect.

### 6.2 `launchUrl` is not a permanent credential

```text
launchUrl  ≠  campaign URL
           ≠  API credential
           ≠  session token
```

It is a **one-time bootstrap credential** used to establish a Creator-OS session. The instant it is
consumed (successfully or not), the underlying `launchCode` is invalid — from that point on, the session
cookie set in step 2, not `launchUrl`, is what carries the user's authentication.

Do not store, log, bookmark, or re-share a `launchUrl`. Do not build a "resend the same launch link"
feature — call step 1 again to get a new one.

## 7. Partner ↔ campaign scope — what your `accessKey` is allowed to launch

Your integration's capability to call this channel is a **tenant-level boundary**, not a per-campaign
allowlist: once your `accessKey` is provisioned for the LAUNCH channel, it can request a launch for
**any** campaign belonging to your tenant — there is no separate per-campaign permission to request.

Whether a **specific** campaign can actually be launched right now is a **separate, additional** check —
its own state (`active`) and display window, evaluated independently at step 1. A request naming a
campaign outside that state fails with `422 CAMPAIGN_NOT_LAUNCHABLE` (§8) even though your `accessKey`
is otherwise authorized.

🔴 **`externalUserId` MUST be the same value you use on the EVENT channel for this user** (see
[README.md](./README.md) § Identifier semantics). A mismatch does not fail visibly: the session
establishes, but reward attribution for that user can silently diverge from their event history.

## 8. Error codes

Full context and the general HTTP status table:
[error-codes.md](./error-codes.md#launch-channel--post-apiv1campaignscampaignidlaunch).

**`POST /campaigns/:campaignId/launch`** (server-to-server, HMAC required):

| Code | HTTP | When |
|---|:--:|---|
| — *(standard auth failure, see [error-codes.md](./error-codes.md#general-http-semantics))* | `401` | bad key, bad signature, or expired timestamp |
| `CAMPAIGN_NOT_FOUND` | `404` | campaign does not exist, **or** it belongs to a different tenant than your integration — intentionally indistinguishable, same reasoning as every other cross-tenant case in this integration |
| `CAMPAIGN_NOT_LAUNCHABLE` | `422` | campaign exists and is yours, but is not currently `active` / outside its display window |

**`GET /launch`** (WebView-facing, no HMAC):

| Code | HTTP | When |
|---|:--:|---|
| `INVALID_LAUNCH_CODE` | `401` | code does not exist, has expired, or was already consumed — **one code covers all three causes, deliberately** |

⚠️ **Do not try to distinguish "expired" from "already used" from "never existed" on the `GET /launch`
response.** Splitting this into separate codes (e.g. `410` for expired, `403` for reused) would let
anyone probing this endpoint learn which guess was closer to a real code. If a user reports being stuck
here, trace the underlying Launch Grant on our side rather than inferring the cause from the HTTP
response.

## 9. Security requirements

- [ ] Signature on `POST .../launch` matches [testing.md](./testing.md) once the LAUNCH channel
      conformance vectors are published
- [ ] LAUNCH Secret Key lives on the **server**, is different from your EVENT secret, and does not
      share signing code with the EVENT channel (§3)
- [ ] `POST .../launch` is called **only** from your backend — never from a mobile app or browser
- [ ] `externalUserId` you send is the **exact same value** you use on the EVENT channel for this user
- [ ] You open `launchUrl` in the WebView **immediately** — it expires 60 seconds after issue
- [ ] You never persist, log, or re-display a `launchUrl` after using it once
- [ ] You do not append, read, or rely on any query parameter on `launchUrl` other than the `code` we
      issued
- [ ] Server clock is NTP-synced, drift under 1 minute

## 10. FAQ

**Can we request a launch before the user has done anything in our app?**
Yes — nothing about this channel requires any prior handoff. `externalUserId` only needs to be your own
stable identifier for that user; the identity itself is resolved and, if needed, provisioned by us when
the WebView consumes the code.

**Can we reuse a `launchUrl` if the user closes the WebView before it loads?**
No. Call step 1 again. A `launchCode` is single-use regardless of whether the previous attempt actually
reached us — even a WebView that never finished loading may have already consumed it.

**What happens if the campaign changes state (e.g. gets paused) between step 1 and step 2?**
The Launch Grant already exists and step 2 does not re-check campaign eligibility — it only checks the
grant's own expiry and single-use state. Eligibility (§7) is evaluated once, at step 1.

**Do we need to build any login UI on our side?**
No. The whole flow is two calls — a server request and opening a URL. The user never sees anything of
ours until the campaign page itself loads.

**Does the LAUNCH secret rotate together with EVENT?**
No — all channel secrets are independent; rotating or revoking one never affects another (see
[testing.md § Key rotation](./testing.md#3-key-rotation)).
