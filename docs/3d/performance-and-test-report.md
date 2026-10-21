# MVM 18-asset performance and test report

## Loading / memory controls already present

- Asset loading uses the existing Three.js GLTFLoader and MeshoptDecoder; no new renderer or physics dependency is introduced.
- GLBs load serially to avoid decoding all texture-heavy models simultaneously on mobile.
- Low quality loads 6 core landmarks, Medium loads 12, and High loads all 18.
- Models are normalized from measured transformed bounds to individual target extents, with per-asset positions and yaw.
- Model motion is presentation-only and stops when the owning zone is hidden; reduced-motion mode suppresses it.
- Asset disposal traverses and releases geometries, materials and textures when the quality tier releases a model or the renderer is destroyed.
- Existing GLB embedded images and material maps are retained. Per-asset PBR profiles change material factors, not texture image dimensions or UVs.

## Automated checks

Existing tests/arena-assets.test.ts checks 18 unique registered paths/IDs, tier counts, distinct world zones, unique positions, scale ranges, file presence and GLB v2 structural headers. The updated tests additionally check the 18 distinct tint identities, PBR value ranges and distinct material profiles.

The new npm run assets:mvm:audit script inspects actual checked-out GLB JSON/BIN chunks and writes docs/3d/asset-inventory.md. It reports node/mesh/primitive/accessor/material/texture counts, UV0-bearing primitives, accessor-space bounds, image references and sizes, inspectable PNG dimensions, root transforms and animation clip names. Missing registered GLBs or missing referenced external images fail the audit.

## Results that are and are not verified in this change

- Repository tree confirms all 18 registered GLBs and the existing contact sheet are committed under public/assets/arena/.
- Source installer requires GLB v2, a PBR metallic/roughness material, embedded images and the Idle_Showcase_Loop clip for every installed model.
- This remote editing session could not run repository npm scripts or visually inspect the deployed WebGL renderer. Therefore no build, typecheck, browser render, frame-time, decoded-GPU-memory or visual seam claim is made here.
- The audit script is committed for repeatable binary inspection. Its generated metrics should be produced in a repository checkout/CI run before calling the forensic inventory fully measured.
- Existing deterministic fight physics and match lifecycle remain unchanged; the 18 scenery assets do not affect combat outcomes.

## Manual visual acceptance checklist

- [ ] Compare each GLB with the existing contact sheet and rendered model lab.
- [ ] Inspect UV seams, base-color fidelity, metallic/roughness channel interpretation, normal orientation, transparency and emissive intensity.
- [ ] Check floor contact, transformed bounds, camera framing and occlusion at desktop and mobile sizes.
- [ ] Check Low / Medium / High quality transitions while loading and while changing lobby/Rift scenes.
- [ ] Verify no duplicate model instance, stale animation, unhandled load error or texture leak after rematch/scene changes.
- [ ] Run typecheck, arena tests, production build and desktop/mobile browser smoke tests before merging.
