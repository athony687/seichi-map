# PRD: Kanagawa Quest Album MVP

Status: Ready for agent

## Problem Statement

Travelers need a reason to use seichi-map beyond browsing an anime pilgrimage map. A map of spots is useful, but it is not differentiated enough on its own and can feel like a lookup tool rather than an experience worth returning to during a trip.

The product should make Kanagawa travel feel like a quest-based collection of personal memories. Travelers should be able to complete Kanagawa Quests by uploading photos they took with their phone's built-in camera app, optionally leave impressions, and watch their Local Quest Album fill in over time.

## Solution

Build an album-centered MVP around Kanagawa Quests. The first screen becomes Quest Home, showing Quest Progress, recommended or nearby Quest Sets, and actions to start a quest or view the Album Map. Each non-driving quest is completed by uploading a photo from the phone's standard camera workflow. The app accepts uploaded photos without EXIF, GPS, capture-time, or anti-cheat validation, resizes and compresses them into Album Photos, and stores the Local Quest Album only on the current device.

The reward loop is intentionally simple: clearing a quest awards a Quest Stamp, updates Quest Progress, and adds an Album Entry Card to the Local Quest Album. Spot Badges, Area Badges, public rankings, accounts, cloud sync, and competitive scoring are out of scope. Driving Log remains a deferred Initial D special extension after the photo-based Quest Album works end to end.

## User Stories

1. As a Traveler, I want the first screen to show Kanagawa Quest Album progress, so that I immediately understand the app is about completing quests and collecting memories.
2. As a Traveler, I want to see completed quests over total quests, so that progress reflects the number of memories I have recorded.
3. As a Traveler, I want to start from recommended or nearby Quest Sets, so that I can quickly choose what to do next.
4. As a Traveler, I want the map to help me choose quests, so that it supports action rather than only spot discovery.
5. As a Traveler, I want each anime spot to have one to three curated quests, so that the tasks feel specific without becoming busywork.
6. As a Traveler, I want weak or generic quests to be omitted, so that every Quest Set feels worth recording.
7. As a Traveler, I want quest content to be fixed and curated, so that the app gives reliable prompts instead of vague generated tasks.
8. As a Traveler, I want reduced anime and spot data to be treated as the source of truth, so that stale legacy data does not shape the MVP.
9. As a Traveler, I want non-driving quests to be photo-based, so that each clear produces an album memory.
10. As a Traveler, I want to take photos using my phone's built-in camera app, so that I can use the camera workflow I already trust.
11. As a Traveler, I want to upload an existing phone photo into seichi-map, so that I can record a quest after taking the picture.
12. As a Traveler, I want the app to accept my uploaded photo without metadata checks, so that quest completion feels lightweight and not invasive.
13. As a Traveler, I want the app to avoid EXIF, GPS, and capture-time validation, so that I do not have to worry about private metadata.
14. As a Traveler, I want a quest to clear when I upload a photo, so that the completion moment feels immediate.
15. As a Traveler, I want game-like clear language such as Quest Clear, so that completing a quest feels rewarding.
16. As a Traveler, I want each clear to award a Quest Stamp, so that I get a simple non-competitive reward.
17. As a Traveler, I want the Quest Stamp to update progress, so that I can see my trip advancing.
18. As a Traveler, I want the cleared quest to create an Album Entry Card, so that I can revisit the memory later.
19. As a Traveler, I want an optional impression field, so that I can add feelings or notes only when I want to.
20. As a Traveler, I want impressions to be optional, so that writing text never blocks quest completion.
21. As a Traveler, I want my uploaded photo to be resized and compressed, so that the album stays fast on my phone.
22. As a Traveler, I want the original full-resolution photo to stay outside the app, so that seichi-map is not pretending to be a photo backup tool.
23. As a Traveler, I want my Quest Album stored only on my current device, so that I can use the MVP without creating an account.
24. As a Traveler, I want no cloud sync or server-side album storage in the MVP, so that my photos and impressions remain local.
25. As a Traveler, I want to understand that clearing browser storage may remove my album, so that the MVP limitation is clear.
26. As a Traveler, I want an Album Map, so that Kanagawa visually fills with my completed memories.
27. As a Traveler, I want completed quests to appear on the Album Map, so that the map reflects my trip rather than only available spots.
28. As a Traveler, I want Album Entry Cards below or alongside the Album Map, so that I can read details after seeing the geographic overview.
29. As a Traveler, I want each Album Entry Card to show the quest name, anime title, place, completion time, photo, and optional impression, so that the memory is understandable later.
30. As a Traveler, I want to edit an impression after clearing a quest, so that I can improve the album entry later.
31. As a Traveler, I want to replace the photo on an Album Entry, so that I can fix mistakes.
32. As a Traveler, I want to delete an Album Entry, so that I control my local travel record.
33. As a Traveler, I want deleting an Album Entry to remove the related Quest Completion, so that progress stays consistent.
34. As a Traveler, I want the MVP to avoid public rankings, so that the experience stays personal and travel-focused.
35. As a Traveler, I want the MVP to avoid Spot Badges and Area Badges, so that the reward system stays understandable while the spot list is still changing.
36. As a Traveler, I want Share Cards only if they can be added without slowing the core flow, so that optional sharing does not harm album performance.
37. As a Traveler, I want any Share Card to be generated only when I ask for it, so that the album list remains lightweight.
38. As a Traveler, I want Share Cards to use my photos, maps, and text rather than anime screenshots or character art, so that the app avoids copyrighted media risk.
39. As a Traveler, I want Initial D Driving Log to be treated as a later special quest, so that complex GPS and motion work does not delay the photo album MVP.
40. As a demo presenter, I want the main story to be Kanagawa Quest Album first, so that the product is easy to explain in a short hackathon presentation.
41. As a demo presenter, I want Driving Log deferred, so that unstable sensor work does not break the central demo.
42. As a maintainer, I want a final curated spots template, so that mentor-driven anime and spot changes can be reconciled before data implementation.
43. As a maintainer, I want stale `seichi_data.json` coverage treated as legacy input, so that old Yokohama or Odawara assumptions do not leak into the MVP.
44. As a maintainer, I want quest data to include photo prompts and optional impression prompts, so that UI and data stay aligned.
45. As a maintainer, I want the album flow to have a clear storage boundary, so that future cloud sync can be considered separately.

