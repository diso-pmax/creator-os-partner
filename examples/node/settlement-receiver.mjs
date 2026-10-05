#!/usr/bin/env node
// Reference receiver for the SETTLEMENT channel (`PartnerSettlementSignatureV1`).
//
// It is the endpoint WE call when our operations team sends a settled point amount to you:
//     POST <your settlement_endpoint>      (see contract/en/settlement.md)
//
// Run it:
//     SETTLEMENT_SECRET=<your channel secret> node examples/node/settlement-receiver.mjs --port 8080
//     (during a key rotation: SETTLEMENT_SECRETS=<new secret>,<old secret> — newest first, comma separated)
//
// Check it without a network, without a real secret:
//     node examples/node/settlement-receiver.mjs --self-test
//
// Only `node:http`, `node:crypto` and `node:fs`. MIT licensed, copy it into your own service.
//
// What it does, in this order (the order matters, it is the order the platform expects):
//   0. 405  not a POST            413  body larger than 64 KB (checked before anything is buffered)
//   1. 401  key id / signature missing or wrong, unknown key id, timestamp outside +-5 minutes.
//           The signature is checked against EVERY secret you gave for that key id, newest first: the platform signs
//           with the NEW key the moment a rotation completes and `X-Platform-Key-Id` does not change between versions,
//           so keep the old secret until we tell you it is revoked (contract section 3, "Key rotation").
//   2. 400  the signed body is not JSON                         422  the signed body has no `deliveryNonce`
//   3. 409  this `deliveryNonce` was already seen (replay)   <- YOUR obligation, contract section 4;
//           our "Ask the partner again" button resends the same nonce and reads 409 as "already received"
//   4. 200  first time: nonce recorded, packet printed
//
// The nonce store is a JSON file rewritten on every new nonce, so a restart does not forget what was
// received. That is O(n) per delivery: for a high-volume receiver replace it with your own database.
//
// Behind a reverse proxy: the signature covers the path and query EXACTLY as we sent them. If your proxy
// strips a prefix or rewrites the path, verify against the original URL (for example `X-Forwarded-Uri`).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

/** +-5 minutes, the same freshness window as every other signing scheme of the contract. */
export const FRESHNESS_WINDOW_MS = 5 * 60_000;

/** A settlement packet is a few hundred bytes. Anything bigger is refused before it is buffered. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * signing_string = <timestamp> "." <METHOD, uppercase> "." <path + query, exactly as on the request line> "." <raw body>
 * signature      = "sha256=" + lowercase_hex( HMAC-SHA256( SETTLEMENT_SECRET, signing_string ) )
 *
 * `rawBody` must be the EXACT bytes received. Never parse and re-serialize before checking.
 */
export function signSettlement(secret, tsSeconds, method, pathAndQuery, rawBody) {
  const base = Buffer.concat([
    Buffer.from(`${tsSeconds}.${String(method).toUpperCase()}.${pathAndQuery}.`, 'utf8'),
    Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody ?? '', 'utf8'),
  ]);
  return 'sha256=' + createHmac('sha256', secret).update(base).digest('hex');
}

