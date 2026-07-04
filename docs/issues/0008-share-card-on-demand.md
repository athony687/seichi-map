# Issue 0008: Generate Share Cards On Demand

Status: Ready for agent

## Parent

[PRD: Kanagawa Quest Album MVP](../prd/kanagawa-quest-album-mvp.md)

## What to build

Add an optional Share Card action to an Album Entry Card. When the Traveler asks for it, the app should generate a lightweight shareable image from that one entry using the Traveler's Album Photo, quest/place text, optional impression, and seichi-map branding.

Share Cards must not be pre-rendered for every entry and must not use anime screenshots or character art.

## Acceptance criteria

- [ ] An Album Entry Card has a user-triggered Share Card action.
- [ ] The app generates a Share Card only after the Traveler asks for it.
- [ ] The generated card includes the Album Photo.
- [ ] The generated card includes quest/place context.
- [ ] The generated card can include the optional impression when present.
- [ ] The generated card avoids anime screenshots, character art, and copyrighted scene images.
- [ ] The album list does not pre-render Share Cards for every entry.
- [ ] Share Card generation does not require server-side album storage.

## Blocked by

- [Issue 0004](0004-album-entry-card-list.md)
