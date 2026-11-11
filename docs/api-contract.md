# What this plugin calls

The plugin's whole dependency on Revere. A change to any of these in Revere is a change to this list first, and Revere's tests run the example calls below against the service before a release.

## The MCP endpoint

`POST https://api.revere.video/mcp`, JSON-RPC 2.0, `Authorization: Bearer <read-only MCP key>`. Stateless. Every call is scoped to the key's account. Tools used (all read-only):

| Tool | Arguments | Returns |
|---|---|---|
| `list_devices` | `gateway_status?`, `enabled?`, `limit?` | cameras with `id`, `name`, `enabled`, `gateway_id`, `gateway_name`, `gateway_status`, `gateway_last_seen` |
| `get_live_snapshot` | `device_id` | an inline image; an error when the gateway is offline |
| `list_detections` | `device_id`, `time_range_start`, `time_range_end`, `limit?` | events with `analytics_id`, times, detection classes and confidences, and (AI on) `vision_caption`, `vision_description` |
| `get_event_image` | `analytics_id`, `frame_index?` | an inline image of a stored frame |
| `find_camera_memories` | a query and optional range | matching events |
| `chart_camera_metric` | `device_id`, a metric and range | a chart |
| `list_stories` (newer, optional) | `story_id?`, `since?`, `before?`, `device_id?`, `limit?` (at most 20) | stories (`id`, times, `title`, `summary`, `categories`, `cameras`, `event_count`), or one story with its `events` |
| `list_clips` (newer, optional) | `clip_id?`, `device_id?`, `limit?` (at most 20) | clips (`id`, `camera`, times, `duration_s`, `status`, and for a completed clip a `link` valid for `link_expires_in_s` seconds) |

`list_stories` and `list_clips` are newer than the others and are not on every account until Revere has rolled them out; the skills check the tool list and fall back to `list_detections` and `find_camera_memories` when they are missing.

Errors the skills expect: `HISTORY_LIMIT` (older than the plan's history), `NOT_FOUND`, a gateway-offline error from `get_live_snapshot`, and a rate refusal.

## Revere's outbound webhooks (the relay only)

Signed with `X-Belfry-Signature-V2` (base64 HMAC-SHA256 of `{X-Belfry-Timestamp}.{raw body}`), with `X-Belfry-Timestamp` and `X-Belfry-Event-Id`. Events the relay forwards by default: `object.detected`, `health.camera_stale`, `health.camera_recovered`. The signing is pinned by the example request Revere prints in its webhook documentation; `relay/test/relay.test.mjs` verifies that exact request.

## What it does not call

No write tool, no live-view endpoint, no admin route, no key management. The plugin's key cannot reach them.
