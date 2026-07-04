# Issue 0003: Clear A Photo Quest With Standard Camera Upload

Status: Ready for agent

## Parent

[PRD: Kanagawa Quest Album MVP](../prd/kanagawa-quest-album-mvp.md)

## What to build

Let a Traveler clear a non-driving Photo Quest by uploading an existing photo taken with the phone's built-in camera app. The upload should be accepted without EXIF, GPS, capture-time, or anti-cheat validation, resized and compressed into an Album Photo, then saved as a Local Quest Album entry.

The clear moment should use game-like Quest Clear language and award a Quest Stamp.

## Acceptance criteria

- [ ] A Traveler can choose an existing image file for a Photo Quest.
- [ ] The app does not provide a custom camera UI.
- [ ] The app accepts the uploaded photo without EXIF, GPS, capture-time, or anti-cheat validation.
- [ ] The app resizes and compresses the uploaded photo before saving it as an Album Photo.
- [ ] Uploading a photo clears the selected Kanagawa Quest.
- [ ] Clearing the quest creates exactly one Album Entry for that quest.
- [ ] Clearing the quest awards a Quest Stamp.
- [ ] Quest Progress updates after the quest is cleared.
- [ ] Optional impression input does not block completion.

## Blocked by

- [Issue 0001](0001-local-quest-album-storage.md)
- [Issue 0002](0002-quest-home-progress-and-quest-sets.md)
