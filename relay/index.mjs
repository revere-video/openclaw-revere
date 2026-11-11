// Revere webhook relay for OpenClaw: a stateless Cloudflare Worker (or any fetch-style runtime) that you run yourself.
//
// Why it exists. Revere sends a webhook to a public https address and signs it with HMAC (X-Belfry-Signature-V2); it
// cannot add an Authorization header. OpenClaw's inbound hooks want `Authorization: Bearer <token>` and are meant to sit
// behind loopback, a tailnet or a trusted proxy. This sits between them: it verifies Revere's signature and timestamp,
// drops repeats, and forwards a small, fixed-shape event to your OpenClaw hook with the bearer token.
//
// No dependencies, no storage you have to set up (a KV namespace named SEEN is optional, for dedupe), and it never logs a
// body, a token or a link.
//
// Settings (Worker secrets and variables):
//   REVERE_WEBHOOK_SECRET  required  the secret set on the Revere webhook
//   OPENCLAW_HOOK_URL      required  https URL of your OpenClaw hook, e.g. https://claw.example.com/hooks/revere
//   OPENCLAW_HOOK_TOKEN    required  your OpenClaw hooks token
//   ALLOWED_EVENTS         optional  comma list; default "object.detected,health.camera_stale,health.camera_recovered"
//   FORWARD_SNAPSHOT       optional  "true" to pass the snapshot link on (it is a bearer link good for 10 minutes)
//   SEEN                   optional  KV namespace, to drop a delivery Revere sends twice

export const TOLERANCE_SECONDS = 300;
export const MAX_BODY_BYTES = 256 * 1024;
export const DEFAULT_EVENTS = ['object.detected', 'health.camera_stale', 'health.camera_recovered'];
const FORWARD_TIMEOUT_MS = 10_000;
const SEEN_TTL_SECONDS = 24 * 60 * 60;

const encoder = new TextEncoder();

function fromBase64(b64) {
  try {
    const bin = atob(b64);
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Revere's v2 signature: base64 HMAC-SHA256 of `${timestamp}.${rawBody}` with the webhook's secret. Compared by
 * crypto.subtle.verify, which is constant time. False for anything malformed.
 */
export async function verifySignature(secret, timestamp, rawBody, signatureB64) {
  const sig = typeof signatureB64 === 'string' ? fromBase64(signatureB64.trim()) : null;
  if (!secret || !sig || sig.length !== 32) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, sig, encoder.encode(`${timestamp}.${rawBody}`));
}

/** Whether a unix-seconds timestamp is within the tolerance of now, either way. */
export function timestampFresh(timestamp, nowSeconds = Date.now() / 1000) {
  if (typeof timestamp !== 'string' || !/^\d{9,12}$/.test(timestamp)) return false;
  return Math.abs(nowSeconds - Number(timestamp)) <= TOLERANCE_SECONDS;
}

/** The fixed shape sent to OpenClaw. Text a camera or a model wrote (names, labels) travels as data in `camera` and `labels`. */
export function toHookPayload(event, { forwardSnapshot = false } = {}) {
  const d = event.data && typeof event.data === 'object' ? event.data : {};
  const out = {
    source: 'revere',
    event: String(event.event),
    id: String(event.id),
    occurred_at: typeof event.timestamp === 'string' ? event.timestamp : null,
    camera: d.device_id ? { id: String(d.device_id), name: typeof d.device_name === 'string' ? d.device_name.slice(0, 120) : null } : null,
  };
  if (Array.isArray(d.labels)) out.labels = d.labels.filter(l => typeof l === 'string').slice(0, 10);
  if (typeof d.motion_start_time === 'string') out.start_time = d.motion_start_time;
  if (typeof d.motion_end_time === 'string') out.end_time = d.motion_end_time;
  if (typeof d.message === 'string') out.message = d.message.slice(0, 300);
  if (forwardSnapshot && typeof d.snapshot_url === 'string' && d.snapshot_url.startsWith('https://')) out.snapshot_url = d.snapshot_url;
  return out;
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function handle(request, env, now = Date.now()) {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'POST only' });
  if (!env.REVERE_WEBHOOK_SECRET || !env.OPENCLAW_HOOK_URL || !env.OPENCLAW_HOOK_TOKEN) return json(500, { ok: false, error: 'The relay is not configured' });
  let hook;
  try { hook = new URL(env.OPENCLAW_HOOK_URL); } catch { return json(500, { ok: false, error: 'OPENCLAW_HOOK_URL is not a URL' }); }
  if (hook.protocol !== 'https:') return json(500, { ok: false, error: 'OPENCLAW_HOOK_URL must be https' });

  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json(413, { ok: false, error: 'Too large' });
  const raw = await request.text();
  if (encoder.encode(raw).length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'Too large' });

  const timestamp = request.headers.get('x-belfry-timestamp');
  const signature = request.headers.get('x-belfry-signature-v2');
  // Unsigned, mis-signed and stale all get the same answer: nothing says which part failed.
  if (!timestampFresh(timestamp, now / 1000) || !(await verifySignature(env.REVERE_WEBHOOK_SECRET, timestamp, raw, signature))) {
    return json(401, { ok: false, error: 'Not a valid Revere delivery' });
  }

  let event;
  try { event = JSON.parse(raw); } catch { return json(400, { ok: false, error: 'Not JSON' }); }
  if (!event || typeof event.event !== 'string') return json(400, { ok: false, error: 'Not an event' });
  // The Send test payload has no id and is never forwarded.
  if (event.event === 'test' || typeof event.id !== 'string' || !event.id) return json(200, { ok: true, forwarded: false, reason: 'test' });

  const allowed = (env.ALLOWED_EVENTS ? env.ALLOWED_EVENTS.split(',') : DEFAULT_EVENTS).map(s => s.trim()).filter(Boolean);
  if (!allowed.includes(event.event)) return json(200, { ok: true, forwarded: false, reason: 'event not allowed' });

  if (env.SEEN && (await env.SEEN.get(event.id))) return json(200, { ok: true, forwarded: false, reason: 'duplicate' });

  let res;
  try {
    res = await fetch(hook.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENCLAW_HOOK_TOKEN}`, 'Idempotency-Key': event.id },
      body: JSON.stringify(toHookPayload(event, { forwardSnapshot: env.FORWARD_SNAPSHOT === 'true' })),
      redirect: 'manual',
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
  } catch {
    // Revere retries a 5xx, a timeout and a 429 for several hours, so an OpenClaw that is briefly down loses nothing.
    return json(502, { ok: false, error: 'OpenClaw could not be reached' });
  }
  // 2xx is an admission (OpenClaw's 200) or a mapping that chose to do nothing (204). Anything else is for Revere to retry.
  if (!(res.status >= 200 && res.status < 300)) return json(502, { ok: false, error: `OpenClaw answered ${res.status}` });
  if (env.SEEN) await env.SEEN.put(event.id, '1', { expirationTtl: SEEN_TTL_SECONDS });
  return json(200, { ok: true, forwarded: true });
}

export default { fetch: (request, env) => handle(request, env) };
