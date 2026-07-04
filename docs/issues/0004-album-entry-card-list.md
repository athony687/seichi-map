# Issue 0004: Show Local Quest Album Entry Cards

Status: Ready for agent

## Parent

[PRD: Kanagawa Quest Album MVP](../prd/kanagawa-quest-album-mvp.md)

## What to build

Add a readable Local Quest Album view that lists completed quests as Album Entry Cards. Each card should make the memory understandable without needing to reopen the quest flow.

## Acceptance criteria

- [ ] The Quest Album shows completed quests as Album Entry Cards.
- [ ] Each Album Entry Card shows the Album Photo.
- [ ] Each Album Entry Card shows quest name, anime title, spot/place name, and completion time.
- [ ] Each Album Entry Card can show an optional impression when present.
- [ ] Album Entry Cards render from Local Quest Album data, not from backend storage.
- [ ] A cleared quest remains visible after the page reloads, as long as local browser storage remains intact.
- [ ] Empty impressions are allowed and do not hide the completed entry.

## Blocked by

- [Issue 0003](0003-photo-upload-quest-clear.md)
