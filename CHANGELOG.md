# Changelog

## 0.1.0 (unreleased)

- First version: the plugin (settings schema, Revere's MCP server, and a small entry that connects it from the settings), the base skill and five recipes, and the webhook relay template.
- Checked against OpenClaw 2026.11.10 (docs/verification.md): the categories are ones OpenClaw accepts, and the plugin has a code entry, because OpenClaw does not install a manifest-only plugin and does not fill `${config.*}` into a manifest's MCP server.
