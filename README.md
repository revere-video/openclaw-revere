# Revere for OpenClaw

See your Revere cameras from your OpenClaw agent: ask for a live picture, ask what was detected, read the day's stories, get a clip. **Read-only**: the agent can look, and can change nothing.

> Status: 0.1.0, not yet published. It has been written against OpenClaw's documentation and not yet run in an OpenClaw. [What has and has not been checked](docs/verification.md).

## What you can do with it

- **"What's happening at the back door right now?"** A live picture and a sentence. (`revere-whats-happening`)
- **"Tell me when a package arrives."** A picture in your chat when a delivery is seen. (`revere-package-alert`)
- **"Night watch."** A ping only for a person at the cameras you chose, at night. (`revere-night-watch`)
- **"Summarize my yard each evening."** One short paragraph at 8 pm. (`revere-evening-summary`)
- **"Which camera went quiet?"** A morning check for offline or silent cameras. (`revere-camera-check`)

## Install

1. In Revere, open **Integrations, AI assistant** and make a **read-only** key. It is shown once.
2. Install the plugin (pin the version):
   ```
   openclaw plugins install clawhub:revere-video/revere@0.1.0
   ```
3. Give it the key. Prefer a SecretRef (an environment variable or a file) over pasting it into `openclaw.json`, which may be read by others. The setting is `token`.
4. Ask your agent: "What's happening at the front door?"

Settings (`openclaw.plugin.json`): `token` (required), `apiUrl` (default `https://api.revere.video`, https only), `cameras` (camera ids the agent may use; empty means every camera).

## Triggers: polling, and optionally webhooks

The recipes that watch for something run as scheduled automations about once a minute. That works behind any home router and needs nothing from you. For "tell me *now*", run the small [webhook relay](docs/webhook-relay.md) that sits between Revere's webhooks and OpenClaw's hooks.

## Safe by design

- **No code runs in your gateway.** The plugin is a manifest, a settings schema and skills. OpenClaw runs plugins in-process as trusted code; this one has none.
- **Read-only key.** No writes, no live video, no admin, no key management. Revoke it in Revere at any time.
- **Text a model wrote is treated as data,** never as instructions, and pictures are private by default. See [SECURITY.md](SECURITY.md).

## Without the plugin

If your OpenClaw does not accept a manifest-only plugin, install the skills and add Revere as an MCP server yourself: a Streamable HTTP server named `revere` at `https://api.revere.video/mcp` with the header `Authorization: Bearer <your read-only key>` (see OpenClaw's `openclaw mcp` documentation).

## What's here

| | |
|---|---|
| `openclaw.plugin.json` | the manifest: settings schema and Revere's MCP server |
| `skills/` | the base `revere` skill and the five recipes (MIT-0) |
| `relay/` | the optional webhook relay (a Cloudflare Worker, no dependencies, with tests) |
| `docs/` | [what the plugin calls](docs/api-contract.md), [the relay](docs/webhook-relay.md), [verification](docs/verification.md) |

## Develop

`npm test` runs the relay's tests and the repository checks (Node 20 or newer, no dependencies). `npm run check` validates the manifest, the skills and the licences.

## Licence

MIT for the code and documentation (`LICENSE`); MIT-0 for `skills/` (`skills/LICENSE`), as ClawHub requires for skills. Revere is a trademark of Revere Video.
