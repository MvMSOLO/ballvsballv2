# Material and texture specification — MVM 18 GLBs

## Source assets

The 18 GLBs already exist under public/assets/arena/. The asset installer validates GLB v2 structure, at least one metallic/roughness PBR material, embedded image texture data and the Idle_Showcase_Loop animation clip before installation. Separate *_BaseColor.png and *_MetalRough.png files are also present for the 17 environment props with those sidecar names; MVM_Boppo_Mascot is the special mascot source and must be audited independently rather than assuming it has the same sidecar layout.

No source GLB geometry, UVs, texture image bytes or animation clips are rewritten by this change. The runtime uses a per-asset PBR profile while retaining the source material maps.

## Runtime treatment

Each registry item defines a unique tint, roughness, metalness, environment reflection intensity and optional emissive color/intensity. At load time the renderer applies these values once per unique material instance. The base-color tint multiplies the existing material color factor, so the original base-color map remains connected. Existing metallic-roughness, normal, occlusion and emissive maps are not removed. Existing emissive values are left intact when the profile does not request an emissive treatment.

| Asset | Art direction | Runtime treatment |
|---|---|---|
| Spawn Beacon Platform | Cool titanium arrival deck | Pale blue-grey tint; medium-smooth metal; restrained blue emissive |
| Rift Gate Arch | Violet-black alloy gateway | Blue-lavender tint; smooth metal; violet channel |
| Obsidian Spire | Dark stone / gunmetal silhouette | Muted violet-grey; rougher surface; low emissive |
| Skyline Outpost | Glass/concrete architecture | Cool grey; moderate roughness; low metalness |
| Triad Relay Beacons | Optical beacon assembly | Pale cyan; low roughness; cyan emissive |
| MVM Boppo Mascot | Original mascot materials remain dominant | White multiplier; low metalness; no new emissive |
| Eclipse Ring Arena | Machined obsidian arena centerpiece | Lavender-grey; metallic surface; controlled violet emissive |
| Titan Gate Frame | Monumental polished gate | Pale silver-lavender; high metalness; restrained violet emissive |
| Broken Portal Fragments | Damaged stone / alloy debris | Muted lavender; high roughness; low metalness |
| Rift Rail Bridge | Graphite rail and titanium | Blue-grey; medium roughness; high metalness |
| Citadel Arena Platform | Layered arena architecture | Pale violet; medium-low roughness; high metalness |
| Graviton Obelisk | Crystalline indigo landmark | Cool blue tint; low roughness; moderate metalness; blue emissive |
| Signal Display Totem | Cyan signal hardware | Pale cyan; smooth metal; cyan emissive |
| Orbit Cage Reactor | Precision reactor cage | Cool steel; smooth high-metalness surface; teal emissive |
| Voidstone Meteor | Natural dark stone | Desaturated mauve; very rough; low metalness |
| Magma Reactor Tower | Hot industrial reactor | Warm stone/steel tint; orange-red emissive |
| Cyclone Engine | Brushed precision machinery | Silver-grey; smooth high-metalness surface; restrained amber accent |
| Rift Relic Shard | Violet crystalline relic | Lavender; smooth material; violet emissive |

## Important accuracy note

This is runtime PBR tuning, not a claim that 18 new texture image files or normal maps were authored. The implementation intentionally avoids overwriting UVs or baking lighting into BaseColor. A real texture repaint, UV repair or exported GLB replacement should be a separate asset-editing pass using a GLB-capable DCC pipeline, followed by inspection in the production renderer. Do not report newly authored normal/AO maps unless they actually exist in the GLB and are listed by the binary audit.

## Verification

Run npm run assets:mvm:audit to generate the per-file inventory including source material texture slots, UV0 coverage, animation names, root transforms, POSITION accessor bounds and image memory estimates. The audit deliberately labels source-space bounds as such; runtime scaling is based on transformed Three.js bounds.
