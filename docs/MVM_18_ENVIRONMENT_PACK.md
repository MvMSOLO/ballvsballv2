# MVM 18-model environment pack

This pack contains 18 world assets for BALL ARENA. These are world-scale landmarks and locations, not ball inventory models and must never be passed through the combat pack registry.

## Model inspection

Open `/mvm-model-lab` in a deployed preview to inspect the authored GLBs one at a time. The lab displays the actual model in a full-size Three.js viewport with orbit/zoom, measures the original bounds, counts meshes/vertices/materials/textures, and lists any authored animation clips. This is the review surface for checking every supplied asset before changing its role.

## Scene ownership

The registry `src/render/arena-assets.ts` is the source of truth for each model's filename, world zone, scale, placement, display name, and functional purpose.

### Social Lobby — 6 assets

| Model | Purpose |
|---|---|
| Spawn Beacon Platform | Main player arrival deck; replaces the duplicate procedural center podium |
| Rift Gate Arch | Visible entrance to the new Rift Expanse map |
| Obsidian Spire | West-side skyline landmark |
| Skyline Outpost | North/east plaza architecture to balance the skyline |
| Triad Relay Beacons | South-west event/route marker |
| MVM Boppo Mascot | Branded point of interest, separate from the controllable avatar |

### Rift Expanse — 12 assets

| Model | Purpose |
|---|---|
| Eclipse Ring Arena | Map's central ring and visual anchor |
| Titan Gate Frame | Far-end gate/landmark and return route |
| Broken Portal Fragments | Damaged portal cluster on the entry route |
| Rift Rail Bridge | South-side crossing that gives the map an identifiable route |
| Citadel Arena Platform | Raised western side platform |
| Graviton Obelisk | Tall crystalline landmark opposite the Citadel |
| Signal Display Totem | High-tier outer perimeter signpost for objective/round information |
| Orbit Cage Reactor | Eastern perimeter reactor |
| Voidstone Meteor | Natural, faceted south-east landmark |
| Magma Reactor Tower | Warm-toned reactor on the south-west perimeter |
| Cyclone Engine | Turbine-shaped perimeter installation; currently visual decoration, not a fabricated gameplay hazard |
| Rift Relic Shard | Relic cluster near the western approach |

The new map is its own Three.js scene group, with its own floor, inset, radial guide lines, landmark pads, perimeter pylons and distant starfield. The player is reparented between the Lobby and Rift Expanse during free-roam map changes. A duel still switches to the existing deterministic combat arena; this map integration does not turn scenery objects into physics hazards.

## Quality tiers

| Graphics tier | Models eligible to load | Intent |
|---|---:|---|
| Low | 6 | Lobby arrival/gateway plus minimum Rift map landmarks and central centerpiece |
| Medium | 12 | Add side architecture, bridge, event marker and obelisk |
| High | 18 | Complete the designed perimeter set dressing |

Models are normalized using their measured GLB bounds before the authored world extent is applied. Embedded PBR materials are preserved. Meshopt decoding is enabled for `MVM_Boppo_Mascot.glb`. The pack's `Idle_Showcase_Loop` clips are authored presentation loops, not walk/run/combat animations. Only assets explicitly marked `showcase` or `spin` move; scenery movement is presentation-only and does not affect deterministic combat simulation.

## Install or replace the authored pack

From the repository root, place `MVM_18_3D_Asset_Pack.zip` in the workspace and run:

```bash
npm run assets:mvm:install -- ./MVM_18_3D_Asset_Pack.zip
```

Or pass an absolute path:

```bash
npm run assets:mvm:install -- /path/to/MVM_18_3D_Asset_Pack.zip
```

The installer reads the canonical 18 filenames from `src/render/arena-assets.ts`, locates each matching entry under the archive's `models/` folder, validates the GLB header/version/declared length/materials/textures/expected showcase clip, and only after all 18 pass copies them to `public/assets/arena/`. It does not copy `original_sources.zip` or unrelated content. Existing authored assets are not deleted when the script is rerun.

## Validation before merge

```bash
npm run typecheck
npm run test:arena
npm run build:dev
npm run assets:mvm:install -- ./MVM_18_3D_Asset_Pack.zip
```

After those commands pass, inspect every GLB in `/mvm-model-lab`, then verify both maps at a phone-sized viewport and a desktop viewport. The map is not release-ready until CI passes and its scene composition and gate transitions are visually confirmed. The main branch remains unchanged until the draft pull request is reviewed and merged.
