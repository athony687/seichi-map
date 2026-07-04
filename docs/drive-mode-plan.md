# Drive Mode Plan

## One Sentence

Add a supplemental Drive Mode to the Kanagawa quest map so one route-based pilgrimage shows that a sacred place can be a road, not only a pin.

## Recommended Direction

Use Drive Mode as a feature-point booster, not the product's only main subject:

- Focus on one confirmed MVP route: Hakone Old Road / Nanamagari for the Initial D-style demo.
- Keep the current Quest / Stamp experience as the main demo path.
- Add Drive Mode only as a route quest attached to the Hakone / Initial D spot card.
- Do not add Drive Mode as a top-level primary navigation item.
- Build Demo Drive first as the fallback path.
- Also attempt Real Drive and sensors as a challenge feature, accepting that it may be removed if it breaks.

## Why This Is Strong For The Hackathon

The idea is differentiated because most pilgrimage apps are spot maps. This reframes anime pilgrimage as a route experience:

- Normal seichi app: "Where is the spot?"
- Drive Mode: "How do I experience the road safely and respectfully?"

That is a clearer "omotenashi" story because it helps visitors understand how to enjoy a niche anime pilgrimage without needing local knowledge.

## MVP Scope

Must have:

- A Drive Mode entry for one route, reachable only from the Hakone Initial D spot/card.
- The first route is Hakone Old Road / Nanamagari.
- A route polyline on the map.
- Route checkpoints: Start, Hairpin, Viewpoint, Goal.
- A Demo Drive button.
- A car marker moving along prepared DrivePoints.
- Checkpoints becoming complete as the demo marker reaches them.
- Touge Drive Score shown at the end.
- Safety copy that says the score rewards smooth, respectful driving, not speed.

Should have if time allows:

- A "Try Real Drive" experimental button inside Drive Mode.
- GPS sampling through `navigator.geolocation.watchPosition()`.
- DeviceMotion sampling for acceleration-like values if the browser supports it.
- A fallback where `acceleration` becomes `0` when DeviceMotion is unavailable.
- Route tags such as Scenic, Many Curves, Beginner Caution, Rest Stop.
- A score breakdown with detailed numeric values: Smoothness, Corner Stability, Safe Pace, Checkpoints, Respect.
- A slightly dramatic "analysis" presentation for the score, while still avoiding racing language.
- One fallback non-driving quest for people who only want to view the route.

Do not build now:

- Road-network route generation.
- Real-time route optimization.
- Competitive leaderboards.
- Lap times.
- Anime logos, character art, copyrighted stills, or music.
- Sensor-dependent scoring as the only demo path.

## Real Drive Challenge Boundary

Real Drive is allowed to be unstable because it is a challenge feature, but it must be easy to remove:

- Keep Real Drive behind one visible "Try Real Drive" button.
- Keep Demo Drive working even if Real Drive fails.
- Convert GPS and DeviceMotion into the same DrivePoint shape used by Demo Drive.
- If GPS works but DeviceMotion does not, still create DrivePoints with `acceleration: 0`.
- If permissions fail, show "Real Drive unavailable on this device" and keep the app usable.
- Do not make Real Drive required to open the route, complete the demo, or show a score.
- Keep sensor logic isolated from ordinary spot-card and Visit / Eat / Buy quest code.

## Data Model

```ts
type TougeRoute = {
  id: string
  title: string
  animeTitle: string
  area: string
  description: string
  routePoints: Array<{ lat: number; lng: number }>
  checkpoints: DriveCheckpoint[]
  tags: string[]
  tougeScore: number
  safetyNote: string
}

type DriveCheckpoint = {
  id: string
  label: string
  type: 'Start' | 'Hairpin' | 'Viewpoint' | 'Rest' | 'Goal'
  lat: number
  lng: number
  description: string
}

type DrivePoint = {
  timestamp: number
  lat: number
  lng: number
  speedKmh: number
  acceleration: number
}
```

## Scoring

Use this as the presentation-friendly formula, and show the detailed numbers in the UI:

