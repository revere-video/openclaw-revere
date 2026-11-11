import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { handle, verifySignature, timestampFresh, toHookPayload, TOLERANCE_SECONDS, MAX_BODY_BYTES } from '../index.mjs';

// The request Revere's own documentation prints (docs/webhooks.md), with its secret and its signatures.
const SECRET = 'example-secret-do-not-use';
const DOC_TIMESTAMP = '1791568133';
const DOC_BODY = JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', event: 'motion.detected', timestamp: '2026-10-09T17:48:53.823Z', data: { device_id: '00000000-0000-4000-8000-000000000002', device_name: 'Driveway', gateway_id: '00000000-0000-4000-8000-000000000003', start_time: '2026-10-09T17:47:55.000Z', end_time: '2026-10-09T17:48:01.000Z', motion: 40, avg_motion: 12 } });
const DOC_V2 = 'mw2F10qbwRoFY7kBYfifdMQk5uzABA077mhAUMtaFo0=';

const sign = (ts, body, secret = SECRET) => createHmac('sha256', secret).update(`${ts}.${body}`).digest('base64');
const NOW_MS = Number(DOC_TIMESTAMP) * 1000;
const detection = (over = {}) => ({ id: 'ev-1', event: 'object.detected', timestamp: '2026-10-09T17:48:53.823Z', data: { device_id: 'cam-1', device_name: 'Front door', labels: ['person'], motion_start_time: '2026-10-09T17:47:55.000Z', motion_end_time: '2026-10-09T17:48:00.000Z', snapshot_url: 'https://api.revere.video/api/v1/webhook-media/abc', ...over } });
const ENV = { REVERE_WEBHOOK_SECRET: SECRET, OPENCLAW_HOOK_URL: 'https://claw.example.com/hooks/revere', OPENCLAW_HOOK_TOKEN: 'hook-token' };

function request(event, { ts = DOC_TIMESTAMP, secret = SECRET, headers = {}, method = 'POST', body } = {}) {
  const raw = body ?? (typeof event === 'string' ? event : JSON.stringify(event));
  return new Request('https://relay.example.com/', { method, headers: { 'x-belfry-timestamp': ts, 'x-belfry-signature-v2': sign(ts, raw, secret), ...headers }, body: method === 'POST' ? raw : undefined });
}
function forwardingTo(status = 200) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response(null, { status }); };
  return { calls, restore: () => { globalThis.fetch = original; } };
}
async function run(req, env = ENV, status = 200) {
  const f = forwardingTo(status);
  try { const res = await handle(req, env, NOW_MS); return { res, body: await res.json(), calls: f.calls }; } finally { f.restore(); }
}

test("verifies the signature Revere's documentation prints", async () => {
  assert.equal(sign(DOC_TIMESTAMP, DOC_BODY), DOC_V2);
  assert.equal(await verifySignature(SECRET, DOC_TIMESTAMP, DOC_BODY, DOC_V2), true);
});

test('refuses a wrong secret, a changed body, a changed timestamp, and anything malformed', async () => {
  assert.equal(await verifySignature('other', DOC_TIMESTAMP, DOC_BODY, DOC_V2), false);
  assert.equal(await verifySignature(SECRET, DOC_TIMESTAMP, DOC_BODY + ' ', DOC_V2), false);
  assert.equal(await verifySignature(SECRET, '1791568134', DOC_BODY, DOC_V2), false);
  for (const bad of [null, undefined, '', 'not base64!!', 'AAAA', DOC_V2.slice(0, 10)]) assert.equal(await verifySignature(SECRET, DOC_TIMESTAMP, DOC_BODY, bad), false);
  assert.equal(await verifySignature('', DOC_TIMESTAMP, DOC_BODY, DOC_V2), false);
});

test('the timestamp must be within five minutes, either way, and a number', () => {
  const now = Number(DOC_TIMESTAMP);
  assert.equal(timestampFresh(DOC_TIMESTAMP, now), true);
  assert.equal(timestampFresh(DOC_TIMESTAMP, now + TOLERANCE_SECONDS), true);
  assert.equal(timestampFresh(DOC_TIMESTAMP, now + TOLERANCE_SECONDS + 1), false);
  assert.equal(timestampFresh(DOC_TIMESTAMP, now - TOLERANCE_SECONDS - 1), false);
  for (const bad of [null, undefined, '', 'abc', '12', '1791568133.5', '-1791568133']) assert.equal(timestampFresh(bad, now), false);
});

test('forwards an allowed event to OpenClaw with the bearer token and the event id as the idempotency key', async () => {
  const { res, body, calls } = await run(request(detection()));
  assert.equal(res.status, 200);
  assert.deepEqual(body, { ok: true, forwarded: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://claw.example.com/hooks/revere');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer hook-token');
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'ev-1');
  assert.equal(calls[0].init.redirect, 'manual');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    source: 'revere', event: 'object.detected', id: 'ev-1', occurred_at: '2026-10-09T17:48:53.823Z', camera: { id: 'cam-1', name: 'Front door' },
    labels: ['person'], start_time: '2026-10-09T17:47:55.000Z', end_time: '2026-10-09T17:48:00.000Z',
  });
});

