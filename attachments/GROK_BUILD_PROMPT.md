# MASTER PROMPT — BALL ARENA: FULL NEXT-GEN OVERHAUL

> Paste everything below the line into Grok Build together with the project (BallvsBall-main).

---

You are the **founder, lead game designer, art director, and principal engineer** of BALL ARENA. You own this product. It is October 2026 and the bar is a top-10 mobile game, not a hackathon demo. This is **not a mini update**: treat it as a full relaunch (v2) of everything the player sees, touches and hears, while the deterministic simulation underneath stays intact.

Read intent generously, decide like an owner, and ship. Do not ask me questions. Where the brief is silent, make the call that a top studio would make and state it in one line at the end.

## 0. Triage (so your own rules fire correctly)

This request explicitly asks for **accounts, sign-in / login, a "my profile" page, per-user data, saving progress across devices, and a leaderboard**. Therefore under AGENTS.md §0.5: **Auth = ON, Database = ON.** Follow `.grok/references/data-and-auth.md` and the `auth` and `neon` skills. Every server function uses `authMiddleware` and scopes by the verified `context.userId`, never a client-sent id.

## 1. Read before you write (mandatory)

1. `AGENTS.md` and all of `.grok/references/*.md` that the skills point to.
2. Skills, in this order: `design-ui` (and its `references/`), `building-games`, `game-ui-icons`, `game-animation-frames`, `game-character-consistency`, `controls`, `threejs`, `auth`, `neon`, `multiplayer-p2p`. Only call `imagine_*` tools if they appear in your tool list; otherwise ship art procedurally (SVG / canvas / shader / geometry) which is fully acceptable here.
3. Project files: `src/routes/index.tsx` (all HUD/DOM UI, 685 lines), `src/styles.css`, `src/render/world.ts` (the entire Three.js world and the avatar rig `makeRig`/`tickRig`), `src/game/{session,store,controls}.ts`, `src/economy/save.ts`, `src/config.ts`, `src/i18n`, `src/audio/synth.ts`, `src/packs/*`, `packs/core/balls/*.json`, `src/lib/auth/*`, `src/lib/multiplayer/*`, `migrations/auth/0001_auth.sql`.

## 2. Hard constraints (do not break)

- **Simulation is sacred.** `src/sim/*` stays deterministic, free of Three.js and DOM. Do not change balance, physics, RNG or ability behavior except through `CONFIG` or additive, versioned fields. `npm run test:arena`, `validate-packs`, `simulate`, `typecheck` must pass at the end.
- **Do not delete or overwrite** `public/__grok/`, `server/`, `scripts/grok-pwa-*`, the Grok branding injector, `vite.config.ts` contracts, `android-app/`, `.github/workflows/`, or the pack system and its specs. Do not put `og:*` tags in `__root.tsx`.
- Keep the routes `/` (free-roam hub), `/1v1` (direct duel) and `/1v1/admin` (pack lab, still gated by the admin PIN).
- Keep **EN / UZ / RU** i18n on every new string. Uzbek copy must read naturally, not machine-translated.
- Mobile-first (390x844 portrait and landscape) and fully usable on desktop (1440x900). Touch targets at least 44px, safe-area insets respected, no horizontal scroll, `prefers-reduced-motion` honored.
- Save data migrates **v1 to v2 without losing anything** (coins, diamonds, owned balls, avatar, streak, quests, settings). Never wipe a returning player.
- App listens on `0.0.0.0:8080`, started via `npm run dev`, `/workspace/startup.sh` maintained. Runs on Vercel: no runtime filesystem writes, no secrets in the repo, no `.env`.

## 3. Honest diagnosis of what exists (fix every one of these)

Look at the current free-roam screen. Problems to eliminate, not patch:

