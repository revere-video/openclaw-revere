# What has and has not been checked

Written against OpenClaw's documentation (docs.openclaw.ai, read 10 Nov 2026; the pages show no version). Check each against the release you use.

| Item | State |
|---|---|
| A plugin with only a manifest, `mcpServers` and `skills`, and no entry point, is valid | **Not verified** (the docs show every example with a code entry) |
| The shape of `mcpServers` in the manifest, and `${config.…}` in its URL and headers | **Not verified** (the manifest page calls them static definitions) |
| A `skills` directory inside a plugin is loaded | Documented ("skill directories to load, relative to the plugin root") |
| `configSchema`, `uiHints` with `sensitive`, `recommendedPrompts` | Documented; the schema is validated on config read and write |
| Install with `openclaw plugins install clawhub:<package>` | Documented |
| OpenClaw consumes Streamable HTTP MCP servers with a bearer header | Documented for `mcp.servers`; **not verified** through a plugin |
| The relay verifies Revere's own documented request | **Verified** (a test) |
| The relay forwards to an OpenClaw hook | Written to OpenClaw's documented hook (`Authorization: Bearer`, `Idempotency-Key`); **not tried against a running OpenClaw** |

If a manifest-only plugin is not valid, the fallback is the skills alone: publish them as ClawHub skills and add Revere with `openclaw mcp` by hand (README, "Without the plugin").
