# Issue 0006: Show Completed Quests On The Album Map

Status: Ready for agent

## Parent

[PRD: Kanagawa Quest Album MVP](../prd/kanagawa-quest-album-mvp.md)

## What to build

Add or adapt the Album Map so completed Kanagawa Quests appear geographically. The map should make Kanagawa feel like it is gradually filling with the Traveler's own completed memories.

The first implementation can use completed markers or simple photo thumbnails. It does not need advanced map clustering or Share Card behavior.

## Acceptance criteria

- [ ] A Traveler can open the Album Map from the Quest Home or Quest Album flow.
- [ ] Completed quests appear on the map at their spot location.
- [ ] Incomplete quests are visually distinct from completed album memories, or omitted from the Album Map.
- [ ] Selecting a completed map item shows enough information to identify the Album Entry.
- [ ] The Album Map uses Local Quest Album data for completed state.
- [ ] The Album Map updates when a quest is cleared.
- [ ] The Album Map updates when an Album Entry is deleted.

## Blocked by

- [Issue 0003](0003-photo-upload-quest-clear.md)
- [Issue 0004](0004-album-entry-card-list.md)