/** Constant-time comparison, do not use `===` on signatures. */
function sameSignature(expected, given) {
  const a = Buffer.from(expected);
  const b = Buffer.from(given ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A nonce store that survives a restart. `file` is optional: without it the store lives in memory only. */
export function createNonceStore(file) {
  const seen = new Set();
  if (file && existsSync(file)) {
    try {
      for (const n of JSON.parse(readFileSync(file, 'utf8'))) seen.add(String(n));
    } catch {
      // A corrupt store must not silently become an empty one: an empty store accepts every replay.
      throw new Error(`nonce store ${file} is not a JSON array of strings, fix or remove it`);
    }
  }
  return {
    has: (nonce) => seen.has(nonce),
    add(nonce) {
      if (!file) {
        seen.add(nonce);
        return;
      }
      const next = new Set(seen).add(nonce);
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify([...next])); // throws on a full disk: nothing is remembered, caller answers 500
      renameSync(tmp, file); // atomic replace, a crash never leaves half a file
      seen.add(nonce);
    },
    size: () => seen.size,
  };
}

/**
 * @param {object} opts
 * @param {Record<string, string | string[]>} [opts.secretsByKeyId]  secrets per `X-Platform-Key-Id`. A value is ONE secret or a
 *                                                       LIST (newest first): a key id keeps the SAME value across rotations
 *                                                       (the platform signs with the new key at once), so during a rotation
 *                                                       list both the new and the old secret under the same key id.
 * @param {string[]} [opts.secrets]                      several secrets accepted for ANY key id, newest first.
 * @param {string} [opts.secret]                         one secret accepted for ANY key id (simple setups).
 * @param {{has:(n:string)=>boolean, add:(n:string)=>void}} [opts.nonceStore]
 * @param {(line:object)=>void} [opts.log]               called for every ACCEPTED packet.
 * @param {()=>number} [opts.now]                        epoch ms, injectable for tests.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void}
 */
export function createReceiver(opts = {}) {
  const nonceStore = opts.nonceStore ?? createNonceStore();
  const log = opts.log ?? ((line) => console.log(JSON.stringify(line)));
  const now = opts.now ?? Date.now;

  /** Every secret that may have signed a call carrying this key id, newest first. Empty = unknown key id. */
  const secretsFor = (keyId) => {
    if (!keyId) return []; // every call carries X-Platform-Key-Id
    if (opts.secretsByKeyId) {
      return Object.hasOwn(opts.secretsByKeyId, keyId) ? [opts.secretsByKeyId[keyId]].flat().filter(Boolean) : [];
    }
    if (opts.secrets) return opts.secrets.filter(Boolean); // any key id is accepted
    return opts.secret ? [opts.secret] : []; // single-secret setups: any key id is accepted
  };

  return (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST') return reply(405, { error: 'POST only' });

    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      res.writeHead(413, { Connection: 'close' });
      return res.end();
    }
    const chunks = [];
    let received = 0;
    req.on('error', () => {});
    req.on('data', (c) => {
      received += c.length;
      if (received > MAX_BODY_BYTES) {
        res.writeHead(413, { Connection: 'close' });
        res.end();
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (received > MAX_BODY_BYTES) return;
      const raw = Buffer.concat(chunks);

      // 1. authenticate: key id -> secret, freshness, signature over the RAW bytes
      const keyId = req.headers['x-platform-key-id'];
      const tsHeader = String(req.headers['x-platform-timestamp'] ?? '');
      const given = String(req.headers['x-platform-signature'] ?? '');
      const secrets = secretsFor(typeof keyId === 'string' ? keyId : '');
      // Unix seconds, digits only: sign the header exactly as received, never a re-formatted number.
      if (secrets.length === 0 || !/^\d{1,12}$/.test(tsHeader) || !given) return reply(401, { error: 'missing or unknown credentials' });
      if (Math.abs(now() - Number(tsHeader) * 1000) > FRESHNESS_WINDOW_MS) return reply(401, { error: 'timestamp outside the freshness window' });
      // Try the secrets you have for this key id, newest first: the first match is enough, and each comparison is constant-time.
      if (!secrets.some((secret) => sameSignature(signSettlement(secret, tsHeader, req.method, req.url ?? '/', raw), given))) {
        return reply(401, { error: 'bad signature' });
      }

      // 2. the body is signed, so it is safe to read now
      let packet;
      try {
        packet = JSON.parse(raw.toString('utf8'));
      } catch {
        return reply(400, { error: 'body is not JSON' });
      }
      const nonce = packet?.deliveryNonce;
      if (typeof nonce !== 'string' || nonce === '') return reply(422, { error: 'deliveryNonce is required' });

      // 3. replay protection: the dedup key is the NONCE, never `settlementItemId`
      //    (the same item legitimately arrives again with a new nonce when our ops press "Retry").
      if (nonceStore.has(nonce)) return reply(409, { error: 'deliveryNonce already seen' });

      // 4. first time: remember it BEFORE answering, then do your own processing
      try {
        nonceStore.add(nonce);
      } catch {
        // Could not remember the nonce: do NOT process the packet, ask us to retry (we will, with "Retry").
        return reply(500, { error: 'could not record the nonce' });
      }
      log({
        settlementItemId: packet.settlementItemId,
        externalUserId: packet.externalUserId, // present once the contract carries it
        pointAmount: packet.pointAmount,
        moneyAmount: packet.moneyAmount,
        moneyCurrency: packet.moneyCurrency,
        deliveryNonce: nonce,
      });
      return reply(200, { received: true });
    });
  };
}

/** Start listening. `port: 0` picks a free port (used by tests). Resolves with `{ server, port }`. */
export function startReceiver({ port = 8080, host = '0.0.0.0', ...opts } = {}) {
  const server = createServer(createReceiver(opts));
  server.requestTimeout = 15_000; // slow-loris guard: the platform itself gives up after 10 s
  server.headersTimeout = 10_000;
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve({ server, port: server.address().port }));
  });
}

/**
 * Secrets from the environment. `SETTLEMENT_SECRETS` is a comma separated list, NEWEST FIRST, accepted for any key id (use it
 * during a rotation: the new secret, then the old one). `SETTLEMENT_SECRET` is one secret. `SETTLEMENT_SECRETS_JSON` maps a key id to
 * one secret or a list. Returns `{}` when nothing is set. Setting the JSON map together with `SETTLEMENT_SECRET(S)` is an ERROR (one
 * of them would otherwise win silently).
 */
