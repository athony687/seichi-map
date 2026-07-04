# Context

## Glossary

### Reverse Seichi Discovery

A discovery experience where a traveler starts from a place, tourist area, or current location and then finds anime connected to that place. It is different from a normal pilgrimage map that starts from an anime title and searches for filming or inspiration spots.

### Traveler

A user who is already traveling in Japan or planning where to go next. The product should help them understand what is nearby and what anime may become more enjoyable after the trip.

### Arrival Dashboard

The first decision surface a Traveler sees when opening the app in or near the target area. It should help them choose between nearby discovery, a preview route, and anime-title search without requiring location permission before intent is clear.

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
