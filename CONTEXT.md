# Context

## Glossary

### Reverse Seichi Discovery

A discovery experience where a traveler starts from a place, tourist area, or current location and then finds anime connected to that place. It is different from a normal pilgrimage map that starts from an anime title and searches for filming or inspiration spots.

### Traveler

A user who is already traveling in Japan or planning where to go next. The product should help them understand what is nearby and what anime may become more enjoyable after the trip.

### Kanagawa Quest

A location-based activity in Kanagawa that asks a Traveler to visit, photograph, taste, buy, or notice something connected to an anime spot or its surrounding area. It is the main unit of progress in the product.

### Quest Set

The group of Kanagawa Quests attached to one anime spot. A Quest Set may contain one to three quests in the MVP, and should only include quests that feel specific enough to be worth recording.

### Curated Quest Data

The fixed quest content shipped with the app for each anime spot. It should define the photo prompt, optional impression prompt, and completion type instead of generating quests at runtime.

### Quest Album

A personal travel record built from completed Kanagawa Quests. Each entry centers on the Traveler's own photo and may include an optional impression, but it is not a public review feed.

### Local Quest Album

A Quest Album stored only on the Traveler's current device. It is the MVP storage boundary for photos, impressions, and Driving Logs, and it does not imply account sync or cloud backup.

### Album Map

The primary Quest Album view where completed Kanagawa Quests appear on the Kanagawa map using the Traveler's own photos or Driving Log markers. It should make the prefecture feel gradually filled by the Traveler's memories.

### Album Entry Card

A readable Quest Album item for one completed quest. It shows the quest name, anime title, place, completion time, the uploaded photo or Driving Log summary, and an optional impression.

### Album Entry Ownership

The rule that a Traveler can edit impressions, replace photos, and delete Local Quest Album entries on their current device. Deleting an entry also removes the related Quest Completion unless the entry is only a Sample Driving Log.

### Share Card

An on-demand image generated from one Album Entry Card for saving or sharing outside the app. It should be lightweight and user-triggered, not pre-rendered for every album entry.

### Quest Completion

The state where a Traveler has finished a Kanagawa Quest by capturing a photo, checking in, or otherwise confirming the intended activity. Completion should feel like preserving a memory, not merely clearing a task.

### Photo Quest

A Kanagawa Quest completed by capturing a photo at or near the intended place. It is the default quest pattern because the Quest Album is centered on the Traveler's own visual memory.

### Standard Camera Upload

The photo path where the Traveler takes a picture with the phone's built-in camera app, then uploads that existing photo into seichi-map. The app should not provide a custom camera UI for the MVP.

### Unverified Photo Upload

A Standard Camera Upload accepted without checking EXIF, GPS, capture time, or whether the photo was taken during the current quest attempt. It favors a lightweight travel-record experience over proof enforcement.

### Album Photo

The resized and compressed image stored in the Local Quest Album after a Standard Camera Upload. It is optimized for album viewing and Share Cards, and it is not the original full-resolution camera file.

### Check-in Quest

A Kanagawa Quest completed without requiring a photo, usually because photography may be impractical, prohibited, unsafe, or intrusive. It is an exception to Photo Quest, not the default.

### Memory Quest

A Photo Quest for food, souvenir, or atmosphere-based activities where the uploaded photo is the completion record and a short impression may be added optionally. It is not completed by text alone in the MVP.

### Arrival Dashboard

The first decision surface a Traveler sees when opening the app in or near the target area. It should help them choose between nearby discovery, a preview route, and anime-title search without requiring location permission before intent is clear.

### Quest Home

The first decision surface for the album-centered MVP. It presents Local Quest Album progress, nearby or recommended Quest Sets, and actions to start a quest or view the Album Map.

### Quest Progress

The Traveler's completion count measured by completed Kanagawa Quests, not visited spots. It should support the feeling that each completed quest adds one memory to the Local Quest Album.

### Quest Clear Tone

The game-like language used when a Traveler completes a Kanagawa Quest. It should make completion feel rewarding while still framing the result as a personal travel memory in the Local Quest Album.

### Quest Stamp

A non-competitive reward earned when one Kanagawa Quest is cleared. It marks progress in the Local Quest Album without creating a public score or ranking.

### Nearby Spots Panel

A map-level panel that lists anime spots near the Traveler's current browsing point. It supports choosing the next place to visit without opening each marker one by one.

### In-app Nearby Toast

A lightweight screen notification shown while the app is open when one or more new spots enter the Nearby Spots Panel. It is not a browser push notification and should be throttled so it does not interrupt walking.

### Intent-gated Location Permission

A permission flow where the app asks for location only after the Traveler chooses a location-based action. It keeps the first screen focused on purpose before asking for device access.

### Default Reference Point

A clearly labeled place used when live location is unavailable. It is not a fake current location; it is an explicit starting point for browsing, such as Tokyo Station.

### Good to know

A short practical travel note for a spot. It may include timing, crowding, photo conditions, walking tips, or safety notes. It should not read like a scolding manners warning.

### Drive Mode

A pilgrimage experience where the Traveler explores an anime-related route by car rather than visiting isolated pins. It treats the route itself as the sacred place.

### Touge Route

A predefined mountain or scenic driving route with checkpoints such as a start point, curves, viewpoints, rest points, and an end point. It is not generated automatically from the road network.

### Demo Drive

A reliable presentation mode that replays prepared DrivePoints along a Touge Route. It exists so the hackathon demo can show movement, checkpoint progress, and scoring without depending on live GPS or motion sensors.

### Real Drive

An optional Drive Mode that tries to convert live browser geolocation and device motion readings into DrivePoints. It is a challenge feature, not the core demo path.

### DrivePoint

A normalized sample of route progress used by both Demo Drive and Real Drive. It includes timestamp, latitude, longitude, speed, and acceleration-like values so the score calculation does not care where the data came from.

### Driving Log

A special Quest Album entry for an Initial D route quest, built from GPS and smartphone motion samples instead of a single photo. It represents the Traveler's route memory, but it is deferred until the photo-based quest album is complete.

### Real Driving Log

A Driving Log created from live GPS and smartphone motion data while the Traveler is on the route. It can count as formal Quest Completion.

### Sample Driving Log

A Driving Log created from prepared or replayed route data for demo and preview purposes. It may appear in the Quest Album UI, but it must be labeled as a sample and must not count as formal Quest Completion.

### Touge Drive Score

A non-competitive safety and smoothness score for Drive Mode. It should reward calm pacing, stable cornering, checkpoint completion, and respectful travel rather than speed.
