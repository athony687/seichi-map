# ADR 0001: Make Drive Mode A Supplemental Demo-First Route Experience

## Status

Accepted

## Context

The hackathon theme is omotenashi, and the team needs a focused demo that communicates clearly in about five minutes. The app had been a general Kanagawa anime pilgrimage map with food and souvenir quests, but review feedback said the feature set was too broad and not differentiated enough.

Driving anime pilgrimage is a strong niche: for mountain-road works, the sacred place is often the route, not a single spot. However, the team also wants to keep the current Kanagawa quest/stamp map as the main experience and use Drive Mode as a feature-point booster.

## Decision

Drive Mode will be built as a supplemental demo-first route experience:

- Attach Drive Mode only to the Hakone / Initial D spot card rather than replacing the main app flow or adding a global top-level mode.
- Use predefined routes, not automatic route generation.
- Build Demo Drive as the fallback path.
- Attempt Real Drive with GPS plus DeviceMotion as an isolated challenge feature that can be removed quickly.
- Use prepared DrivePoints to show marker movement, checkpoint completion, and scoring reliably.
- Keep Real Drive and DeviceMotion optional and isolated from the core quest flow.
- Fall back to GPS-only DrivePoints with `acceleration: 0` when DeviceMotion is unavailable.
- Display detailed numeric scoring because it makes the technical challenge visible in the presentation.
- Score safety and smoothness, not speed.

## Consequences

This gives the project a technical highlight without making the presentation depend on Drive Mode. Real Drive may be unstable, but keeping it isolated limits the blast radius of sensor instability and GPS permission problems.

The trade-off is that the team may spend time on a feature that is removed before submission if browser sensors behave poorly. That is acceptable because the experiment is intentionally isolated and Demo Drive remains the fallback.
