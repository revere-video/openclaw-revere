# The webhook relay

For "tell me *now*". Without it the skills poll about once a minute, which needs nothing from you. The relay is optional.

## Why a relay

- Revere sends a webhook only to a public **https** address on the standard port, never to an IP address, `localhost` or a `.local` or `.lan` name. A home OpenClaw is none of those.
- OpenClaw's inbound hooks want `Authorization: Bearer <hooks token>`, and are meant to sit behind loopback, a tailnet or a trusted reverse proxy. Revere cannot add that header; it signs the body instead.

So: **Revere → the relay (public, verifies the signature) → your OpenClaw hook (with the bearer token).**

## Set up

1. In OpenClaw, turn on inbound hooks and make a mapping `revere` (see OpenClaw's webhooks page). Keep the mapping's `allowUnsafeExternalContent` **off**: event text must stay marked as untrusted. Make your hook reachable from the relay over https (a tunnel, a tailnet funnel or a reverse proxy you trust).
2. Deploy `relay/` as a Cloudflare Worker (or any fetch-style runtime): copy `relay/wrangler.example.toml` to `wrangler.toml`, then `wrangler secret put REVERE_WEBHOOK_SECRET`, `OPENCLAW_HOOK_URL` and `OPENCLAW_HOOK_TOKEN`, and `wrangler deploy`.
3. In Revere (Integrations, Webhooks) add a webhook to the relay's address, with a secret you made up (the same as `REVERE_WEBHOOK_SECRET`), for `object.detected`, `health.camera_stale` and `health.camera_recovered`. Use **Send test**: the relay answers 200 and forwards nothing.

## What gets forwarded

A fixed shape, not Revere's whole event: `source`, `event`, `id`, `occurred_at`, `camera {id, name}`, `labels`, `start_time`, `end_time`, a short `message` where Revere gives one, and `snapshot_url` only if you set `FORWARD_SNAPSHOT=true`. The id is also sent as `Idempotency-Key`. Revere retries a failed delivery for up to four hours (a 5xx, a timeout, 408 or 429), so the relay answers 502 when OpenClaw is down and nothing is lost. Add a KV namespace named `SEEN` to drop the rare duplicate.

## What it will not do

Accept an unsigned, mis-signed or stale request (one answer for all three), run unconfigured (it answers 500 and forwards nothing), follow a redirect, forward to an http address, or log a body, a token or a link.
