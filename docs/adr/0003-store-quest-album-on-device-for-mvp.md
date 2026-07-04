# ADR 0003: Store Quest Album On Device For MVP

## Status

Accepted

## Context

The Quest Album may contain personal photos, optional impressions, location context, and Driving Logs. Adding accounts or cloud sync would expand the MVP into authentication, consent, deletion, retention, and sharing-scope decisions before the core differentiated experience is proven.

## Decision

The MVP will store Quest Album data only on the Traveler's current device. Photos, impressions, and Driving Logs will not require an account, cloud sync, or server-side storage.

## Consequences

The product can demonstrate the album-centered quest experience with a smaller privacy surface. Travelers may lose album data when changing devices or clearing browser storage, and that limitation should be treated as an explicit MVP constraint.