```txt
Touge Drive Score =
  smoothness * 0.30 +
  cornerStability * 0.25 +
  safetyPace * 0.20 +
  checkpointScore * 0.15 +
  respectScore * 0.10
```

Make the score explicitly non-competitive:

- Smoothness: fewer harsh changes in speed.
- Corner Stability: calm speed changes around checkpointed curves.
- Safety Pace: staying in a reasonable demo speed range.
- Checkpoint Score: route progress.
- Respect Score: fixed positive score when the route is completed in "safe demo" mode, plus safety messaging.

Recommended UI labels:

- Smoothness Index
- Corner Stability Index
- Safe Pace Index
- Pilgrimage Sync Rate
- Respect Protocol
- Final Touge Drive Score

The style can feel a little dramatic, but the meaning must stay safety-first. Avoid making the number feel like a speed record.

## Demo Story

1. Start with the main app story: a Kanagawa anime quest map for visitors.
2. Show a normal Visit / Eat / Buy quest.
3. Say: "Some anime pilgrimages are not just spots. For driving works, the road itself is the sacred place."
4. Open Drive Mode from the Hakone / Initial D card, not from a global top-level menu.
5. Show the Hakone route, checkpoints, and tags.
6. Show two actions: Demo Drive and Try Real Drive.
7. Use Demo Drive for the guaranteed presentation path.
8. If the browser allows it, briefly show Real Drive collecting GPS / motion samples.
9. The car moves along the route.
10. Checkpoints complete.
11. Score appears with detailed values: Smoothness Index, Corner Stability Index, Safe Pace Index, Pilgrimage Sync Rate, Respect Protocol, and Final Touge Drive Score.
12. Close with: "We use tech not to encourage racing, but to help fans enjoy the route respectfully."

## Safe Wording

Use:

- "Drive pilgrimage"
- "Scenic route"
- "Smoothness score"
- "Safe pace"
- "Respect local roads"
- "Demo Drive"
- "Non-competitive"

Avoid:

- "Race"
- "Battle"
- "Fastest"
- "Attack"
- "Time trial"
- "Drift challenge"
- "Beat the rival"

Ghost Rival can be renamed to "Guide Ghost" or "Demo Guide" if used.

## Codex Implementation Prompt

```txt
In the current seichi-map app, add a supplemental Drive Mode MVP without making it the primary app flow.

Goal:
- Keep the existing Kanagawa quest/stamp map as the main experience.
- Add one Drive Mode route for Hakone Old Road / Nanamagari, attached only to the existing Initial D spot/card.
- Treat the route itself as a pilgrimage experience.

Implement:
1. Add route data in frontend/public/drive_routes.json or a small local constant.
2. Add an "Open Drive Mode" button only inside the Initial D / Hakone spot card.
3. Render the selected route as a polyline on the Google Map.
4. Render route checkpoints with labels: Start, Hairpin, Viewpoint, Goal.
5. Add a Demo Drive button that replays prepared DrivePoint samples.
6. Move a car marker along the route during Demo Drive.
7. Mark checkpoints complete when the demo marker comes within a small distance.
8. Show Touge Drive Score with breakdown:
   smoothness 30%, cornerStability 25%, safetyPace 20%, checkpointScore 15%, respectScore 10%.
9. Show the breakdown as detailed numeric values, with slightly dramatic labels such as Smoothness Index and Respect Protocol.
10. Make all copy safety-first: no racing, no speed competition, no leaderboard.

Do not add:
- login
- backend
- routing API
- copyrighted anime assets
- leaderboard or racing language

Challenge feature:
- You may add a small Real Drive experiment using navigator.geolocation.watchPosition and DeviceMotionEvent.
- Use both GPS and DeviceMotion when available.
- If DeviceMotion is unavailable or permission is denied, fall back to GPS-only DrivePoints with acceleration set to 0.
- Keep it isolated and removable.
- Demo Drive must remain the fallback if permissions or sensors fail.

Verify:
- npm run lint
- npm run build
- Manual demo: open app, choose Drive Mode, press Demo Drive, see car move, checkpoints complete, score shown.
```
