---
name: revere-camera-check
description: Each morning, say which cameras are offline or have gone quiet, so a dead battery or a knocked camera is found early.
version: 0.1.0
---

# Which camera went quiet?

Load the `revere` skill first.

**Set up (once):** a scheduled automation each morning (default 8 am local) to the user's chat.

**Each run**
1. `list_devices`. A camera is **offline** when its `gateway_status` is not `online`; name the gateway and say since when (`gateway_last_seen`). Group the cameras by gateway: one offline gateway is one message, not one per camera.
2. For each enabled camera whose gateway is online, `list_detections` for the last 24 hours (or `chart_camera_metric`). A camera that produced nothing at all for a day while others did is **quiet**: say so, as a question, not a fault ("The garage camera saw nothing in 24 hours; is it covered or knocked?").
3. Disabled cameras (`enabled: false`) are skipped.
4. If everything is fine, send one line ("All N cameras are online and active") or nothing, as the user chose.

**Faster:** the webhook relay (see `docs/webhook-relay.md`) can trigger this on Revere's `health.camera_stale` and `health.gateway_offline` events instead of waiting for the morning.