- **UI looks like a 2019 prototype.** Small dark rounded pills of mixed styles, tiny uppercase micro-text, no hierarchy, no depth, no brand. Top bar (logo, 1V1 LAB, currencies, music, quality) is a row of unrelated chips.
- **Rival name tags are giant, clipped by the screen edge, and fight the world.** The "YOU" tag overlaps the blue pads. Tags must be small, distance-scaled, billboarded, with rank badge, and never clipped.
- **The world is flat and muddy.** Beige on beige, chunky grey boxes blocking the view, a lonely cylinder platform, no atmosphere, no light story, no horizon, no sense of "arena".
- **Characters are capsule dolls.** Stiff limbs, no face personality, no weight, no secondary motion. They must feel alive.
- **Guidance text is a plain box.** Onboarding should be diegetic and animated.
- **The 1v1 admin lab picks balls with two raw `<select>` dropdowns.** Unusable for 16+ core balls plus multiple packs.
- No real profile, no auth surface, no meaningful shop, no progression you can feel.

## 4. Art direction (decide once, then apply everywhere)

Name it **"Neon Colosseum"**: a premium sports-arena fantasy. Warm stadium key light against cool neon rim light, glass and brushed-metal UI, glowing energy accents tied to ball rarity. Stylized-premium 3D (think the polish of Brawl Stars x Fortnite x Rocket League lobby), not low-poly placeholder.

**Build a real design system first** in `src/styles.css` `@theme` plus shadcn/Radix components in `src/components/ui`:
- Tokens: a 10-step surface scale, one brand gradient, a rarity palette (common / rare / epic / legendary / mythic, each with fill, glow, border and a signature animated treatment), semantic colors, spacing 4-pt scale, radii, 4 elevation levels, blur levels, motion durations and easings.
- Type: a display face with character for titles and numerals (self-hosted or Google Fonts with fallbacks) plus a highly legible UI face. Minimum body size 14px. Tabular numerals for currency, timers, HP.
- A reusable kit: `Button` (primary / secondary / ghost / danger / premium-gold, with press, hover, loading and disabled states), `Card`, `RarityFrame`, `CurrencyPill` (animated count-up and fly-to-wallet), `Modal/Sheet` (bottom sheet on mobile, centered dialog on desktop, focus trap, swipe-to-dismiss), `Tabs`, `Tooltip`, `Toast`, `ProgressRing`, `Badge`, `StatBar`, `Skeleton`, `EmptyState`.
- A custom **icon set** (SVG, consistent stroke and style) for every glyph. No emoji in production UI chrome.
- Motion language: springy, fast (120-280ms), meaningful. Number tick-ups, shimmer on rare+ cards, staggered list reveals, screen transitions with shared-element feel. No jank: animate `transform` and `opacity` only, hold 60fps on a mid-range phone.
- Sound: extend `synth.ts` and the four mp3s into a full UI sound set (tap, hover, open, close, confirm, error, coin, gem, reward, level-up, rarity reveal tiers, countdown ticks, victory / defeat stingers) plus a looping ambient lobby bed that ducks during matches. Master / music / sfx sliders.

## 5. Screens and features (build all of them)

### 5.1 Boot and Auth
- Cinematic boot: brand reveal with a ball rolling into the logo, asset progress bar, tip carousel.
- **Guest-first:** a player can tap Play immediately. A tasteful "Save your progress" prompt appears after the first win.
- **Auth screen** using the existing Better Auth setup in `src/lib/auth`: email + password and every social provider already available, a username picker with live availability check, avatar and country picker. Real validation, error states and loading states. **Guest to account merge:** on first sign-in, upload the local save to the cloud and resolve conflicts deterministically (never lose the larger economy). Sign-out and delete-account flows.

### 5.2 Lobby / Hub (the home screen, replaces the beige free-roam first impression)
- Hero 3D stage: the player's character on a lit podium with their **favorite ball orbiting or hovering**, slow camera drift, idle emote loops, ambient particles. Rival characters stay walkable in free-roam but the default state is the polished hub.
- Layout: top-left profile chip (avatar, level ring, name, rank), top-right wallet (coins, diamonds, fragments) with a "+" that opens the shop, a bottom **dock** with Play, Collection, Shop, Quests, Profile (large icons, active indicator, notification dots), a big primary **PLAY** button with an animated glow and matchmaking sub-modes (Quick Match, Ranked, vs Bot with difficulty, Practice).
- Season strip: current season name, tier progress, countdown. Event banner slot. News/offer carousel.
- Matchmaking overlay with animated search, estimated time, cancel, "opponent found" VS reveal showing both profiles.
- Free-roam stays as an optional "Plaza" mode with proper proximity prompts, small distance-scaled name tags with rank badges, and a clean "Challenge" interaction.

