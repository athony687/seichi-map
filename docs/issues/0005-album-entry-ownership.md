# Issue 0005: Add Album Entry Ownership Controls

Status: Ready for agent

## Parent

[PRD: Kanagawa Quest Album MVP](../prd/kanagawa-quest-album-mvp.md)

## What to build

Let Travelers control their Local Quest Album entries on the current device. They should be able to edit an optional impression, replace an Album Photo, and delete an Album Entry.

Deleting an Album Entry must also remove the related Quest Completion and Quest Stamp so progress stays consistent.

## Acceptance criteria

- [ ] A Traveler can edit the optional impression on an Album Entry.
- [ ] Editing an impression updates the existing Album Entry instead of creating a duplicate.
- [ ] A Traveler can replace the Album Photo on an Album Entry.
- [ ] Replacing a photo keeps the same quest completion and updates the displayed Album Photo.
- [ ] A Traveler can delete an Album Entry.
- [ ] Deleting an Album Entry removes the related Quest Completion.
- [ ] Deleting an Album Entry removes the related Quest Stamp.
- [ ] Quest Progress updates after deletion.

## Blocked by

- [Issue 0004](0004-album-entry-card-list.md)
