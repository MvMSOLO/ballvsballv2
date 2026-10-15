# BALL ARENA — 15-Phase Full Redesign

**Product direction:** a distinctive premium competitive arena with strong gaming hardware aesthetics. REDMAGIC is a reference for visual confidence, performance-first framing, and an obvious gaming mode—not a template to copy. Keep controls legible, navigation discoverable, and gameplay first.

**Non-negotiable:** preserve the working match simulation, auth, player saves, shop purchases, profile cosmetics, progression, owner/admin permissions, server sync, and Android/PWA paths. Visual refactors must not silently replace functionality with mock data.

## Baseline audit

Public screens reviewed: home arena, profile, shop, inventory, leaderboard, settings, sign-in, /1v1/admin, and /1v1/.

- The game already has a Three.js arena, local bot duel flow, ball selection/aim/fight/result phases, procedural/WebAudio sound integration, account pages, and an economy/save system.
- Existing pages use many ad-hoc CSS selectors and more than one navigation pattern. Existing styles combine cyan/blue neon, red/orange accents, glass panels, small all-caps labels, and card treatments; the result is not yet one consistent, art-directed product.
- Public home screen makes the 1V1 LAB route conspicuous even though it is labeled as an admin/test control deck. Product visibility and authorization must be assessed separately.
- Baseline browser audit at 390×844 and 844×390: mobile hub/login pages fit; portrait gameplay asks the user to rotate; at narrow landscape the outer arena characters can clip.
- README describes gameplay as a local bot duel, not full online multiplayer. Do not market it as online PvP until that functionality exists.

## Design principles

1. Intentional visual hierarchy beats decoration. UI should not cover the primary arena or make players read paragraphs before playing.
2. Strong hardware-inspired identity: deep graphite/near-black, controlled signal-red and electric-blue accents, precise borders, technical typography, light/shadow that suggests machined materials.
3. No default-on overload: restrained ambient motion; high-intensity effects reserved for gameplay moments and important rewards.
4. Sound and visual feedback should confirm actions without becoming repetitive or fatiguing.
5. Accessibility, reduced motion, readable labels, keyboard support, mobile touch targets, and contrast are built in from the start.
6. Honest product behavior: no fake concurrency counts, invented player activity, fake purchases, misleading price/rarity UI, or fake online-PvP claims.
7. Never call a phase complete until acceptance checks run and its deployed screens have been visually checked.

## Phases and acceptance criteria

### Phase 01 — Visual DNA / shared design system
**Status:** foundation implemented on main; automated contract gate wired into production build and npm test. The final deployment status must be checked against the latest commit, and a post-deploy multi-route visual regression review remains required.
- Expanded src/design-system.css into semantic palette, typography, spacing, shape, elevation, motion/easing, layer, focus, and control-size token families.
- Added src/ui-primitives.css with composable layout, typography, cards, buttons, icon buttons, fields, badges/chips, divider/status, progress, skeleton, empty-state, and visually-hidden primitives.
- Registered the primitive stylesheet in src/routes/__root.tsx after the shared art-direction stylesheet.
- Added scripts/check-design-system.mjs and wired it into npm run build and npm test. It checks required token/primitive coverage, stylesheet registration, reduced-motion/forced-colors/focus support, and CSS brace balance. This is a contract gate, not a substitute for a browser build or visual/accessibility review.
- Documented usage and change policy in docs/DESIGN_SYSTEM.md.
- Acceptance still required: final deployment ready, all core routes reviewed visually, component states checked at mobile and desktop widths, and no CSS/runtime errors.

### Phase 02 — Brand identity and art direction
**Status:** implementation pushed to main; deployment build status and post-deploy visual review still gate acceptance. Added the primary horizontal wordmark, integrated it into both the free-roam arena and player-hub headers, created an animated loading mark and Season 01 / Origin badge, added a brand usage guide, and introduced contract checks for these assets and social metadata. The existing angular sigil and favicon remain the compact identity.
- Finalize distinctive BALL ARENA wordmark/sigil, logo lockups, favicon/app icon, loading mark, season badge, and brand usage rules.
- Establish a deliberate surface/material vocabulary and rarity/state color map. Keep the identity recognizably original rather than imitating REDMAGIC logos or assets.
- Acceptance: brand is recognizable at 24 px and in an Instagram ad thumbnail; icons and typography are consistent across every screen.

