# Issue 0002: Show Quest Home With Quest Progress And Quest Sets

Status: Ready for agent

## Parent

[PRD: Kanagawa Quest Album MVP](../prd/kanagawa-quest-album-mvp.md)

## What to build

Shift the first app decision surface toward Quest Home. Travelers should see Kanagawa Quest Album progress, recommended or nearby Quest Sets, and a clear path to start a quest or view the Album Map.

Use a small curated quest dataset suitable for the MVP. Treat stale spot data as legacy input unless it has been reconciled with the final curated spots template.

## Acceptance criteria

- [ ] The initial experience leads with Quest Home rather than a generic discovery dashboard.
- [ ] Quest Home shows Quest Progress as completed quests over total quests, not visited spots.
- [ ] Quest Home shows at least one Quest Set with one to three curated Kanagawa Quests.
- [ ] Each displayed quest has enough fixed data to support a photo prompt and optional impression prompt later.
- [ ] There is a visible action to start a quest.
- [ ] There is a visible action to view the Quest Album or Album Map.
- [ ] No Spot Badge, Area Badge, public ranking, or competitive score appears in the MVP UI.

## Blocked by

- [Issue 0001](0001-local-quest-album-storage.md)
