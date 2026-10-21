# MVM 18-asset GLB inventory

The repository has 18 registered GLBs in public/assets/arena/, plus the contact sheet MVM_18_Asset_Contact_Sheet.png. The runtime catalog is src/render/arena-assets.ts. All GLB filenames and the currently assigned zone, target extent and position are listed below.

**Forensic status:** the repository contains the files and the existing installer requires GLB v2, PBR metallic/roughness materials, embedded images and the Idle_Showcase_Loop clip. Exact mesh/material/texture/UV/animation counts and geometry bounds have not been independently measured in this editing session. Run npm run assets:mvm:audit in a checkout to replace this page with generated per-file binary metrics. This document intentionally does not invent geometry measurements.

| GLB | Zone | Target extent | Position | Purpose |
|---|---|---:|---|---|
| Spawn_Beacon_Platform.glb | lobby | 8.8 | [0, 0.02, 0] | Arrival deck / spawn landmark |
| Rift_Gate_Arch.glb | lobby | 7.4 | [0, 0, -12.9] | Rift Expanse gateway landmark |
| Obsidian_Spire.glb | lobby | 6.2 | [-9.1, 0, 0.8] | West skyline landmark |
| Skyline_Outpost.glb | lobby | 5.8 | [8.7, -0.02, -7.2] | Plaza architecture |
| Triad_Relay_Beacons.glb | lobby | 3.5 | [-5.7, 0, 8.5] | Arrival / route marker |
| MVM_Boppo_Mascot.glb | lobby | 3.2 | [5.6, 0, 8.4] | MVM mascot point of interest |
| Eclipse_Ring_Arena.glb | rift | 17.5 | [0, 0.02, -1.8] | Central Rift ring landmark |
| Titan_Gate_Frame.glb | rift | 7.8 | [0, 0, -18.2] | Far gate / visual destination |
| Broken_Portal_Fragments.glb | rift | 4.6 | [0, 0.02, -11.1] | Fractured portal landmark |
| Rift_Rail_Bridge.glb | rift | 10.5 | [0, 0.02, 12.8] | South crossing / route cue |
| Citadel_Arena_Platform.glb | rift | 7.4 | [-7.6, 0.02, 2.7] | Side platform landmark |
| Graviton_Obelisk.glb | rift | 5.3 | [7.6, 0, -4.5] | Crystalline orientation landmark |
| Signal_Display_Totem.glb | rift | 4.0 | [-14.4, 0, -6.4] | Perimeter signpost |
| Orbit_Cage_Reactor.glb | rift | 4.8 | [14.3, 0, -5.7] | East reactor landmark |
| Voidstone_Meteor.glb | rift | 4.0 | [14.1, 0, 8.4] | South-east meteor landmark |
| Magma_Reactor_Tower.glb | rift | 4.5 | [-14.1, 0, 8.2] | South-west reactor landmark |
| Cyclone_Engine.glb | rift | 4.4 | [14.2, 0, 1.0] | Turbine-like perimeter installation |
| Rift_Relic_Shard.glb | rift | 3.35 | [-10.7, 0, 1.2] | Western relic landmark |

## Source files and texture references

The 17 environment-prop names other than the mascot have matching BaseColor and MetalRough PNG sidecars in the repository tree. The mascot must be treated separately because its texture layout differs. The GLBs are the runtime source of truth; the audit checks image references embedded or referenced by each GLB rather than assuming sidecar files are loaded independently.

The generated report includes GLB byte size, nodes, meshes, primitives, accessors, material slots, texture/image references, UV0 coverage, animation clip names, root transforms, accessor-space bounds and PNG memory estimates. Bounds are explicitly labeled as source mesh space; the renderer separately computes transformed bounds for runtime normalization.
