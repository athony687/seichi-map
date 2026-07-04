# ADR 0005: Use Curated Quest Data For MVP

## Status

Accepted

## Context

Kanagawa Quests need to tell Travelers what memory to capture at each spot. Runtime-generated quests could be vague, inconsistent, or hard to demo reliably.

## Decision

The MVP will use curated fixed quest data for each spot. Each Quest Set may contain one to three quests, and each quest should define its photo prompt, optional impression prompt, and completion type in shipped data.

## Consequences

The team can make the quest experience feel specific to Kanagawa and reliable in the demo. Adding or improving quests requires data edits instead of automatic generation.
