import type { RenderQuality } from "@/lib/graphics-quality-policy";

export type EnvironmentZone = "lobby" | "arena";

export type EnvironmentAssetDefinition = {
  readonly id: string;
  readonly file: string;
  readonly zone: EnvironmentZone;
  readonly minQuality: RenderQuality;
  /** Longest visible bounding-box axis after normalization, in arena units. */
  readonly targetExtent: number;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  /** Showcase clips are used only when their scale won't exaggerate the authored hover. */
  readonly motion: "showcase" | "spin" | "static";
  readonly spinSpeed?: number;
};

/**
 * MVM's own GLB world kit. These are scenery/landmark assets, not combat balls.
 * Each file is independently lazy-loaded when the selected graphics tier allows it.
 * Put the matching GLBs in public/assets/arena/; the game keeps running without the pack.
 */
export const MVM_ENVIRONMENT_ASSETS = [
  {
    id: "Spawn_Beacon_Platform",
    file: "Spawn_Beacon_Platform.glb",
    zone: "lobby",
    minQuality: "low",
    targetExtent: 4.5,
    position: [0, -0.02, -4.4],
    rotationY: 0,
    motion: "static",
  },
  {
    id: "Rift_Gate_Arch",
    file: "Rift_Gate_Arch.glb",
    zone: "lobby",
    minQuality: "low",
    targetExtent: 4.0,
    position: [0, 0, -9.1],
    rotationY: 0,
    motion: "spin",
    spinSpeed: 0.035,
  },
  {
    id: "Obsidian_Spire",
    file: "Obsidian_Spire.glb",
    zone: "lobby",
    minQuality: "low",
    targetExtent: 3.15,
    position: [-8.4, 0, 3.8],
    rotationY: 0.28,
    motion: "showcase",
  },
  {
    id: "Broken_Portal_Fragments",
    file: "Broken_Portal_Fragments.glb",
    zone: "arena",
    minQuality: "low",
    targetExtent: 3.1,
    position: [0, -0.02, -13.1],
    rotationY: 0,
    motion: "showcase",
  },
  {
    id: "Graviton_Obelisk",
    file: "Graviton_Obelisk.glb",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 3.1,
    position: [8.35, 0, 3.4],
    rotationY: -0.18,
    motion: "showcase",
  },
  {
    id: "Citadel_Arena_Platform",
    file: "Citadel_Arena_Platform.glb",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 3.15,
    position: [7.8, 0, -5.6],
    rotationY: -0.36,
    motion: "spin",
    spinSpeed: 0.025,
  },
  {
    id: "Skyline_Outpost",
    file: "Skyline_Outpost.glb",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 3.2,
    position: [-7.6, 0, -5.6],
    rotationY: 0.42,
    motion: "spin",
    spinSpeed: -0.024,
  },
  {
    id: "Eclipse_Ring_Arena",
    file: "Eclipse_Ring_Arena.glb",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 5.4,
    position: [0, -0.05, 0],
    rotationY: 0,
    motion: "static",
  },
  {
    id: "Triad_Relay_Beacons",
    file: "Triad_Relay_Beacons.glb",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 2.1,
    position: [-7.6, 0, 5.6],
    rotationY: 0.1,
    motion: "showcase",
  },
  {
    id: "MVM_Boppo_Mascot",
    file: "MVM_Boppo_Mascot.glb",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 1.9,
    position: [5.9, 0, 6.5],
    rotationY: -0.7,
    motion: "showcase",
  },
  {
    id: "Signal_Display_Totem",
    file: "Signal_Display_Totem.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 2.8,
    position: [-13.05, 0, -7.9],
    rotationY: Math.PI / 2,
    motion: "showcase",
  },
  {
    id: "Rift_Rail_Bridge",
    file: "Rift_Rail_Bridge.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 8.2,
    position: [0, 0.1, 13.15],
    rotationY: 0,
    motion: "spin",
    spinSpeed: 0.012,
  },
  {
    id: "Orbit_Cage_Reactor",
    file: "Orbit_Cage_Reactor.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 2.9,
    position: [13.05, 0, -7.9],
    rotationY: 0.2,
    motion: "showcase",
  },
  {
    id: "Voidstone_Meteor",
    file: "Voidstone_Meteor.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 2.4,
    position: [13.05, 0, 7.4],
    rotationY: -0.2,
    motion: "spin",
    spinSpeed: 0.06,
  },
  {
    id: "Titan_Gate_Frame",
    file: "Titan_Gate_Frame.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 3.6,
    position: [0, 0, -13.45],
    rotationY: Math.PI,
    motion: "spin",
    spinSpeed: 0.018,
  },
  {
    id: "Magma_Reactor_Tower",
    file: "Magma_Reactor_Tower.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 2.6,
    position: [-13.05, 0, 7.6],
    rotationY: 0.4,
    motion: "showcase",
  },
  {
    id: "Cyclone_Engine",
    file: "Cyclone_Engine.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 2.6,
    position: [13.05, 0, 0],
    rotationY: 0.18,
    motion: "showcase",
  },
  {
    id: "Rift_Relic_Shard",
    file: "Rift_Relic_Shard.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 1.9,
    position: [-13.05, 0, 0],
    rotationY: -0.15,
    motion: "showcase",
  },
] as const satisfies readonly EnvironmentAssetDefinition[];

const QUALITY_RANK: Record<RenderQuality, number> = { low: 0, medium: 1, high: 2 };

/** Quality gates loading as well as drawing: low-end phones do not decode the full asset pack. */
export function getEnvironmentAssetsForQuality(quality: RenderQuality): readonly EnvironmentAssetDefinition[] {
  const rank = QUALITY_RANK[quality];
  return MVM_ENVIRONMENT_ASSETS.filter((asset) => QUALITY_RANK[asset.minQuality] <= rank);
}

export function getEnvironmentAssetUrl(file: string): string {
  return `/assets/arena/${file}`;
}
