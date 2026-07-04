# ADR 0002: Separate Real And Sample Driving Logs

## Status

Accepted

## Context

Initial D route quests should use a Driving Log built from GPS and smartphone motion data, because the route itself is the sacred-place memory. The hackathon demo still needs a reliable preview path, but mixing replayed demo data with real route completion would weaken the meaning of Quest Completion.

## Decision

Real Driving Logs created from live GPS and smartphone motion data can count as formal Quest Completion. Sample Driving Logs created from prepared or replayed route data may appear in the Quest Album UI for demo and preview, but they must be labeled as samples and must not count as formal Quest Completion.

## Consequences

The demo can show the full Driving Log and album experience without pretending that replayed data is a real visit. The implementation must keep completion state separate from sample preview state.
