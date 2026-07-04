# Nearby Spots Panel Spec

## Purpose

The Nearby Spots Panel helps a Traveler choose the next anime spot from the map after leaving the Arrival Dashboard. It turns location data into a short, scannable list instead of requiring the Traveler to inspect pins one by one.

## Behavior

- Use the existing active browsing position: live GPS in live mode, demo position in demo mode, and Tokyo Station when location is unavailable.
- Show anime spots within 3 km of that position.
- Sort spots by distance ascending.
- Show each spot as a card with spot name, anime title, distance, area, and a short description.
- Selecting a card opens the existing spot detail card.

## Display Rules

- Do not show the panel while the Arrival Dashboard is visible.
- Show the panel on the map after the dashboard is closed.
- If a spot detail card is open, collapse the panel to a compact header such as `Nearby Spots · 4`.
- If there are no spots within 3 km, show a calm empty state that explains the current reference point.

## In-app Nearby Toast

When the Traveler's position changes and one or more new spots enter the 3 km nearby set, show a lightweight in-app toast.

Rules:

- Do not show a toast when the first nearby set is created.
- Batch multiple newly entered spots into one toast.
- Use a minimum 30 second cooldown between toasts.
- Auto-hide the toast after about 4 seconds.
- Do not use browser push notifications, Service Workers, or OS-level notifications.

Example copy:

- `🎉 A new spot is nearby!`
- `🎉 2 new spots are nearby!`

## Acceptance Criteria

1. After the Arrival Dashboard is closed, the map shows a Nearby Spots panel.
2. The panel lists spots within 3 km sorted by distance.
3. Each card includes spot name, anime title, distance, and a short description.
4. Selecting a card opens the existing spot detail card.
5. The panel collapses while the spot detail card is open.
6. New spots entering the 3 km set trigger a throttled in-app toast.
7. Initial nearby set creation does not trigger a toast.
8. Existing map markers, search, demo mode, favorites, and spot detail behavior continue to work.
