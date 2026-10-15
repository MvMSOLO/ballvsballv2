# BALL ARENA — Phase 05 Combat HUD Handoff

**State:** Phase 05 initial combat-HUD pass implemented: aim state syncs from the session view, confirmed picks disable reroll, fight status no longer implies a zero-second limit, and both HP bars expose proportional values plus accessible text. Remaining: verify real transition/error paths and layouts after the current patch, run the project test suite, and measure rendering on target hardware. This is an incremental HUD pass, not a claim that the complete Phase 05 acceptance checklist is finished.

## Scope and invariants

- Keep src/game/session.ts the source of truth for match state and timers.
- Keep src/routes/index.tsx responsible for accessible phase controls and the React HUD.
- Keep src/render/world.ts responsible for the arena camera, ball/entity presentation, and combat VFX; HUD redesign must not cover the useful center of the playfield.
- Do not change simulation math, winner determination, reroll pricing, currency/XP awards, save persistence, or bot behavior as part of a visual-only HUD pass.
- Do not reveal an opponent's chosen ball before the session reveal window. publicView() currently controls this with its reveal flag for countdown/fight/round/end.

## Current flow and UI mapping

| Session state | Current UI | Phase 05 direction |
| --- | --- | --- |
| intro | “CHALLENGE ACCEPTED” banner | Keep as a short arrival transition; do not let an intro state hide the canvas for long |
| pick | Ball cards, stats/ability summaries, reroll and confirm | Make selected, confirmed, loading, unavailable, and error states clear; disable reroll after the player's pick is confirmed |
| aim | Angle range control, lock button, opponent lock status | Sync the slider to view.myAim when entering aim or starting a new round/rematch; preserve opponent-angle privacy |
| countdown | Countdown pulse/status panel | Give the countdown a clear start signal and keep the arena visible |
| fight | Both ball names, numeric HP, ability text, optional 2× vote | Add clear visual HP bars and time-independent fight status; don't show “0s” as if it were a live fight timer |
| round | Round won/lost result with “Next round loading…” | Clearly distinguish a continuing round from a completed match and indicate the short transition |
| end | Victory/defeat, rewards, rematch, lobby | Clarify rewards and outcome without claiming an online PvP match |

## Evidence-based gaps to address first

1. **Aim slider state can drift — first fix implemented.** The slider now re-seeds from PublicView.myAim during aim state and normalizes it to 0–359°. Verify again on a new round and rematch.
2. **Reroll affordance after confirm — first fix implemented.** The control disables after confirmation and its title communicates the locked state; pricing and balance logic are unchanged.
3. **Fight timer semantics — first fix implemented.** Fight now shows LIVE MATCH, 2× SPEED, or SUDDEN DEATH rather than a misleading zero-second timer.
4. **Combat readability — first fix implemented.** Each side has an ARIA progressbar bound to view.hp/view.maxHp, numeric values, and a visible CRITICAL warning below 25% HP.
5. **Transitions and error cases.** Make bot lock/timeout, empty offers, failed/denied reroll, countdown-to-fight, round continuation, end rewards, rematch, and lobby return visually predictable. Do not present a success state before applyCommand() or persistence reports success.

## Proposed sequence

1. Add/review component-level flow-state and disabled-state contracts before restyling.
2. Fix aim-state synchronization, confirmed-reroll disabled behavior, and fight phase-chip semantics.
3. Recompose HUD hierarchy: round/heart score, selected ball identities, proportional HP bars, combat callouts, phase context, and contextual action row.
4. Tune desktop, 844×390 landscape, tablet and 390px/320px viewports. Respect safe areas and reduced motion.
5. Test actual session transitions, mouse/keyboard/touch controls, timeout and error paths, rematch and lobby return. Confirm no state leak across a new match.
6. Run npm run test, npm run test:arena, npm run typecheck, npm run validate-packs, and the production build where execution environment supports each command; report skips accurately.

## Acceptance checklist

- [ ] All seven states have one obvious headline, one primary action (where actionable), and no conflicting secondary action.
- [x] Aim slider represents the session's current side angle whenever flow is aim; opponent aim remains hidden. Verify again across round/rematch transitions.
- [x] Reroll control disables after a confirmed pick; pricing/balance logic remains unchanged.
- [x] HP bars derive from view.hp and view.maxHp; exact values remain readable without color.
- [x] Fight no longer displays a misleading zero-second countdown.
- [ ] Mouse, keyboard, and touch controls all work; focus order and labels are preserved.
- [ ] Desktop, tablet, 844×390, 390px and 320px views have no clipped controls or arena-obscuring panels.
- [ ] Match outcome, rewards, rematch and lobby return are checked against real session state, not demo-only UI.
- [ ] Production browser review completes without app runtime errors, and no unsupported online-PvP claims are introduced.