### Phase 03 — Home / lobby rebuilt
**Status:** responsive lobby update pushed to main; one production visual review found composition defects and a corrective patch is now pushed. The camera uses aspect-aware framing; rival NPCs and platforms were shifted into a tighter formation; the front/rear-left rivals move right to clear the briefing; the back-center rival was moved behind the player instead of below the viewport; and short-landscape HUD compaction hides nonessential briefing text/metrics while preserving the objective and movement hint, with the panel moved below the top navigation rail. Automated contract checks guard the NPC positions and landscape layout rules. Remaining: visually verify the corrective production deployment at desktop and 844×390, then check tablet/portrait and confirm no UI collisions.
- Recompose the first screen: arena as the hero, player identity and wallet as compact rails, a single obvious play/challenge action, contextual rival prompts, and readable secondary destinations.
- Remove visual competition from unnecessary floating cards and overlong instructions.
- Acceptance: a new player can identify the next step quickly; the central playfield is not obscured; test desktop, tablet, portrait mobile, and landscape mobile.

### Phase 04 — 3D arena / scene art direction
**Status:** scene art-direction implementation and a follow-up performance/HUD patch are deployed. The lobby now has a stadium crown with alternating cyan/orange signal seams, machined floor inlays, a batched deep-space starfield, and a restrained animated crown signal. The duel arena adds broadcast-style floor markings, team-color perimeter rails and corner beacons; the former thick glass slab is replaced by a faint overhead force-field plane above the fighters. Lobby camera parallax is low-amplitude and does not change duel aim. Production review on the first scene commit confirmed desktop and 844×390 framing, WebGL2 startup, the crown/floor marks, and the duel route, with no captured app runtime errors. That review also measured unexpectedly low hosted-browser frame pacing (~4 FPS desktop/~8.8 FPS landscape) and found a decorative footer overlapping the LEFT STICK label. The follow-up commit hides that landscape-only footer, instances repeated stadium parts, removes a full-screen CSS canvas filter, disables multisample antialiasing to reduce GPU load, feeds real animation-frame timing into adaptive quality, avoids renderer re-creation when quality changes, reuses static lobby data, skips idle trail-pool resets, and disposes scene resources on teardown. Vercel production build and contract gates pass. The most recent post-patch browser retest failed before app load with ERR_TUNNEL_CONNECTION_FAILED (including a control site); therefore the post-patch FPS and overlap results remain unverified. Implementation is in place; final acceptance still requires a successful browser/device retest and a confirmed frame-pacing result.
- Redesign arena framing, background, lighting, materials, character placement, camera ease, idle motion, shadows, and scene transitions.
- Preserve deterministic gameplay and ensure important entities remain inside the safe composition at narrow aspect ratios.
- Acceptance: no clipped important characters; stable frame time at Low/Medium/High quality; gameplay readable when effects are active.

### Phase 05 — Match flow and combat HUD
**Status:** preparatory code audit completed in docs/PHASE_05_COMBAT_HUD_PLAN.md; the HUD implementation has not started. The existing simulation already defines intro, pick, aim, countdown, fight, round, and end states. Keep src/game/session.ts authoritative; the next phase should refine presentation and fix the documented local aim-state/reroll affordance issues without rewriting combat/economy rules.
- Redesign pick, aim, countdown, fight, round-result, match-result, and rematch phases as one clear flow.
- Keep the arena visible; use contextual controls, meaningful progress feedback, distinct player/opponent lanes, and readable HP/status information.
- Acceptance: all phases and edge states tested; controls work by mouse, keyboard, and touch; no state is represented only by color.

### Phase 06 — Ball presentation and collection identity
- Build a unified 3D ball-preview treatment with distinctive silhouettes/materials, rarity borders, stat visualizations, ability glyphs, selection/inspect states, and controlled previews.
- Prefer real 3D previews over generic emoji/glyph substitutes where feasible; respect actual ball definitions and stats.
- Acceptance: selected and owned states are unambiguous; stats match simulation data; previews scale across devices without layout shift.

### Phase 07 — Shop, inventory, cosmetics, profile
- Turn each screen into a complete, consistent product experience: searchable/filterable catalogue, ownership, equipped state, profile identity, rank/XP, frames, cosmetics, and useful empty/loading/error states.
- Keep price and rarity semantics truthful; buying/equipping and persistence must continue to use existing economy/persistence logic.
- Acceptance: purchase, insufficient balance, already owned, equip/unequip, save/hydration, and error scenarios are exercised.

### Phase 08 — Authentication and onboarding
- Make sign-in/create-account feel like part of the product, explain benefits simply, provide clean validation/loading/recovery states, and make guest-to-account progression comprehensible.
- Preserve existing auth implementation and provider capability. Do not create an authentication success appearance before the server confirms it.
- Acceptance: sign-in/up, invalid credentials, pending/disabled provider, session loading, signed-out routes, and return-to-game paths work.

