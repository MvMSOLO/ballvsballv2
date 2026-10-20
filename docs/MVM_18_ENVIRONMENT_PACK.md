# MVM 18-model environment pack

This pack contains world scenery and landmarks for BALL ARENA. It is not a ball inventory and should not be passed through the combat pack registry.

## Install the provided ZIP

From the repository root, place `MVM_18_3D_Asset_Pack.zip` in the workspace and run:

```bash
npm run assets:mvm:install -- ./MVM_18_3D_Asset_Pack.zip
```

Or pass an absolute path as the final argument:

```bash
npm run assets:mvm:install -- /path/to/MVM_18_3D_Asset_Pack.zip
```

The installer reads the canonical 18 filenames from `src/render/arena-assets.ts`, locates each matching entry under the archive’s `models/` folder, validates every GLB header/version/declared length, and only after all 18 pass copies them to `public/assets/arena/`. It does not copy `original_sources.zip`, standalone texture PNGs, previews, or unrelated archive content. Re-running the command replaces matching asset files without deleting other files in the target directory.

## Scene plan

| Graphics tier | Models loaded | Intended use |
|---|---:|---|
| Low | 4 | Core lobby landmarks and one arena silhouette |
| Medium | 10 | Lobby scene plus extra landmarks |
| High | 18 | Full lobby and arena perimeter set dressing |

Models are normalized from their measured GLB bounds and placed in either the lobby or arena scene. Embedded PBR materials are preserved. Meshopt decoding is enabled for `MVM_Boppo_Mascot.glb`. The assets’ `Idle_Showcase_Loop` clips are slow hover/turn showcases, not walk/run/combat animations; large scenery uses subtle parent rotation instead of exaggerating that clip. Motion is presentation-only and does not affect combat simulation.

## Validation before merge

```bash
npm run assets:mvm:install -- ./MVM_18_3D_Asset_Pack.zip
npm run typecheck
npm run test:arena
npm run build:dev
```

The renderer intentionally leaves the existing environment unchanged if `public/assets/arena/Spawn_Beacon_Platform.glb` is missing. The feature is not considered asset-complete until the 18 original GLBs are present in that directory and visually checked on a phone-sized viewport and a desktop viewport.