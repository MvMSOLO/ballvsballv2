# MVM 18-asset GLB inventory

## Audit result

Measured by the repository's GLB binary audit in GitHub Actions on 2026-10-21: **18/18 assets passed**, **21.70 MiB total GLB payload**. The audit step completed successfully and verified the registered GLB v2 headers, asset JSON chunks, referenced external image availability, source mesh accessors, UV0 presence, materials, embedded image references, root transforms and animation names.

All 18 models currently report **one mesh, one primitive, one PBR material, one UV0-bearing primitive and the Idle_Showcase_Loop animation**. The 17 environment props each have two embedded texture images (base-color and metallic/roughness); MVM_Boppo_Mascot has three embedded images, including a normal map. The source model files are not re-exported by this integration.

**Bounds note:** dimensions in the table are aggregated from POSITION accessor min/max values in source mesh space. They do not include all node transforms and should not be interpreted as final world-space size. Runtime code measures each transformed THREE.Box3 and scales its longest axis to the configured target extent. All root motion-root transforms observed by the audit are translation [0,0,0], rotation [0,0,0,1], scale [1,1,1].

## Per-file geometry and PBR data

| GLB | Bytes | Nodes | Source bounds X × Y × Z | Embedded textures / images | UV0 | Animation | Source PBR slots |
|---|---:|---:|---|---|---|---|---|
| Spawn_Beacon_Platform.glb | 859,336 | 3 | 2.0000 × 0.1718 × 1.7321 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Rift_Gate_Arch.glb | 862,148 | 3 | 1.5861 × 2.0000 × 0.3251 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Obsidian_Spire.glb | 796,828 | 3 | 0.9681 × 2.0000 × 0.5617 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Skyline_Outpost.glb | 1,135,836 | 3 | 2.0000 × 0.4775 × 1.4644 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Triad_Relay_Beacons.glb | 991,516 | 3 | 2.0000 × 0.3588 × 0.6246 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| MVM_Boppo_Mascot.glb | 2,390,624 | 2 | 0.6113 × 1.0000 × 0.8065 | 3; Color 527,521 B, ORM 564,412 B, NormalGL 1,194,867 B (2048²) | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough/ORM 1, Normal 2; no separate AO/emissive slot |
| Eclipse_Ring_Arena.glb | 3,221,288 | 3 | 1.9927 × 0.3044 × 2.0000 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Titan_Gate_Frame.glb | 857,020 | 3 | 1.5890 × 2.0000 × 1.1138 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Broken_Portal_Fragments.glb | 817,980 | 3 | 2.0000 × 1.2717 × 0.4870 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Rift_Rail_Bridge.glb | 1,871,404 | 3 | 2.0000 × 0.6127 × 0.4663 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Citadel_Arena_Platform.glb | 1,244,168 | 3 | 2.0000 × 0.5898 × 2.0000 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Graviton_Obelisk.glb | 1,112,528 | 3 | 0.9066 × 2.0000 × 0.9066 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Signal_Display_Totem.glb | 1,130,344 | 3 | 1.9342 × 2.0000 × 0.7573 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Orbit_Cage_Reactor.glb | 1,182,356 | 3 | 1.9981 × 2.0000 × 1.5859 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Voidstone_Meteor.glb | 1,159,120 | 3 | 2.0000 × 1.7590 × 1.4551 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Magma_Reactor_Tower.glb | 851,932 | 3 | 2.0000 × 1.3417 × 2.0000 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Cyclone_Engine.glb | 1,471,904 | 3 | 1.9690 × 0.6618 × 2.0000 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |
| Rift_Relic_Shard.glb | 801,920 | 3 | 2.0000 × 1.4923 × 1.7321 | 2; 1024² BaseColor + 512² MetalRough | 1/1 | Idle_Showcase_Loop | BaseColor 0, MetalRough 1; no normal/AO/emissive map |

## Root transform, role and runtime destination

All assets have a root MotionRoot with identity transform in the source. No source pivot/orientation correction was needed for the root node itself; runtime code places a fit group around the measured transformed bounds, grounds it at the minimum Y, then applies the individually configured world position and yaw.

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

## PBR tuning

The source files are not re-exported. Each registry entry now has a unique runtime material profile. The renderer multiplies the original material color by an individual tint, then applies per-asset roughness, metalness, environment reflection intensity and optional emissive settings. Existing BaseColor and MetalRough maps remain connected. The Boppo GLB additionally retains its Normal map. This is a verified runtime material-factor treatment, not a claim that new texture image files or normal/AO maps were authored.

Run npm run assets:mvm:audit to regenerate this page from the checked-out GLB bytes. The CI job runs this audit on pull requests and fails if a registered model or a referenced external image is missing.