### Phase 09 — Navigation, settings, leaderboard, admin boundary
- Unify nav structure across arena and player hub; use discoverable labels at desktop and mobile; clarify route hierarchy.
- Decide if the 1V1 lab is public product functionality or internal testing. Enforce actual authorization on protected functions/routes; hiding a link alone is not security.
- Improve settings categories, language, graphics, sound sliders, reduced motion, and destructive reset confirmation.
- Acceptance: every navigation path is reachable and consistent; admin controls remain owner-only; no normal player can invoke protected actions.

### Phase 10 — Motion language and micro-interactions
- Define duration/easing tokens and reusable transitions for navigation, panels, focus/hover/press, ball inspect, state change, rewards, and win/loss.
- Gameplay VFX must communicate hit strength and ability type; idle screens remain calm. Respect prefers-reduced-motion and user settings.
- Acceptance: transitions are smooth at common refresh rates and low-performance mode; no infinite attention-grabbing animations compete with play.

### Phase 11 — Audio identity and mix
- Create a sound map for UI select/confirm/error, movement, hit strengths, ability classes, charging, round start, victory/defeat, and rewards.
- Layer effects with volume caps, short cooldowns/variation, separate music/ambience/UI/effects controls where implemented, and a proper muted state.
- Acceptance: no sound-trigger spam, clipping, or overlapping loops; mute and settings persist; visual feedback still communicates without sound.

### Phase 12 — Mobile, tablet, accessibility
- Compose each screen for real sizes rather than simply shrinking desktop: safe areas, touch targets, landscape and portrait policy, text scaling, focus order, contrast, reduced motion, and notches.
- Review if portrait rotation gate is necessary; if keeping it, make it deliberate and explainable.
- Acceptance: no horizontal overflow or clipped critical content at 320 px, 390 px, 844×390 landscape, tablet, and desktop; keyboard-only and contrast/reduced-motion review complete.

### Phase 13 — Performance and stability
- Profile Three.js draw calls, effects/particle pools, texture/material reuse, animation loops, rerenders, memory cleanup, and low-end Android conditions.
- Keep progressive quality settings real and understandable. Avoid trading away readability for decorative effects.
- Acceptance: frame-time and memory checks recorded on defined devices; canvas/context cleanup works across navigation; no event/listener leaks.

### Phase 14 — Functional QA, security, and release gates
- Run typecheck, lint, unit tests, arena simulation tests, pack validation, auth invariants, production build, link/route checks, and protected-action tests.
- Audit consistency across local save/server sync, player currency/XP, purchase/equip, owner editing, guest mode, and error recovery.
- Acceptance: all documented gates pass; record results; test production deployment without falsely claiming a skipped test passed.

### Phase 15 — Brand launch and measured growth
- Create coherent screenshots, logo/avatar/icon, short gameplay cutdowns, Instagram ad variants, store/landing page media, and reusable announcement templates.
- Every asset must show actual gameplay and accurately represent available features; no fake online player counts or fake reviews.
- Instrument first-session funnel, first duel completion, rematch, D1/D7/D30 retention, and crash/performance metrics. Compare creative and onboarding variants with real measurements.
- Acceptance: launch checklist complete, analytics verified, and marketing copy/features aligned with production. Popularity and ratings are goals—not guarantees.

## Research links

- REDMAGIC 11 Pro Game Space overview (official): https://mea.redmagic.gg/en/blogs/game-space/redmagic-11-pro-game-space-upgrades
- REDMAGIC 11 Pro review (TechRadar; notes striking hardware and software polish issues): https://www.techradar.com/phones/redmagic-11-pro-review
- REDMAGIC 10 Pro review and score (WIRED 7/10; strong gaming performance, criticized software clutter): https://www.wired.com/review/nubia-redmagic-10-pro/
- Current REDMAGIC software feedback thread: https://www.reddit.com/r/RedMagic/comments/1wcerej/redmagic_update_lets_collect_all_the_bugs_we_find/
- Practical game HUD / accessibility design discussion: https://www.strayspark.studio/blog/game-ui-ux-design-principles
- Roblox retention documentation: https://create.roblox.com/docs/production/analytics/retention
- Roblox discovery FAQ: https://create.roblox.com/docs/discovery-faq

These sources inform principles, not a claim that one style guarantees high ratings. External reputation has to be tested on this product with real players and post-launch analytics.