---
name: revere-whats-happening
description: Answer "what's happening at <camera> right now?" with a live picture and one sentence. The simplest Revere recipe.
version: 0.1.0
---

# What's happening right now

Load the `revere` skill first.

**When:** the user asks what is going on at a camera ("the back door", "the garage", "the yard").

**Steps**
1. `list_devices`. Match the name the user gave to a camera (ask if two match). Check its `gateway_status`; if it is not `online`, say which gateway is offline and since when (`gateway_last_seen`), and stop.
2. `get_live_snapshot` with that `device_id`.
3. Reply with the picture and one sentence: what is in view (people, vehicles, animals, doors open or shut only if clearly visible), and the time. Do not guess what you cannot see.
4. If the picture is dark or blocked, say so plainly.

**Do not** send the picture anywhere but the chat the user asked in.