test('the snapshot link is not forwarded unless asked for, and only if it is https', async () => {
  assert.equal(JSON.parse((await run(request(detection()))).calls[0].init.body).snapshot_url, undefined);
  const on = { ...ENV, FORWARD_SNAPSHOT: 'true' };
  assert.equal(JSON.parse((await run(request(detection()), on)).calls[0].init.body).snapshot_url, 'https://api.revere.video/api/v1/webhook-media/abc');
  assert.equal(JSON.parse((await run(request(detection({ snapshot_url: 'http://x/y' })), on)).calls[0].init.body).snapshot_url, undefined);
});

test('unsigned, mis-signed, stale and replayed-with-a-new-timestamp requests are refused with one answer and nothing is forwarded', async () => {
  const cases = [
    new Request('https://relay.example.com/', { method: 'POST', body: JSON.stringify(detection()) }),
    request(detection(), { secret: 'other' }),
    request(detection(), { ts: String(Number(DOC_TIMESTAMP) - TOLERANCE_SECONDS - 1) }),
    request(detection(), { headers: { 'x-belfry-timestamp': String(Number(DOC_TIMESTAMP) + 1) } }),
    request(detection(), { headers: { 'x-belfry-signature-v2': DOC_V2 } }),
  ];
  const answers = [];
  for (const c of cases) {
    const { res, body, calls } = await run(c);
    assert.equal(res.status, 401);
    assert.equal(calls.length, 0);
    answers.push(JSON.stringify(body));
  }
  assert.equal(new Set(answers).size, 1);
});

test('only POST, and a relay that is not set up fails closed rather than accepting', async () => {
  assert.equal((await run(new Request('https://relay.example.com/', { method: 'GET' }))).res.status, 405);
  for (const missing of ['REVERE_WEBHOOK_SECRET', 'OPENCLAW_HOOK_URL', 'OPENCLAW_HOOK_TOKEN']) {
    const env = { ...ENV, [missing]: undefined };
    const { res, calls } = await run(request(detection()), env);
    assert.equal(res.status, 500);
    assert.equal(calls.length, 0);
  }
  assert.equal((await run(request(detection()), { ...ENV, OPENCLAW_HOOK_URL: 'http://claw.example.com/hooks/revere' })).res.status, 500);
  assert.equal((await run(request(detection()), { ...ENV, OPENCLAW_HOOK_URL: 'not a url' })).res.status, 500);
});

test('events outside the allow list, and the test payload, are answered 200 and not forwarded', async () => {
  const motion = JSON.parse(DOC_BODY);
  let r = await run(request(motion));
  assert.deepEqual(r.body, { ok: true, forwarded: false, reason: 'event not allowed' });
  assert.equal(r.calls.length, 0);
  r = await run(request(motion), { ...ENV, ALLOWED_EVENTS: 'motion.detected, object.detected' });
  assert.equal(r.body.forwarded, true);
  r = await run(request({ event: 'test', data: {} }));
  assert.deepEqual(r.body, { ok: true, forwarded: false, reason: 'test' });
  assert.equal(r.calls.length, 0);
});

test('a delivery Revere sends twice is forwarded once when a SEEN namespace is bound', async () => {
  const store = new Map();
  const SEEN = { get: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } };
  const env = { ...ENV, SEEN };
  assert.equal((await run(request(detection()), env)).body.forwarded, true);
  const again = await run(request(detection()), env);
  assert.deepEqual(again.body, { ok: true, forwarded: false, reason: 'duplicate' });
  assert.equal(again.calls.length, 0);
});

test('a failing OpenClaw is answered 502 so Revere retries, and the event is not marked seen', async () => {
  const store = new Map();
  const SEEN = { get: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } };
  const bad = await run(request(detection()), { ...ENV, SEEN }, 401);
  assert.equal(bad.res.status, 502);
  assert.equal(store.size, 0);
  const ok204 = await run(request(detection()), { ...ENV, SEEN }, 204);
  assert.equal(ok204.res.status, 200);
  const down = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('connect refused'); };
  try { assert.equal((await handle(request(detection({}), {}), ENV, NOW_MS)).status, 502); } finally { globalThis.fetch = down; }
});

test('a body that is too large, not JSON, or not an event is refused', async () => {
  assert.equal((await run(request('x'.repeat(MAX_BODY_BYTES + 1)))).res.status, 413);
  assert.equal((await run(request('not json'))).res.status, 400);
  assert.equal((await run(request('{"id":"x"}'))).res.status, 400);
});

test('the forwarded text is fixed in shape and cut short: a long camera name, an odd label list, and no other field passes', () => {
  const p = toHookPayload({ id: 'i', event: 'object.detected', timestamp: 't', data: { device_id: 'c', device_name: 'x'.repeat(500), labels: ['a', 7, 'b'], gateway_id: 'secret-gw', detections: [{ class_name: 'person' }], extra: 'no' } });
  assert.equal(p.camera.name.length, 120);
  assert.deepEqual(p.labels, ['a', 'b']);
  assert.equal(JSON.stringify(p).includes('secret-gw'), false);
  assert.equal(JSON.stringify(p).includes('"extra"'), false);
});

test('the relay never writes a body, a token or a link to the log', async () => {
  const logs = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a) => logs.push(a.join(' '));
  try { await run(request(detection()), { ...ENV, FORWARD_SNAPSHOT: 'true' }); await run(request(detection(), { secret: 'x' })); } finally { Object.assign(console, orig); }
  assert.deepEqual(logs, []);
});
