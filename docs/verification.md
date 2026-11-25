# What has and has not been checked

Checked against OpenClaw **2026.11.10** (installed from `openclaw.ai/install-cli.sh` into a user folder, and the plugin installed from this folder with `openclaw plugins install`). Check each against the release you use.

| Item | State |
|---|---|
| A plugin with only a manifest, `mcpServers` and `skills`, and no entry point, is valid | **False.** `plugins install` refuses it ("package.json missing openclaw.extensions"), and an empty list is refused too. The plugin has one small entry, `src/index.js`, named in `package.json` under `openclaw.extensions`. |
| The manifest's `categories` | Only a fixed list is accepted (at most three): `channels, models, agent-runtimes, memory, context, voice, web, computer-use, media, security, integrations, developer-tools, infrastructure, documents-files, inbox-collaboration, productivity, scheduling, finance-payments, sales-marketing, data-analytics, agent-orchestration, research, other`. `home-automation` and `cameras` were refused; this uses `security`, `media`, `integrations`. |
| `${config.*}` in `mcpServers` (URL and headers) | **Not expanded.** OpenClaw's bundle MCP code expands only `${CLAUDE_PLUGIN_ROOT}`, `${PLUGIN_ROOT}` and `${PLUGIN_DATA}`. `plugins inspect` shows the manifest value as written. So the manifest declares the server by name with the default address and no key, and the entry registers a connection resolver (`registerMcpServerConnectionResolver`) that returns the address and the `Authorization` header from the plugin's own settings. |
| The plugin installs and loads | **Verified.** `plugins install` asks for capability consent (`--accept-capabilities`) because it adds an MCP server, installs disabled until the required `token` is set, and after `plugins enable revere` reports `status: loaded`, no error. |
| The resolver's connection reaches Revere with the key | **Unit-tested, not tried through OpenClaw.** `src/index.test.mjs` covers the address, the bearer header, a changed key applying to the next connection, and nothing printed. OpenClaw calls a resolver only for an agent turn that has a message sender ("runs without one fail closed"), which needs a model provider configured in OpenClaw; scheduled or hook-started runs may not get the connection. To be tried with a real key and a model. |
| `openclaw plugins validate` | Fails with "plugin entry does not expose tool or feature authoring metadata". It reads as the check for plugins that define tools or features (`defineFeaturePlugin`), and `plugins install` does not need it. Whether ClawHub's publish step needs it is **not known**: check before publishing. |
| A `skills` directory inside a plugin is loaded | Documented ("skill directories to load, relative to the plugin root"); not tried yet. |
| `configSchema`, `uiHints` with `sensitive`, `recommendedPrompts` | `configSchema` is validated: the plugin stays disabled until `token` is set. `uiHints` and `recommendedPrompts` not tried. |
| Install with `openclaw plugins install clawhub:<package>` | Documented; not tried (nothing is published). |
| The relay verifies Revere's own documented request | **Verified** (a test). |
| The relay forwards to an OpenClaw hook | Written to OpenClaw's documented hook (`Authorization: Bearer`, `Idempotency-Key`); **not tried against a running OpenClaw**. |

If you would rather not run the plugin's code, the fallback is the skills alone: publish them as ClawHub skills and add Revere with `openclaw mcp` by hand (README, "Without the plugin").
