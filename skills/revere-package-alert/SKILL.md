---
name: revere-package-alert
description: Tell the user when a package or delivery arrives, with a picture, by watching a camera's events.
version: 0.1.0
---

# Tell me when a package arrives

Load the `revere` skill first. This needs the account's **AI descriptions** on: "package" is read from an event's description (for example "A courier leaves a box at the front door"), because the detector itself sees people, animals and vehicles, not parcels.

**Set up (once, with the user)**
- Ask which camera faces the door or porch, and where to send the message (this chat is the default).
- Create a scheduled automation that runs this skill about once a minute. Remember the `analytics_id` of the newest event you handled (a state note), so none repeats.

**Each run**
1. `list_detections` for that camera from the last handled event's time (or the last ten minutes the first time) to now.
2. For each new event, check its description and caption for delivery words: package, parcel, box, delivery, courier, mail, envelope. If none match, skip it.
3. On a match, `get_event_image` for that `analytics_id` and send the picture with one line: "A courier left a box at the front door at 2:14 pm."
4. Update the last handled event. If nothing new matched, send nothing.

**Keep it quiet:** at most one message per event; if several events match within five minutes, send one message for the group. Never message a group chat unless the user said to.

**If descriptions are off or empty:** tell the user once that this recipe needs AI descriptions, and offer "tell me when a person is at the door" instead (`revere-night-watch` without the night hours).
