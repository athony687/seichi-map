# Issue 0007: Add A Browser Smoke Test For The Quest Album Flow

Status: Ready for agent

## Parent

[PRD: Kanagawa Quest Album MVP](../prd/kanagawa-quest-album-mvp.md)

## What to build

Add a lightweight verification path for the main Quest Album MVP flow. The test should exercise user-visible behavior rather than component internals: Quest Home, Quest Set selection, photo upload, Quest Clear, Album Entry display, Quest Progress update, and Quest Stamp update.

If adding a formal test framework is too much for this slice, add a documented repeatable smoke test command and keep any pure logic test seams small and focused.

## Acceptance criteria

- [ ] There is a repeatable way to verify the Quest Home to Album Entry flow in a browser or browser-like environment.
- [ ] The verification covers selecting or starting a Photo Quest.
- [ ] The verification covers uploading an image.
- [ ] The verification covers Quest Clear state.
- [ ] The verification covers Album Entry Card display.
- [ ] The verification covers Quest Progress updating by completed quests.
- [ ] The verification confirms no backend call is required to create or read a Local Quest Album entry.
- [ ] The verification confirms Driving Log is not part of the initial photo-based completion path.

## Blocked by

- [Issue 0003](0003-photo-upload-quest-clear.md)
- [Issue 0004](0004-album-entry-card-list.md)
