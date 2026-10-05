# Embedding the web view — cookies, native bridge, session

Start at: [README.md](./README.md). This page is for the person who builds the **app** that hosts our
web view. The server side of launching is in [campaign-launch.md](./campaign-launch.md).

## 1. Open `launchUrl` exactly as returned

Your server calls `POST /campaigns/:campaignId/launch` and gets a `launchUrl`
([campaign-launch.md §4.2](./campaign-launch.md#42-response)). Hand that string to the web view **unchanged**:

- do not add, remove or reorder query parameters, do not re-encode it;
- do not open it in an in-app browser tab or an external browser: the session cookie must land in the
  web view that will show the game;
- open it **immediately**: it is valid for 60 seconds and works **once**. A second open gets
  `401 INVALID_LAUNCH_CODE`, deliberately the same answer as "expired" and "never existed".

The `launchUrl` is on our **reward portal host**, not on the API host your server called. That is on
purpose, see the cookie rule below.

## 2. The web view must keep the cookie set on the redirect

Opening `launchUrl` answers `302` and sets the session cookie on that very response:

```http
HTTP/1.1 302 Found
Location: https://<reward-portal>/
Set-Cookie: __Host-player_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800
```

What that asks of your app:

| Requirement | Why |
|---|---|
| Accept and **persist cookies that arrive on a `302`** response | the session exists only because of that `Set-Cookie`; a web view that drops cookies on redirects shows a signed-out screen |
| Let the web view **follow the redirect itself** | do not intercept the `302` and re-issue the request from native code: the cookie would be set on the wrong client |
| Keep using the **same web view instance / cookie store** for the whole play session | the cookie belongs to the reward portal host and is not shared with any other host (the `__Host-` prefix forbids a `Domain` attribute) |
| HTTPS only | the cookie is `Secure` |
| Do not copy the cookie around | it is `HttpOnly`, your page and your native code have no business reading it |

On a development stack served over plain HTTP the cookie is named `player_session` without the `__Host-` prefix and without `Secure`; real environments always use HTTPS and the prefixed name.

The cookie lives **8 hours** and is not refreshed. When it ends, create a new `launchUrl` and open it
again, the user does not have to do anything.

### iOS (WKWebView) and Android (WebView)

Both platforms need nothing exotic, only that cookies are not switched off:

- **iOS**: use a normal `WKWebView` with the default, persistent website data store. An ephemeral
  (non-persistent) data store loses the cookie when the web view is torn down, and an app that
  rebuilds the web view mid-session then looks signed-out.
- **Android**: leave cookies enabled for the web view (`CookieManager.getInstance().setAcceptCookie(true)`,
  which is the default). The cookie is first-party to the reward host, no third-party cookie setting is
  needed.

If the screen opens but shows a signed-out state, the usual cause is a cookie dropped on the `302`. Test
with the Bruno or Postman collection first (request *Create a launch URL*), then with the real web view.

## 3. If opening the URL fails

Opening `launchUrl` can fail in two ways:

| Answer | Meaning | Do |
|---|---|---|
| `401 INVALID_LAUNCH_CODE` | expired, already used, or never existed: one code for all three, see [campaign-launch.md §8](./campaign-launch.md#8-error-codes) | create a **new** `launchUrl` and open it right away |
| `403 feature_disabled` | the campaign pays a reward, but the loyalty feature is not switched on for your tenant | do not retry; contact us |

No HTML error page is defined for either: the body is raw JSON. If you want a friendly fallback, build the
screen in your app around those statuses.

## 4. Native bridge (web view → app, app → web view)

Our web pages talk to the hosting app through a small bridge. You implement the receiving side.

**Web → app.** The page sends a **JSON string** `{"type": "<name>"}`:

| Platform | How the page sends it | What you register |
|---|---|---|
| iOS | `window.webkit.messageHandlers.jsMessageHandler.postMessage(<json string>)` | a `WKScriptMessageHandler` named **`jsMessageHandler`** |
| Android | `JSBridge.sendMessage(<json string>)` | a JavaScript interface named **`JSBridge`** exposing `sendMessage(String)` |

If neither exists (for example the page is opened in a normal browser) the page simply does nothing, it
does not fail.

| `type` | Meaning | What your app does |
|---|---|---|
| `close_native_webview` | the player is done and asks to leave | close the web view and return to your screen |
| `get_user_token` | the page asks the app for a user token | declared in the vocabulary; **no screen sends it today**, and sign-in does not go through the bridge (the launch already established the session) |
| `get_device_info` | the page asks the app for device information | declared in the vocabulary; **no screen sends it today** |

These three names are the whole vocabulary. Treat any other `type` as unknown and ignore it. The names
are part of the contract with the hosting app: we do not rename them.

**App → web.** Call the global function `window.__rewardNativeReceive(message)` with either a JSON
string or an already-parsed object; the page ignores anything it cannot parse. Message types in this
direction are open-ended (the app may send several kinds of reply); today no screen depends on one.

## 5. Checklist for the app builder

- [ ] `launchUrl` is opened unchanged, once, within 60 seconds of creation
- [ ] The web view keeps cookies set on a `302` and keeps one cookie store for the whole play session
- [ ] iOS uses a persistent data store; Android has cookies enabled
- [ ] `close_native_webview` is handled (the player must always have a way out)
- [ ] After 8 hours, or on `401 INVALID_LAUNCH_CODE`, the app asks your server for a new `launchUrl`
- [ ] The full round trip is in [go-live.md](./go-live.md)
