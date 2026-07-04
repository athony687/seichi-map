# Quest Album Smoke Test

Use this repeatable smoke test after changes to the Kanagawa Quest Album MVP.

## Setup

1. Start the frontend:

   ```bash
   cd frontend
   npm run dev
   ```

2. Open the local Vite URL in a browser.

3. Clear browser storage for the app if you want a fresh run.

## Flow

1. Confirm the first visible product surface is **Quest Home**.
2. Confirm Quest Progress is shown as completed quests over total quests.
3. Confirm at least one Quest Set is visible.
4. Pick a Photo Quest and choose an existing image file.
5. Confirm the app does not open a custom camera UI.
6. Confirm the quest changes to **Quest Clear**.
7. Confirm Quest Progress increments.
8. Open **View Album**.
9. Confirm an Album Entry Card appears with the uploaded Album Photo, quest title, anime title, place, and completion time.
10. Edit the optional comment and confirm the same Album Entry Card updates without duplication.
11. Replace the photo and confirm the same Album Entry Card shows the new Album Photo.
12. Open **Album Map** and confirm the completed quest appears as a completed marker.
13. Select the completed marker and confirm it shows the album memory.
14. Generate a **Share Card** from the Album Entry Card and confirm it is created only after clicking the action.
15. Delete the Album Entry and confirm Quest Progress decrements and the completed marker disappears.

## Expected Boundaries

- The album is stored on the current device only.
- No account, cloud sync, or backend album write is required.
- Photo uploads are accepted without EXIF, GPS, capture-time, or anti-cheat validation.
- The app stores a resized Album Photo, not the original camera file.
- Driving Log is not part of this photo-based completion path.
