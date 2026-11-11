# Security

## What this plugin is

A manifest-only OpenClaw plugin: a configuration schema, Revere's MCP server definition, and skills (text). **No code from this repository runs inside your OpenClaw gateway.** OpenClaw runs plugins in-process as trusted code, so that is on purpose. The one piece of code here, `relay/`, is a separate program you run yourself, outside OpenClaw.

## What the key can do

The plugin uses a **read-only Revere MCP key**. It can read the account's cameras, events, pictures, stories and clips. **The key is account-wide:** the plugin's `cameras` setting only tells the model which cameras to use, it does not limit the key, so it is a convenience and not a security boundary. It cannot rename or disable a camera, re-run anything, start live video, manage keys or reach another account. Revere records which tool each key called, on which camera and when (never the arguments or results), and keeps it 30 days; you can see when a key was last used and revoke it at once in Revere.

Do not give the plugin a key with write access, and do not paste a key into a chat. If a key was exposed (a shared `openclaw.json`, a screenshot, a log), revoke it in Revere and make a new one.

## Pictures

A picture from a camera can show people. Whatever model your OpenClaw uses sees every picture the agent is shown: that is your choice of provider and your responsibility. The skills default to one small frame, to sending pictures only to the person who asked, and to never posting pictures or clip links to a group chat on their own.

## Text a model wrote

Event descriptions, captions, story titles and summaries are written by a model from what a camera saw. A camera can see a sign, a shirt or a note carrying instructions. The skills tell the agent to treat that text as data and never as instructions, and the plugin gives the agent no tool that can change anything, so an injection has little to reach. Keep OpenClaw's own protections on (tool allowlists, a strong model, no `allowUnsafeExternalContent` on a Revere hook mapping).

## The relay

`relay/` verifies Revere's signature (HMAC-SHA256 over the timestamp and the raw body, constant time) and a five-minute timestamp window, refuses anything else with one answer, fails closed when it is not configured, caps the body at 256 KiB, forwards only a fixed set of fields to an https OpenClaw hook, never follows a redirect, and never logs a body, a token or a link. It passes the snapshot link on only if you turn that on: the link is a bearer link good for 10 minutes.

## Supply chain

- Releases are built from a tagged commit by `scripts/release.sh` (no install-time scripts; no dependencies at all), with SHA-256 checksums in the release notes.
- The same release is published to ClawHub and to npm with provenance, so you can check one against the other.
- Pin the version you install (`clawhub:revere-video/revere@x.y.z`).

## Reporting a problem

Use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability") with what you found and how to reproduce it. Please do not open a public issue for a vulnerability.
