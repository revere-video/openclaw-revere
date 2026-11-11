---
name: revere-evening-summary
description: Each evening, send a short summary of the day's activity at the cameras the user chose: who came, which animals, the busiest hour.
version: 0.1.0
---

# Summarize my yard each evening

Load the `revere` skill first.

**Set up (once, with the user)**
- Which cameras ("the yard": ask), the time (default 8 pm local), and where to send it.
- A scheduled automation that runs once a day at that time.

**Each run**
1. `list_stories` with `since` set to the start of today (local time) and the `device_id` of each chosen camera (one call per camera, merge by story id). A story already combines the day's related events; prefer it.
2. If there are stories, read the main ones with `list_stories` and `story_id`. If there are none (or the account has AI off), use `list_detections` for the day, per camera, and summarize from the detection classes.
3. Write **one short paragraph** (under 80 words): who or what came and when, which animals, the busiest hour, anything unusual. Then, only if it matters, one line saying which camera was offline during the day (`list_devices`).
4. If nothing happened, say "A quiet day: nothing detected at <cameras>."
5. Do not attach pictures unless the user asked; if they did, at most one.

Plans limit history (seven days on Free, sixty on Plus): a daily summary never needs more than the day.
