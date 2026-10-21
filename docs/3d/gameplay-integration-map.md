# 18-asset gameplay integration map

## Scope and state ownership

The 18 environment GLBs are registered in src/render/arena-assets.ts and loaded by the existing Three.js renderer in src/render/world.ts. Six assets belong to the social lobby and twelve belong to Rift Expanse. The 3D free-roam worlds are presentation/navigation contexts; the actual duel is still the existing deterministic combat arena. These GLBs are not added to the 34-ball collection, battle pool, reroll or confirmation state.

That boundary is intentional: none of these environmental props is allowed to change combat results, hit points, ball identity or round state merely because its mesh is visible or overlaps another object. The existing match flow remains the sole source of truth.

## Asset-by-asset ownership

| GLB | Runtime zone | Existing purpose | Interaction contract |
|---|---|---|---|
| Spawn_Beacon_Platform.glb | Lobby | Arrival deck and spawn landmark | Visual landmark around existing spawn; does not choose spawn coordinates |
| Rift_Gate_Arch.glb | Lobby | Gateway announcing the Rift Expanse map | Visual route/map landmark; no invented teleport mechanic |
| Obsidian_Spire.glb | Lobby | West skyline landmark and orientation cue | Non-colliding scenery; does not block movement |
| Skyline_Outpost.glb | Lobby | East/north plaza architecture | Non-colliding scenery; preserves open spawn area |
| Triad_Relay_Beacons.glb | Lobby | Arrival/event route marker | Visual landmark only; no fabricated event or objective state |
| MVM_Boppo_Mascot.glb | Lobby | Branded mascot point of interest | Separate from controllable player rig; no gameplay authority |
| Eclipse_Ring_Arena.glb | Rift | Central ring landmark | Defines visual map identity; not the duel arena collision surface |
| Titan_Gate_Frame.glb | Rift | Far-end frame / visual destination | Static environment landmark |
| Broken_Portal_Fragments.glb | Rift | Fractured portal cluster | Static landmark; no teleportation trigger |
| Rift_Rail_Bridge.glb | Rift | South crossing and route cue | Visual traversal cue; no walkable collision is implied by appearance |
| Citadel_Arena_Platform.glb | Rift | Raised side focal point | Environment geometry; not a battle platform or scoring zone |
| Graviton_Obelisk.glb | Rift | Crystalline orientation landmark | Visual-only; no gravity or force mechanic is implied |
| Signal_Display_Totem.glb | Rift | Perimeter signpost for orientation | No fabricated round/objective text or state |
| Orbit_Cage_Reactor.glb | Rift | East-perimeter reactor landmark | No hazard/damage behavior |
| Voidstone_Meteor.glb | Rift | South-east natural counter-shape | Presentation spin only; no collision/physics authority |
| Magma_Reactor_Tower.glb | Rift | South-west warm-color landmark | No heat/damage behavior |
| Cyclone_Engine.glb | Rift | Turbine-like perimeter installation | Showcase presentation only; not a rotating physics hazard |
| Rift_Relic_Shard.glb | Rift | Western relic point | Visual landmark; not an inventory collectible or power-up |

## Mapping the proposed semantic roles

The task's 18 role labels are proposals, not verified asset filenames. The current repository contains the actual filenames above. Names such as Sovereign Trophy, Voice Spectrum, Data Prism, Daily City and MVM Guide do not have exact-name counterparts in this 18-file set. Do not pretend those models exist or silently assign an unrelated prop to a gameplay mechanic. A role can be reassigned only after inspecting the actual mesh/contact sheet and documenting why it fits.

## Existing game-flow invariants

- The 34-ball catalog and owned-ball identity remain untouched.
- Inventory selection, battle-pool population, reroll, Confirm, round outcome and rematch continue to use their current handlers/state.
- Environment animation is presentation-only and is never read by deterministic combat.
- Props have no authoritative physics collider in the duel simulation.
- Asset loading is quality-tiered and serial, reducing simultaneous mobile decode pressure.
- A missing optional GLB remains a logged environment-load failure; it must not block a battle or mutate match state.

## Current limitations / next integration boundary

The current 18 assets improve the free-roam environment and game identity; they are not all interactive battle mechanics. That is the honest architecture fit today. To make any prop a real hazard, objective, collectible or collision obstacle later, first add it to the authoritative simulation and collision rules with deterministic tests, then synchronize its visual transform. Do not bolt physics onto the renderer alone.
