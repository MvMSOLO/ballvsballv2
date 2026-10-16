# Phase 15 — Cloud Save Integrity & Recovery

## Outcome

Phase 15 hardens the existing client/cloud save merge for match history. It does not introduce online multiplayer or treat a client-authored match as server-verified ranked evidence.

## Changes

- Normalize legacy and malformed match-history rows into finite timestamps/numbers, safe bounded labels, a boolean outcome, and a usable record ID. Rows without an ID are discarded.
- De-duplicate by match ID, prefer the newest timestamp when duplicate copies disagree, sort by newest timestamp, and cap the history at 20.
- Apply the same canonical history policy during save migration and when combining device/cloud saves, so stale device ordering cannot crowd out newer cloud match records.
- Add regression coverage for malformed legacy records, duplicate IDs, multi-device history merging, chronological ordering, and the retention cap.

## Validation gates

GitHub Actions must pass the route/build compilation, typecheck, lint, arena/economy tests, policy tests, pack validation, and production build before the changes can merge.

## Boundaries

- Existing local bot duels remain unranked; this change does not turn local history into authoritative online match proof.
- GitHub Actions validates the repository build and automated tests. A separate successful Vercel deployment and real mobile/profile visual QA are required before claiming a fully verified production release.
