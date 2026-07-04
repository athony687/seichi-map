# Issue 0001: Build The Minimal Local Quest Album Storage Boundary

Status: Ready for agent

## Parent

[PRD: Kanagawa Quest Album MVP](../prd/kanagawa-quest-album-mvp.md)

## What to build

Create the smallest usable Local Quest Album foundation. The app should be able to create, read, and delete local Album Entries, track Quest Completion, and award/remove Quest Stamps on the current device only.

This slice may use a placeholder Album Photo or existing data URL instead of a real upload flow. The goal is to establish the storage boundary and state rules before wiring the full UI.

## Acceptance criteria

- [ ] Local Quest Album data is stored only on the current device.
- [ ] An Album Entry can be created with quest metadata, completion time, Album Photo data, optional impression, and Quest Stamp state.
- [ ] Quest Progress can be calculated as completed Kanagawa Quests over total Kanagawa Quests.
- [ ] Deleting an Album Entry removes the related Quest Completion and Quest Stamp.
- [ ] The storage logic does not require accounts, cloud sync, backend calls, or server-side album storage.
- [ ] The implementation does not store original full-resolution camera files.

## Blocked by

None - can start immediately.
