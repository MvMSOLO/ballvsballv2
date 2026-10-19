# BALL ARENA — 34 individual visual identities

This pass covers **34 built-in balls**: 16 Core, 9 Nexus and 9 Singularity. Each ball has an original silhouette, surface motif, palette, material response, glow level, trail and particle family. Names and descriptions are localized in English, Uzbek and Russian. The 3D shell is decorative and the collision body remains predictable; this pass does not rebalance stats or abilities.

## Core pack — 16 identities

| ID / display name | Silhouette & material | Surface identity | Distinguishing read |
|---|---|---|---|
| aegis_lump — Aegis Bulwark | Hexagonal glacial shield-core | armor panels and cyan rivets | Beveled layered shield rather than a generic tank sphere. |
| boom_pebble — Fusecore Pebble | Soot-black bomb meteor | fuse marks and glowing orange faults | Chipped fins and ember seams communicate stored blast. |
| coil_ram — Helix Ram | Brass drive-gear and ram hub | winding induction rings | Ten gear lugs, central hub and exposed coils communicate a wind-up slam. |
| crimson_leech — Crimson Leech | Soft parasite with feeding tendrils | branching red veins | Sucker-mouth and three curling tendrils make its sustain role organic. |
| glass_hail — Glass Hail | Floating ice-shard cluster | triangular facets | Separate crystal shards, not a single jewel orb. |
| halo_blades — Halo Blades | Ivory nucleus with gold blade corona | solar rays | Six bladelets create a radial silhouette before orbit effects trigger. |
| hook_comet — Hook Comet | Blue-violet comet with hook fin | gravity spiral | Long ion tail and forward hook imply pulling a rival off-line. |
| jolt_mite — Jolt Mite | Six-legged voltage insect | jagged lightning seams | Segmented body and twin antennae identify a stun creature. |
| last_knife — Last Knife | Compact black-steel dagger | blade scuff marks | Silver bevel, grip and pointed blade convey a ranged finisher. |
| lucky_die — Lucky Die | Chamfered pearl-white cube | contrasting checker pips | Raised pips and cubic corners are unmistakably dice-like. |
| magma_pocket — Magma Pocket | Fractured basalt heart | molten fissures | Cooled dark crust around an orange hot core. |
| prism_lancer — Prism Lancer | Elongated cyan lance-crystal | prismatic lattice | Forward tip and precision rings suggest a focused beam. |
| ribbon_serpent — Ribbon Serpent | Serpentine core with segmented ribbon | scale arcs | Curling body and scale plating separate it from other orbiters. |
| sprout_turret — Sprout Turret | Bio-mechanical seed pod with leaves | growth rings | Five leaves plus turret hardware create a plant-machine hybrid. |
| swarm_king — Swarm King | Violet brood-core with thorn crown | honeycomb cells | Hex plates, spikes and brood nodes suggest a splitting hive. |
| web_weaver — Web Weaver | Pearl trap-core inside angular cage | web lattice | Tensioned filaments visualize its wall-trap/control fantasy. |

## Nexus pack — 9 identities

| ID / display name | Silhouette & material | Surface identity | Distinguishing read |
|---|---|---|---|
| chatgpt_celestial_undertaker — Celestial Undertaker | Violet funerary reliquary with gold ribs | celestial runes | Halo latch and sentinel sockets make it a guardian vessel. |
| chatgpt_cobalt_mandolin — Cobalt Mandolin | Blue enamel mandolin body and fret-neck | sound waves | Four luminous strings directly sell the seeking-note concept. |
| chatgpt_echo_mason — Echo Mason | Slate monolith built from stone blocks | masonry seams | Offset blocks make a persistent impact bruiser feel constructed. |
| chatgpt_ember_ledger — Ember Ledger | Scorched field ledger with brass corners | tally lines | Ember spine and ruled lines feel like a book of counted fires. |
| chatgpt_gale_ambusher — Gale Ambusher | Three-fin jade windblade | pressure-stream sweeps | Asymmetric swept fins read as a fast phase/ambush fighter. |
| chatgpt_mistral_shell — Mistral Shell | Nacre-blue aerodynamic shell | spiral shell ribs | Raised ridges and a split lip imply a light protective carapace. |
| chatgpt_quartz_mender — Quartz Mender | Rose-quartz repair crystal cluster | quartz facets | One central gem and five shardlets evoke repair and shielding. |
| chatgpt_storm_abacus — Storm Abacus | Floating indigo abacus-disc | charged beads and bars | Three counting rails and six beads visualize chained lightning. |
| chatgpt_void_covenant — Void Covenant | Near-black singularity with three crown horns | eclipse bands | Offset violet eclipse rings differentiate it from Crown of Zero. |

## Singularity pack — 9 identities

| ID / display name | Silhouette & material | Surface identity | Distinguishing read |
|---|---|---|---|
| chatgpt_comet_kettle — Comet Kettle | Copper kettle-comet with handle and spout | orbit map | Literal kettle hardware fused with a comet tail; concept reads without a label. |
| chatgpt_crown_of_zero — Crown of Zero | Black singularity with three-tier crown | event-horizon rings | Nested vortex rings and floating shards create its mythic control identity. |
| chatgpt_ember_cartographer — Ember Cartographer | Flattened brass/ember atlas-disc | topographic contours | Route tracer and map coordinates sell the burning-route trap concept. |
| chatgpt_gravity_plum — Gravity Plum | Deep-violet plum with curled stem | satin skin speckles | Fruit-shaped tear-drop and tilted pull ring separate it from void designs. |
| chatgpt_iron_orchid — Iron Orchid | Five forged-metal orchid petals | gold petal veins | Floral anatomy fused with heavy plated armor. |
| chatgpt_mirror_mint — Mirror Mint | Mint mirror-prism with silver bevels | reflective facets | Polished planes and cyan edge glints communicate decoy/evasion. |
| chatgpt_rift_moth — Rift Moth | Wide-winged translucent violet moth | moon-scale wing texture | Twin antennae and membranes create a clear insect profile. |
| chatgpt_sonar_relic — Sonar Relic | Thick blue signal disc with radial slots | concentric sonar rings | Layered pulse rails visualize sonar and echo attacks. |
| chatgpt_thunder_cathedral — Thunder Cathedral | Miniature cathedral with three spires | architectural arch seams | Nave, buttresses and windows read as a storm-temple, not a faceted ball. |

## Design contract

- All 34 built-ins have different shape values and different pattern values.
- JSON remains the content source of truth for names, translations, descriptions, colors, emissive values, particle family and trails.
- 3D and battle-card SVG previews use authored silhouettes and pattern motifs, not a list of ID-only sphere patches.
- Stats, rarity, ability DSL, save IDs and collision mathematics are unchanged.
- Shared low-resolution micro-surface maps remain reused across models to control GPU memory.

CI regression coverage asserts all 34 definitions load, shapes and patterns are unique, translations remain present, and visual color values are valid. Automated CI does not replace manual device/visual FPS checks.
