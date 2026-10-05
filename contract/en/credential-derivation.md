# Credential Derivation — `IntegrationCredentialDerivationV1`

Start here: [README.md](./README.md).

Creator-OS gives you one `accessKey` and one `masterSecret`. Store the master on your server as a
high-value credential. It is displayed once and cannot be retrieved later.

`integrationId` is not an input to this contract. Each issued credential set has a freshly generated
master; never reuse a master across integrations.

Do not use the master directly for HMAC. Derive one isolated `channelKey` for the channel and version
announced by Creator-OS:

| Parameter | Value |
|---|---|
| KDF | HKDF (RFC 5869) |
| Hash | SHA-256 |
| Input key material | the 32 bytes obtained by base64url-decoding `masterSecret` |
| Salt | empty byte string |
| Info | UTF-8 `integration:channel:<CHANNEL>:v<VERSION>` |
| Output | 32 bytes, encoded as unpadded base64url |

`CHANNEL` is uppercase: `EVENT`, `LAUNCH`, `RECOVERY`, `SETTLEMENT` (and `AUTH` for a legacy integration). `RECOVERY` and `SETTLEMENT` only matter if you build those optional endpoints. The
version is a positive decimal integer returned by Creator-OS; never guess it.

```js
import { hkdfSync } from 'node:crypto';

export function deriveChannelKey(masterSecret, channel, version) {
  const info = `integration:channel:${channel}:v${version}`;
  return Buffer.from(hkdfSync(
    'sha256', Buffer.from(masterSecret, 'base64url'), Buffer.alloc(0), Buffer.from(info, 'utf8'), 32,
  )).toString('base64url');
}
```

The machine-readable vectors are in
[`../integration-credential-derivation-v1.test-vector.json`](../integration-credential-derivation-v1.test-vector.json).
Pin them in your unit tests before calling the sandbox.

## Verify against the vectors in 10 seconds

Run exactly this next to the vector file. `4/4` means your derivation is correct — no guessing, and
no probing the sandbox just to read a `401`.

```bash
node -e '
  const { hkdfSync } = require("node:crypto");
  const v = require("./integration-credential-derivation-v1.test-vector.json");
  const ikm = Buffer.from(v.masterSecret, "base64url");
  let ok = 0;
  for (const t of v.vectors) {
    const info = `integration:channel:${t.channel}:v${t.version}`;
    const got  = Buffer.from(
      hkdfSync("sha256", ikm, Buffer.alloc(0), Buffer.from(info, "utf8"), v.outputBytes),
    ).toString("base64url");
    const hit = got === t.channelKey;
    if (hit) ok++;
    console.log(`${hit ? "✓" : "✗"} ${t.channel} v${t.version}`);
  }
  console.log(`${ok}/${v.vectors.length}`);
'
```

## Getting the key for one channel

```bash
MASTER_SECRET='<your masterSecret — 43-char base64url>'

derive() {   # derive <CHANNEL> <VERSION>
  node -e '
    const { hkdfSync } = require("node:crypto");
    const ikm  = Buffer.from(process.argv[1], "base64url");
    const info = Buffer.from(`integration:channel:${process.argv[2]}:v${process.argv[3]}`, "utf8");
    process.stdout.write(
      Buffer.from(hkdfSync("sha256", ikm, Buffer.alloc(0), info, 32)).toString("base64url"));
  ' "$MASTER_SECRET" "$1" "$2"
}

EVENT_KEY=$(derive EVENT 1)        # sign events    → event-ingestion.md
LAUNCH_KEY=$(derive LAUNCH 1)      # sign launches  → campaign-launch.md
RECOVERY_KEY=$(derive RECOVERY 1)  # VERIFY what we send you → recovery.md
SETTLEMENT_KEY=$(derive SETTLEMENT 1)  # VERIFY the point notifications we send you → settlement.md
```

## Four integration mistakes — read before debugging a `401`

| | |
|---|---|
| **`masterSecret` gets DECODED, `channelKey` does NOT** | the master is HKDF *input*, so `base64url_decode` it to 32 bytes. The returned channel key is a *string* — use it **as-is** as the HMAC key; decoding it again yields a different key |
| **base64url ≠ base64** | alphabet uses `-` and `_` instead of `+` and `/`, and there is **no `=` padding**. A plain base64 decoder produces wrong bytes |
| **`CHANNEL` is UPPERCASE in `info`** | `integration:channel:**LAUNCH**:v1`. This string is case-sensitive |
| **`I` `l` `1` · `O` `0` look alike** | never retype `masterSecret` from a screenshot or printed doc. Copy the string, or compare a `sha256` of the string itself |

⚠️ All four produce the **same** `401` — the gate deliberately returns one message for every cause to
prevent key probing. So a `401` does not tell you where you went wrong; the vector check above does.

## Rotation

Rotation changes only one channel version. For example, EVENT v1 and v2 remain valid together while
you deploy v2. Derive v2 with the same master, move every sender to v2, wait until Creator-OS reports
v2 as in use, then request revocation of v1. Other channel versions do not change.

If the `masterSecret` itself may be compromised, stop normal per-channel rotation and request a full
credential-set re-issue.
