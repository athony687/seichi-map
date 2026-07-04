# Quest Album MVP Plan

## Product Center

seichi-map will differentiate around Kanagawa Quests and a Local Quest Album. The core experience is not only finding anime pilgrimage spots on a map, but completing photo-based quests and seeing Kanagawa fill with the Traveler's own memories.

## MVP Implementation Order

1. Shift the first screen to Quest Home.
   - Lead with Kanagawa Quest Album progress.
   - Show Quest Progress as completed quests over total quests, not visited spots.
   - Show nearby or recommended Quest Sets.
   - Provide primary actions to start a quest and view the Album Map.
   - Use the map as a quest-selection surface, not only a spot-discovery surface.

2. Curate Photo Quests for each spot.
   - Treat the existing spot data as legacy input until the reduced anime list is confirmed.
   - Base Quest Sets on the final curated anime and spot list, not on stale `seichi_data.json` coverage.
   - Each Quest Set has one to three quests.
   - Quests are fixed data, not generated at runtime.
   - Each non-driving quest is completed by uploading a photo taken with the phone's built-in camera app.

3. Implement photo-based Quest Completion.
   - Accept Standard Camera Uploads without EXIF, GPS, capture-time, or anti-cheat validation.
   - Resize and compress uploads into Album Photos before storing them.
   - Store only the resized Album Photo, not the original full-resolution image.
   - Use game-like quest clear language while keeping the saved result tied to the Local Quest Album.
   - Award Quest Stamps as the MVP reward.
   - Do not add public rankings or competitive scoring in the MVP.

4. Implement the Local Quest Album.
   - Store Album Photos, quest metadata, completion time, and optional impressions on the current device.
   - Do not require accounts, cloud sync, or server-side album storage.

5. Build the Album Map and Album Entry Cards.
   - The Album Map is the primary view.
   - Album Entry Cards provide readable details for completed quests.
   - Kanagawa should feel gradually filled by the Traveler's completed memories.

6. Add ownership controls.
   - Travelers can edit optional impressions.
   - Travelers can replace photos.
   - Travelers can delete Album Entries.
   - Deleting an Album Entry removes the related Quest Completion.

7. Add Share Cards only if time allows.
   - Share Cards are generated on demand from one Album Entry Card.
   - They should not be pre-rendered for every entry.
   - They should use user photos, maps, and text, not anime screenshots or character art.

8. Add Driving Log last as a special extension.
   - Driving Log is for the Initial D route quest only.
   - It should be added after the photo-based quest album works end to end.
   - Existing separate Driving Mode work may be reused later, but it should not block the MVP.
