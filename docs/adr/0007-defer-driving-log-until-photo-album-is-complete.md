# ADR 0007: Defer Driving Log Until Photo Album Is Complete

## Status

Accepted

## Context

Driving Log is a strong special-case feature for the Initial D route quest, but GPS and smartphone motion handling can become complex enough to destabilize the MVP. The core differentiated experience is the Kanagawa Quest Album built from photo-based quests, optional impressions, and an Album Map.

## Decision

The MVP will complete the photo-based Kanagawa Quest Album first. Driving Log will remain a special extension point for the Initial D quest and should be added only after the main quest album flow is working end to end.

## Consequences

The team can protect the central product story while preserving Driving Log as a later technical highlight. Existing or separate Driving Mode work can be reused later, but it should not block the initial album-centered MVP.