### 5.3 Profile (a real feature, not a stat dump)
- Banner and avatar frame (unlockable), username, title, level and XP ring, rank badge with trophy count, join date.
- **Showcase:** pick 3 favorite balls displayed as rarity cards.
- Stats: matches, win rate, win streak, best streak, damage dealt, favorite ball, total playtime, with charts (recharts is installed) for the last 20 matches.
- Match history list with opponent, ball used, result, replay-seed.
- Achievements grid with progress bars and claimable rewards (at least 40 achievements). Titles and badges. Edit-profile sheet.
- Public profile view so other players can be inspected from the leaderboard.

### 5.4 Ball Selection (the pick phase) and Collection
- The pick phase is the heart of the game. Redesign it as a dramatic card draw: three 3D-rendered ball cards with turntable preview, rarity border animation, role tag (control / burst / sustain...), a 4-axis stat radar, ability icons with one-line plain-language descriptions, and counter-hints. Confirm and reroll with clear costs, timer ring, and tension audio.
- **Collection:** grid with search, filters (rarity, role, pack, owned / locked), sort, and a detail sheet with a live 3D viewer (drag to rotate), full stats, ability breakdown with numbers, upgrade level (fragments), and skin variants. Fragment crafting and duplicate conversion visualized.

### 5.5 `/1v1/admin` — the Pack Lab, rebuilt as a pro tool
Replace the two `<select>` dropdowns completely.
- **Two-sided VS layout.** Each side has a large **ball picker**: searchable gallery with pack tabs, rarity and role filters, favorites, "random", and a live 3D turntable preview with full stat bars and ability list. Click to assign to Side A or B, drag-and-drop supported.
- Preset matchups, swap sides button, difficulty / AI preset, per-side launch angle with a visual **aim dial over a top-down arena minimap**, seed input (reproducible), and fight speed 0.25x / 0.5x / 1x / 2x / 4x with pause, **single-frame step**, and restart-same-seed.
- **Batch simulation panel:** run N matches (50 / 200 / 1000) off the main thread using `src/sim/batch.ts`, show a win-rate bar with confidence interval, average duration, damage dealt, first-blood stats, and a **matchup matrix heatmap** across selected balls. Export results as JSON/CSV. Flag balls that are over- or under-performing with simple tuning suggestions.
- Camera modes (chase, top-down, cinematic), debug overlays (hitboxes, velocity vectors, entity counts, FPS), collapsible console. Keep the PIN gate, restyle it as a proper lock screen.

### 5.6 In-match HUD and game feel
- Clean, minimal, high-contrast: top-center round and timer, two player plates (avatar, name, rank, HP bar with chip-damage trail, hearts), ability cooldown chips, a bold aim dial and Lock Aim button reachable by thumb (respect left-handed mode).
- Cinematic intro (camera sweep, VS plates slam in), 3-2-1 with screen punch, fight camera with dynamic FOV and slight shake on heavy hits, slow-motion on the final blow with a KO banner, hit-stop (a few frames) on big impacts, damage numbers that pop and fade, screen-edge vignette at low HP, sudden-death warning pulse.
- Result screen: Victory / Defeat with animated rewards fly-out (XP bar filling, coins, trophies, level-up burst, new-unlock reveal), MVP stats, rematch, share-card, back to lobby. Rewarded-doubler button slot (mock) is fine.

