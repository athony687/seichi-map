# ADR 0006: Store Resized Album Photos

## Status

Accepted

## Context

Local Quest Album data is stored on the Traveler's current device, and phone camera photos can be several megabytes each. Keeping original full-resolution files would make the album heavier than needed for viewing, map thumbnails, and Share Cards.

## Decision

The MVP will resize and compress uploaded photos in the browser before saving them as Album Photos. The original full-resolution camera file will not be stored by the app.

## Consequences

The album stays lighter and more responsive on mobile devices. Album Photos are suitable for in-app viewing and sharing cards, but they are not a backup of the original camera photo.
