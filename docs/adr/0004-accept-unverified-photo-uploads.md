# ADR 0004: Accept Unverified Photo Uploads

## Status

Accepted

## Context

Photo Quests use photos taken with the phone's built-in camera app and uploaded into seichi-map. The product goal is to make a lightweight Quest Album, not to prove visits with strict photo forensics.

## Decision

The MVP will accept uploaded photos without checking EXIF, GPS, capture time, or whether the photo was taken during the current quest attempt.

## Consequences

Quest completion is easier and less invasive, and the app avoids fragile device-specific metadata handling. The album should be framed as a personal travel record rather than an anti-cheat system.