## Implementation Decisions

- Use the project glossary terms from `CONTEXT.md`, especially Kanagawa Quest, Quest Set, Curated Quest Data, Quest Album, Local Quest Album, Album Map, Album Entry Card, Quest Completion, Photo Quest, Standard Camera Upload, Unverified Photo Upload, Album Photo, Quest Home, Quest Progress, Quest Clear Tone, and Quest Stamp.
- Change the primary app entry from a discovery-first dashboard to Quest Home for the album-centered MVP.
- Show Quest Progress as completed Kanagawa Quests over total Kanagawa Quests, not visited spots.
- Treat the current spot data as legacy input until it is reconciled with the reduced anime and spot list.
- Use `docs/final-curated-spots-template.md` as the human-editable planning source for the final anime and spot set before updating shipped data.
- Represent each spot's Quest Set with one to three curated quests. Do not create filler quests just to reach three.
- Store curated quest data as shipped fixed data. Do not generate quest tasks at runtime.
- Each non-driving quest is completed by uploading a photo that the Traveler took with the phone's built-in camera app.
- Do not build a custom in-app camera UI for the MVP.
- Accept photo uploads without EXIF, GPS, capture-time, or anti-cheat validation.
- Resize and compress uploaded photos in the browser before storing them as Album Photos.
- Do not store the original full-resolution camera file in the app.
- Store Local Quest Album data on the current device only.
- Do not require accounts, cloud sync, or server-side album storage.
- Store enough Album Entry metadata to render the album without recomputing from stale quest data: quest id, spot id, anime title, spot name, quest title, area if available, completion time, Album Photo, optional impression, and Quest Stamp state.
- Use game-like clear language for the completion moment, such as Quest Clear, Memory Acquired, Album Updated, Add Comment, Change Photo, and View Quest Album.
- Use Quest Stamps as the only MVP reward.
- Do not implement Spot Badges, Area Badges, public rankings, or competitive scoring.
- Allow Travelers to edit optional impressions.
- Allow Travelers to replace Album Photos.
- Allow Travelers to delete Album Entries.
- Deleting an Album Entry removes the related Quest Completion and Quest Stamp.
- Build Album Map as the primary Quest Album view.
- Build Album Entry Cards as the readable detail view for completed quests.
- Add Share Cards only if time allows, and generate them on demand from one Album Entry Card.
- Share Cards must use user photos, maps, and text, not anime screenshots or character art.
- Defer Driving Log until the photo-based Quest Album is working end to end.
- Keep any existing or separate Driving Mode work reusable later, but do not let it block this MVP.
- Respect ADR 0003 for device-only album storage.
- Respect ADR 0004 for unverified photo uploads.
- Respect ADR 0005 for curated quest data.
- Respect ADR 0006 for resized Album Photos.
- Respect ADR 0007 for deferring Driving Log.