### 5.7 Shop (pay-to-win, built like a real live-ops store)
Players should be able to spend to gain real advantage, with a smart economy design behind it.
- **Tabs:** Featured (rotating hero offer with countdown), Balls, Gacha / Crates, Boosts, Cosmetics, Currency, Bundles.
- **Power for money:** premium ball tiers, ball level-up packs (fragments), **XP and coin boosters** (2x for 1h / 24h / 7d), extra reroll tokens, starter pack, "Pro Pass" with permanent perks (extra daily rerolls, +coin %, exclusive ball line), first-purchase 2x bonus on each currency pack, limited-time bundles with strike-through pricing and urgency timers.
- **Gacha:** a gorgeous crate-opening sequence (anticipation build-up, light bursts tinted by the rarity revealed, card flip, camera zoom), visible odds and pity counter (guaranteed epic at 10, legendary at 40), duplicate-to-fragment conversion animation, multi-pull x10 with skip.
- **Battle Pass:** 50 tiers, free and premium tracks, visual tier ladder with claim animations.
- Diamond packs (use the existing `CONFIG.diamondPacks`, expand) with a tiered value ladder ("Best value", "Most popular" badges).
- **Checkout:** build a payment-provider-agnostic `purchase()` abstraction with server-side order records and **idempotent, server-verified** fulfillment. Without a real provider key, run in an explicit **"TEST MODE" checkout** (clearly labeled in the UI, no real charges, no card fields). Never show fake "payment successful with real money" claims. Structure it so connecting Stripe later is a config change.
- Balance guardrail (design note, implement it): paid players get faster progression and stronger access, but matchmaking keeps a skill-rating component so free players still find fair, winnable matches and the game stays alive.

### 5.8 Daily rewards, Quests, Streaks, Events
- Daily login calendar (7-day cycle with a mega reward on day 7) with a satisfying claim animation, streak flame with streak-save token, missed-day recovery offer.
- Daily and weekly quests with progress bars and claim buttons, quest refresh timer, a weekly mega-chest.
- A rotating **Event** page (e.g. "Double Trophy Weekend") driven by a data file so new events need no code change.
- Notification dots across the dock and a unified "Rewards" inbox.

### 5.9 Leaderboards and social
- Global and country leaderboards (trophies), season leaderboard, friends tab with add-by-username and challenge-a-friend. Use `src/lib/multiplayer/p2p.ts` for a friend duel path where feasible; if true real-time PvP is not feasible, ship asynchronous bot-ghost duels that use the friend's last ball loadout and say so honestly in the UI.
- Ranked ladder: 8 divisions with distinct emblems, promotion / demotion, season reset with rewards.

### 5.10 Settings
Graphics (Auto / Low / Medium / High with a live FPS readout), audio sliders, language, haptics, left-handed, colorblind-safe rarity mode, reduce motion, account management, data export, credits, privacy, support link.

### 5.11 Avatar Studio (the existing "style" modal, rebuilt)
Live 3D preview with rotate, categories (hair, hats, faces, tops, bottoms, shoes, back items, emotes, victory dances, ball trails, explosion FX, aim-line FX, avatar frames, titles), rarity-tagged, buy / equip / preview-before-buy, outfit presets, randomize, save slots.

## 6. Character and animation (this must stop looking like a doll)

- Replace the capsule rig with a **proper articulated character**: separate head, neck, torso, pelvis, upper / lower arms, hands, upper / lower legs, feet, with correct pivots and proportions. Expressive face (animated eyes with blinking and look-at, brows, mouth shapes for idle / talk / cheer / hurt). Cloth-like secondary motion on capes, scarves, hair and hat tassels via simple spring chains.
- `MeshStandardMaterial` / `MeshPhysicalMaterial` with believable PBR values (fabric roughness, skin subsurface faked via rim and soft shading), baked-feeling AO via gradient maps and contact shadows, rim light, soft shadow. If `GLTFLoader` and generated assets are available, use them; otherwise do it with procedural geometry and make it look intentional.
- **Animation set** with blending and state machine: idle (breathing, weight shift, look-around), walk and run (foot planting, hip sway, arm swing, lean into movement, banking on turns), stop skid, jump if needed, ball-throw wind-up and release for the aim / launch moment, flinch on hit, victory dances (3+), defeat slump, 8+ emotes with a radial emote wheel, spawn-in and teleport effects. Smooth damping everywhere, no popping.
- Characters look at points of interest (the opponent, the camera, the nearest rival) with head and eye tracking.
- Ball visuals: raise quality of `makeBall` with rarity-tier effects (legendary and mythic get animated energy shells, orbiting particles, dynamic trail ribbons), squash and stretch on impact, spin matched to velocity, better contact sparks and shockwave rings, and distinct per-shape silhouettes.

