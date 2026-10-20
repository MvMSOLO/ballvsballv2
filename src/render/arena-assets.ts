import type { RenderQuality } from "@/lib/graphics-quality-policy";

/** Where an authored MVM asset belongs in the world graph. */
export type EnvironmentZone = "lobby" | "arena" | "rift";

export type EnvironmentAssetDefinition = {
  readonly id: string;
  readonly file: string;
  readonly displayName: string;
  readonly zone: EnvironmentZone;
  readonly minQuality: RenderQuality;
  /** Longest visible bounding-box axis after normalization, in world units. */
  readonly targetExtent: number;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly motion: "showcase" | "spin" | "static";
  readonly spinSpeed?: number;
  /** The model's functional reason for existing in BALL ARENA. */
  readonly purpose: string;
  /** Player-facing map/system that owns this asset. */
  readonly feature: string;
};

/**
 * Model-by-model ownership map for the 18 original MVM GLBs.
 *
 * Six assets belong to the social Lobby; twelve create Rift Expanse, a new
 * explorable map built around Eclipse Ring Arena. Assets are world geometry,
 * not ball inventory entries or tiny UI thumbnails.
 */
export const MVM_ENVIRONMENT_ASSETS = [
  {
    id: "Spawn_Beacon_Platform",
    file: "Spawn_Beacon_Platform.glb",
    displayName: "Spawn Beacon Platform",
    zone: "lobby",
    minQuality: "low",
    targetExtent: 8.8,
    position: [0, 0.02, 0],
    rotationY: 0,
    motion: "static",
    purpose: "The main arrival deck where the player first appears. It replaces the generic small center podium.",
    feature: "Lobby · spawn landmark",
  },
  {
    id: "Rift_Gate_Arch",
    file: "Rift_Gate_Arch.glb",
    displayName: "Rift Gate Arch",
    zone: "lobby",
    minQuality: "low",
    targetExtent: 7.4,
    position: [0, 0, -12.9],
    rotationY: 0,
    motion: "static",
    purpose: "A recognizable gateway that visually announces the Rift Expanse expansion and anchors the map selector.",
    feature: "Lobby · expansion gateway",
  },
  {
    id: "Obsidian_Spire",
    file: "Obsidian_Spire.glb",
    displayName: "Obsidian Spire",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 6.2,
    position: [-9.1, 0, 0.8],
    rotationY: 0.28,
    motion: "static",
    purpose: "A tall silhouette landmark on the west side of the plaza, giving the lobby a clear skyline and orientation cue.",
    feature: "Lobby · skyline landmark",
  },
  {
    id: "Skyline_Outpost",
    file: "Skyline_Outpost.glb",
    displayName: "Skyline Outpost",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 5.8,
    position: [8.7, -0.02, -7.2],
    rotationY: 0.42,
    motion: "static",
    purpose: "A secondary built location on the east/north edge of the social plaza, balancing the Spire without blocking the spawn.",
    feature: "Lobby · plaza architecture",
  },
  {
    id: "Triad_Relay_Beacons",
    file: "Triad_Relay_Beacons.glb",
    displayName: "Triad Relay Beacons",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 3.5,
    position: [-5.7, 0, 8.5],
    rotationY: 0.1,
    motion: "showcase",
    purpose: "A three-beacon arrival marker and future hub for map/event announcements; placed near the south-west approach, not in the combat lane.",
    feature: "Lobby · event/route marker",
  },
  {
    id: "MVM_Boppo_Mascot",
    file: "MVM_Boppo_Mascot.glb",
    displayName: "MVM Boppo Mascot",
    zone: "lobby",
    minQuality: "low",
    targetExtent: 3.2,
    position: [5.6, 0, 8.4],
    rotationY: -0.7,
    motion: "showcase",
    purpose: "The branded lobby mascot: a friendly point of interest for the free-roam area, separate from the player's controllable avatar.",
    feature: "Lobby · MVM identity",
  },
  {
    id: "Eclipse_Ring_Arena",
    file: "Eclipse_Ring_Arena.glb",
    displayName: "Eclipse Ring Arena",
    zone: "rift",
    minQuality: "low",
    targetExtent: 17.5,
    position: [0, 0.02, -1.8],
    rotationY: 0,
    motion: "static",
    purpose: "The visual and spatial centerpiece of Rift Expanse: a large ring floor with radial spokes. It is a full map landmark, never a card-sized preview.",
    feature: "Rift Expanse · central ring",
  },
  {
    id: "Titan_Gate_Frame",
    file: "Titan_Gate_Frame.glb",
    displayName: "Titan Gate Frame",
    zone: "rift",
    minQuality: "low",
    targetExtent: 7.8,
    position: [0, 0, -18.2],
    rotationY: Math.PI,
    motion: "static",
    purpose: "A monumental far-end frame that gives the map a visual destination and frames the Eclipse Ring from the entry route.",
    feature: "Rift Expanse · far gate",
  },
  {
    id: "Broken_Portal_Fragments",
    file: "Broken_Portal_Fragments.glb",
    displayName: "Broken Portal Fragments",
    zone: "rift",
    minQuality: "low",
    targetExtent: 4.6,
    position: [0, 0.02, -11.1],
    rotationY: 0,
    motion: "static",
    purpose: "A damaged portal cluster between the gate and the ring, making the Rift feel like a world with history rather than a field of unrelated props.",
    feature: "Rift Expanse · fractured portal",
  },
  {
    id: "Rift_Rail_Bridge",
    file: "Rift_Rail_Bridge.glb",
    displayName: "Rift Rail Bridge",
    zone: "rift",
    minQuality: "medium",
    targetExtent: 10.5,
    position: [0, 0.02, 12.8],
    rotationY: 0,
    motion: "static",
    purpose: "A traversable-looking rail crossing on the south side of the ring, creating a readable route through the map rather than a random floating model.",
    feature: "Rift Expanse · crossing",
  },
  {
    id: "Citadel_Arena_Platform",
    file: "Citadel_Arena_Platform.glb",
    displayName: "Citadel Arena Platform",
    zone: "rift",
    minQuality: "medium",
    targetExtent: 7.4,
    position: [-7.6, 0.02, 2.7],
    rotationY: -0.36,
    motion: "static",
    purpose: "A raised side platform that creates a second focal point and gives the central ring a layered silhouette.",
    feature: "Rift Expanse · side platform",
  },
  {
    id: "Graviton_Obelisk",
    file: "Graviton_Obelisk.glb",
    displayName: "Graviton Obelisk",
    zone: "rift",
    minQuality: "medium",
    targetExtent: 5.3,
    position: [7.6, 0, -4.5],
    rotationY: -0.18,
    motion: "static",
    purpose: "A vertical crystalline landmark opposite the Citadel platform, balancing the composition and orienting players around the ring.",
    feature: "Rift Expanse · crystal landmark",
  },
  {
    id: "Signal_Display_Totem",
    file: "Signal_Display_Totem.glb",
    displayName: "Signal Display Totem",
    zone: "rift",
    minQuality: "high",
    targetExtent: 4.0,
    position: [-14.4, 0, -6.4],
    rotationY: Math.PI / 2,
    motion: "showcase",
    purpose: "A high-tier perimeter signpost for future map objectives/round information; it stays outside the central traversal lane.",
    feature: "Rift Expanse · perimeter display",
  },
  {
    id: "Orbit_Cage_Reactor",
    file: "Orbit_Cage_Reactor.glb",
    displayName: "Orbit Cage Reactor",
    zone: "rift",
    minQuality: "high",
    targetExtent: 4.8,
    position: [14.3, 0, -5.7],
    rotationY: 0.2,
    motion: "showcase",
    purpose: "A contained reactor silhouette on the east perimeter, paired visually with the Magma Reactor on the opposite side.",
    feature: "Rift Expanse · reactor landmark",
  },
  {
    id: "Voidstone_Meteor",
    file: "Voidstone_Meteor.glb",
    displayName: "Voidstone Meteor",
    zone: "rift",
    minQuality: "high",
    targetExtent: 4.0,
    position: [14.1, 0, 8.4],
    rotationY: -0.2,
    motion: "spin",
    spinSpeed: 0.026,
    purpose: "A large, irregular rock/meteor landmark on the south-east edge that adds a natural counter-shape to the mechanical structures.",
    feature: "Rift Expanse · meteor landmark",
  },
  {
    id: "Magma_Reactor_Tower",
    file: "Magma_Reactor_Tower.glb",
    displayName: "Magma Reactor Tower",
    zone: "rift",
    minQuality: "high",
    targetExtent: 4.5,
    position: [-14.1, 0, 8.2],
    rotationY: 0.4,
    motion: "showcase",
    purpose: "A warm-toned reactor tower on the south-west perimeter; its orange material is a deliberate color counterweight to blue/purple landmarks.",
    feature: "Rift Expanse · reactor landmark",
  },
  {
    id: "Cyclone_Engine",
    file: "Cyclone_Engine.glb",
    displayName: "Cyclone Engine",
    zone: "rift",
    minQuality: "high",
    targetExtent: 4.4,
    position: [14.2, 0, 1.0],
    rotationY: 0.18,
    motion: "showcase",
    purpose: "A turbine-like perimeter installation. Its current role is visual worldbuilding only; it is deliberately not presented as a working gameplay hazard yet.",
    feature: "Rift Expanse · engine landmark",
  },
  {
    id: "Rift_Relic_Shard",
    file: "Rift_Relic_Shard.glb",
    displayName: "Rift Relic Shard",
    zone: "rift",
    minQuality: "high",
    targetExtent: 3.35,
    position: [-10.7, 0, 1.2],
    rotationY: -0.15,
    motion: "showcase",
    purpose: "A smaller relic grouping near the western approach, visually linking the Citadel platform and obelisk field without blocking the ring.",
    feature: "Rift Expanse · relic point",
  },
] as const satisfies readonly EnvironmentAssetDefinition[];

const QUALITY_RANK: Record<RenderQuality, number> = { low: 0, medium: 1, high: 2 };

/**
 * Stable ordering lets Low render the indispensable landmarks in both maps;
 * Medium adds the side landmarks; High completes the perimeter dressing.
 */
export function getEnvironmentAssetsForQuality(quality: RenderQuality): readonly EnvironmentAssetDefinition[] {
  const rank = QUALITY_RANK[quality];
  return MVM_ENVIRONMENT_ASSETS.filter((asset) => QUALITY_RANK[asset.minQuality] <= rank);
}

export function getEnvironmentAssetUrl(file: string): string {
  return `/assets/arena/${file}`;
}