export function secretsFromEnv(env) {
  const out = {};
  const list = String(env.SETTLEMENT_SECRETS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  if (list.length > 0) out.secrets = list;
  else if (env.SETTLEMENT_SECRET) out.secret = env.SETTLEMENT_SECRET;
  if (env.SETTLEMENT_SECRETS_JSON) {
    // Two ways to say the same thing: refuse the ambiguity instead of letting one silently win.
    if (out.secrets || out.secret) {
      throw new Error('set SETTLEMENT_SECRETS_JSON (a secret or list per key id) OR SETTLEMENT_SECRET / SETTLEMENT_SECRETS (any key id), not both');
    }
    out.secretsByKeyId = JSON.parse(env.SETTLEMENT_SECRETS_JSON);
  }
  return out;
}

// ── Self-test with a FIXED vector (no network, no real secret) ──────────────────────────────────
// The same inputs and the same expected value are checked against the platform code by a guard test.
export const SELF_TEST_VECTOR = {
  secret: 'settlement-demo-secret-0123456789',
  ts: 1786698753,
  method: 'POST',
  pathAndQuery: '/api/v1/settlements?src=demo',
  body: '{"settlementItemId":"item-1","pointAmount":"100","deliveryNonce":"nonce-1"}',
  signature: 'sha256=ec3738bfe0d678e711632808885252abb02baf62e5bad673fb12e9718bdfd5d4',
};

async function selfTest() {
  const v = SELF_TEST_VECTOR;
  const got = signSettlement(v.secret, v.ts, v.method, v.pathAndQuery, v.body);
  const ok = got === v.signature;
  console.log(`${ok ? 'PASS' : 'FAIL'}  PartnerSettlementSignatureV1 vector`);
  if (!ok) {
    console.log(`   got      : ${got}`);
    console.log(`   expected : ${v.signature}`);
    console.log('\n   Usual suspects, in this order:');
    console.log('     1. a missing "." between the four parts of the signing string');
    console.log('     2. the body was parsed and re-serialized before signing');
    console.log('     3. the path was normalized (query dropped, %xx decoded) instead of kept exactly as on the request line');
    return false;
  }

  // Round trip against a real listener: first 200, replay 409, bad signature 401.
  const { server, port } = await startReceiver({ port: 0, host: '127.0.0.1', secret: v.secret, log: () => {} });
  try {
    const send = async (body, signatureOf = (ts, p, b) => signSettlement(v.secret, ts, 'POST', p, b)) => {
      const ts = Math.floor(Date.now() / 1000);
      const p = '/hook';
      const r = await fetch(`http://127.0.0.1:${port}${p}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Platform-Key-Id': 'self-test',
          'X-Platform-Timestamp': String(ts),
          'X-Platform-Signature': signatureOf(ts, p, body),
        },
        body,
      });
      return r.status;
    };
    const body = JSON.stringify({ settlementItemId: 'x', deliveryNonce: `self-test-${Date.now()}` });
    const results = [
      ['first delivery -> 200', await send(body), 200],
      ['same nonce again -> 409', await send(body), 409],
      ['wrong signature -> 401', await send(body.replace('x', 'y'), () => 'sha256=00'), 401],
      ['no deliveryNonce -> 422', await send(JSON.stringify({ settlementItemId: 'x' })), 422],
    ];
    // Rotation: a receiver holding the new AND the old secret under one key id accepts a call signed with either.
    const rot = await startReceiver({ port: 0, host: '127.0.0.1', secrets: ['new-secret', v.secret], log: () => {} });
    try {
      const sendRot = async (secret) => {
        const ts = Math.floor(Date.now() / 1000);
        const p = '/hook';
        const body2 = JSON.stringify({ settlementItemId: 'r', deliveryNonce: `self-test-rot-${secret}-${Date.now()}` });
        const r = await fetch(`http://127.0.0.1:${rot.port}${p}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Platform-Key-Id': 'self-test', 'X-Platform-Timestamp': String(ts), 'X-Platform-Signature': signSettlement(secret, ts, 'POST', p, body2) },
          body: body2,
        });
        return r.status;
      };
      results.push(['rotation: signed with the NEW secret -> 200', await sendRot('new-secret'), 200]);
      results.push(['rotation: signed with the OLD secret -> 200', await sendRot(v.secret), 200]);
      results.push(['rotation: signed with an unknown secret -> 401', await sendRot('stranger'), 401]);
    } finally {
      rot.server.close();
    }
    let all = true;
    for (const [name, got2, want] of results) {
      const pass = got2 === want;
      all = all && pass;
      console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : ` (got ${got2})`}`);
    }
    return all;
  } finally {
    server.close();
  }
}

function argValue(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (process.argv.includes('--self-test')) {
    selfTest().then((ok) => process.exit(ok ? 0 : 1));
  } else {
    let configured;
    try {
      configured = secretsFromEnv(process.env);
    } catch (e) {
      console.error(String(e?.message ?? e));
      process.exit(2);
    }
    if (!configured.secret && !configured.secrets && !configured.secretsByKeyId) {
      console.error(
        'Set SETTLEMENT_SECRET (one secret for any key id), SETTLEMENT_SECRETS (several, newest first, comma separated) ' +
          'or SETTLEMENT_SECRETS_JSON ({"<keyId>":"<secret>" or ["<new>","<old>"]}).',
      );
      process.exit(2);
    }
    const port = Number(argValue('--port', process.env.PORT ?? '8080'));
    const nonceStore = createNonceStore(argValue('--nonce-file', process.env.NONCE_FILE ?? 'settlement-nonces.json'));
    startReceiver({ port, ...configured, nonceStore }).then(({ port: p }) => {
      console.error(`settlement receiver listening on :${p} (nonces remembered: ${nonceStore.size()})`);
    });
  }
}