## Testing Decisions

- The main test seam is the highest user-visible flow: Quest Home, Quest Set selection, photo upload, Quest Clear, Local Quest Album entry creation, Album Map update, Quest Progress update, and Quest Stamp update.
- Tests should assert external behavior and persisted user-visible state, not component internals.
- Good tests should verify that uploading a photo clears the selected quest and creates exactly one Album Entry Card.
- Good tests should verify that an optional impression can be empty and quest completion still succeeds.
- Good tests should verify that editing an impression changes the Album Entry Card without creating a duplicate entry.
- Good tests should verify that replacing a photo keeps the same quest completion but changes the displayed Album Photo.
- Good tests should verify that deleting an Album Entry removes the corresponding Quest Completion and Quest Stamp.
- Good tests should verify that Quest Progress counts completed quests, not spots.
- Good tests should verify that multiple quests under one Quest Set can be completed independently.
- Good tests should verify that uploaded photos are represented by resized Album Photos rather than original file objects.
- Good tests should verify that no server call is required to create or read a Local Quest Album entry.
- Good tests should verify that Share Card generation, if implemented, is user-triggered rather than pre-rendered for every entry.
- Good tests should verify that Driving Log is not part of the initial photo-based completion path.
- The current frontend has no committed test framework. The first implementation issue should either add a minimal browser-flow test setup or create testable pure modules for quest progress, album persistence, deletion, and photo resizing.
- For UI verification, prefer a browser-level smoke flow that exercises the actual app after `vite build` or a local dev server.
- For pure logic, prefer small tests around extracted album persistence and quest-progress functions once those seams exist.
- Existing Playwright CLI artifacts are present, but there is no formal Playwright test suite in the package scripts yet.

## Out of Scope

- User accounts.
- Cloud sync.
- Server-side photo or album storage.
- Public album feeds.
- Public rankings.
- Competitive scoring.
- Spot Badges.
- Area Badges.
- Runtime AI generation of quest tasks.
- EXIF, GPS, capture-time, or anti-cheat validation for uploaded photos.
- Custom in-app camera UI.
- Original full-resolution photo backup.
- Driving Log implementation for the first photo-album MVP.
- Real Drive GPS and smartphone motion capture for this PRD.
- Migrating the separate Driving Mode project into this app.
- Automatically deriving Area Badge categories from stale spot data.
- Anime screenshots, character art, or copyrighted scene images in album or sharing content.

## Further Notes

The central product sentence is: Travelers complete Kanagawa Quests by uploading their own photos, earn Quest Stamps, and build a Local Quest Album that fills the Kanagawa map with personal memories.

The implementation should keep the first usable slice narrow: Quest Home, one curated Quest Set, photo upload, Quest Clear, Local Quest Album persistence, and a visible Album Entry Card. Once that loop works, the remaining spots, Album Map polish, ownership controls, and optional Share Cards can be layered in.

The issue tracker has not been configured in this repository, so this PRD is published as a local document with `Status: Ready for agent`.
