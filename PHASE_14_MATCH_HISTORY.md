# Phase 14 — Match History Integrity

## Scope

- Persist each completed non-admin local duel into the existing player-save history.
- Store the correct player-relative result, opponent, player ball, rival ball, match seed, end timestamp, and total damage dealt across every round.
- Keep only the newest 20 unique records; do not duplicate a match if its completion handler is retried.
- Keep owner/admin pack-lab test fights out of the profile's match history.
- Improve the profile's recent-duel row so it displays both chosen balls and damage alongside the result/date.
- Add deterministic pure tests for input normalization, deduplication, ordering, limits, and immutability.

## Trust boundaries

The match history is a client-local progress feature, consistent with the repository's current local bot-duel architecture. It is not ranked multiplayer proof and does not award trophies; trophy deltas remain zero until a server-authoritative ranked match system defines them.

## Validation

GitHub Actions must pass typecheck, lint, arena tests, the new history policy tests, pack validation, and production build before merge. Mobile/browser visual QA is still required for the actual profile page.