## 7. World and atmosphere

- Replace beige-on-beige with a real **stadium environment**: tiered crowd silhouettes with subtle animated cheering and glow-stick or phone-light sparkle, a high-contrast sky or dome with volumetric-feeling light shafts, big screens showing live match info, banners and sponsors (fictional), drifting dust and embers, reflective arena floor with animated neon edge lines, rarity-colored underglow when a rare ball is selected.
- Remove or restyle the big grey blocking boxes. Fix camera framing so rivals and name tags are never cropped. Better lobby camera with eased follow, FOV tuned per aspect ratio, and depth of field feel (cheap, via fog and vignette).
- Tone mapping (ACES), proper sRGB output, a hemispheric plus key plus rim lighting setup, fog, and a post-process-lite pass (bloom approximation, vignette) gated by the quality setting. Maintain Low mode that runs smoothly on low-end Android.
- Adaptive quality: auto-downgrade on sustained low FPS, never auto-upgrade mid-match.

## 8. Backend and data

- Add migrations (`migrations/0002_*.sql` and onward): `profiles`, `saves` (versioned JSON blob plus server-validated economy fields), `matches`, `leaderboard`, `inventory`, `orders`, `quests_progress`, `achievements`, `friends`, `seasons`.
- Server functions (all behind `authMiddleware`, all scoped by `context.userId`, all inputs validated with zod): load / save profile, sync save with conflict resolution, record match result (server recomputes rewards, never trusts client currency), claim daily / quest / achievement / pass tier (idempotent), purchase and fulfill, leaderboard query with pagination, friend operations.
- Anti-cheat basics: server-side reward caps, rate limits, signed match tickets, suspicious-delta rejection. Guest data stays local only.
- Offline: the game remains playable offline as guest; queue and replay sync when back online.

## 9. Quality bar, process and verification

Work in this order and verify after each step with Playwright screenshots at **390x844, 844x390 and 1440x900**, reading the screenshots critically against the diagnosis in section 3:
1. Design system and tokens, icon set, base components.
2. Renderer upgrade: lighting, environment, character rig and animation, ball visuals.
3. Lobby, matchmaking, HUD, result screen.
4. Pick phase, collection, avatar studio.
5. Auth, profile, backend migrations and server functions.
6. Shop, gacha, battle pass, daily / quests / events, leaderboards.
7. Pack Lab rebuild.
8. Audio pass, performance pass, accessibility pass, i18n pass (check Uzbek and Russian strings for overflow in every screen).

Acceptance checklist (do not report done until all are true):
- No screen looks like the old UI; no leftover raw `<select>`, emoji chrome, or unstyled default controls.
- Every interactive element has hover, active, focus-visible, disabled and loading states, and sound.
- 60fps on desktop and a stable 30+ fps on Low quality; no console errors; no layout shift on load.
- `npm run typecheck`, `npm run test:arena`, `npm run validate-packs`, `npm run build` all pass. Add tests for the save migration, reward calculation, gacha pity logic and purchase idempotency.
- Existing players' v1 saves load and migrate cleanly (test it).
- The dev server is left running on 8080 with `startup.sh` current.

Do not stop at a vertical slice. Build the full scope above, cutting only what is genuinely infeasible, and list anything cut in your final message.

**Final message format (product language, no ports or paths):** a short summary of what the player will now experience, the 3-5 design decisions you made on my behalf, what runs in test mode (payments), and what you recommend building next.
