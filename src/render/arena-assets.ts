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
  readonly motion: "showcase" | "spin" | "static";
  readonly spinSpeed?: number;
};

/**
 * Curated MVM world layout. These are full-size world landmarks, not inventory cards.
 * Keep the lobby readable around the spawn and reserve the larger perimeter kit for combat.
 */
export const MVM_ENVIRONMENT_ASSETS = [
  // LOBBY: one obvious spawn landmark, one gateway, and a balanced set of side landmarks.
  {
    id: "Spawn_Beacon_Platform",
    file: "Spawn_Beacon_Platform.glb",
    zone: "lobby",
    minQuality: "low",
    targetExtent: 8.5,
    position: [0, -0.02, -1.8],
    rotationY: 0,
    motion: "static",
  },
  {
    id: "Rift_Gate_Arch",
    file: "Rift_Gate_Arch.glb",
    zone: "lobby",
    minQuality: "low",
    targetExtent: 7.2,
    position: [0, 0, -8.8],
    rotationY: 0,
    motion: "static",
  },
  {
    id: "Obsidian_Spire",
    file: "Obsidian_Spire.glb",
    zone: "lobby",
    minQuality: "low",
    targetExtent: 5.8,
    position: [-8.2, 0, 0.2],
    rotationY: 0.28,
    motion: "showcase",
  },
  {
    id: "Broken_Portal_Fragments",
    file: "Broken_Portal_Fragments.glb",
    zone: "arena",
    minQuality: "low",
    targetExtent: 5.2,
    position: [0, -0.02, -12.8],
    rotationY: 0,
    motion: "static",
  },
  {
    id: "Graviton_Obelisk",
    file: "Graviton_Obelisk.glb",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 5.4,
    position: [8.2, 0, 0.2],
    rotationY: -0.18,
    motion: "showcase",
  },
  {
    id: "Citadel_Arena_Platform",
    file: "Citadel_Arena_Platform.glb",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 5.8,
    position: [7.2, -0.02, -7.3],
    rotationY: -0.36,
    motion: "static",
  },
  {
    id: "Skyline_Outpost",
    file: "Skyline_Outpost.glb",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 5.8,
    position: [-7.2, -0.02, -7.3],
    rotationY: 0.42,
    motion: "static",
  },
  {
    id: "Eclipse_Ring_Arena",
    file: "Eclipse_Ring_Arena.glb",
    zone: "arena",
    minQuality: "medium",
    targetExtent: 18,
    position: [0, -0.05, 0],
    rotationY: 0,
    motion: "static",
  },
  {
    id: "Triad_Relay_Beacons",
    file: "Triad_Relay_Beacons.glb",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 3.6,
    position: [-5.4, 0, 5.3],
    rotationY: 0.1,
    motion: "showcase",
  },
  {
    id: "MVM_Boppo_Mascot",
    file: "MVM_Boppo_Mascot.glb",
    zone: "lobby",
    minQuality: "medium",
    targetExtent: 3.1,
    position: [5.4, 0, 5.3],
    rotationY: -0.7,
    motion: "showcase",
  },

  // ARENA: large perimeter silhouettes frame the fight; they are not scattered through the play lane.
  {
    id: "Signal_Display_Totem",
    file: "Signal_Display_Totem.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 4.6,
    position: [-13.2, 0, -8.2],
    rotationY: Math.PI / 2,
    motion: "showcase",
  },
  {
    id: "Rift_Rail_Bridge",
    file: "Rift_Rail_Bridge.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 11.5,
    position: [0, 0.1, 13.4],
    rotationY: 0,
    motion: "static",
  },
  {
    id: "Orbit_Cage_Reactor",
    file: "Orbit_Cage_Reactor.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 5.0,
    position: [13.2, 0, -8.2],
    rotationY: 0.2,
    motion: "showcase",
  },
  {
    id: "Voidstone_Meteor",
    file: "Voidstone_Meteor.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 4.2,
    position: [13.2, 0, 7.5],
    rotationY: -0.2,
    motion: "spin",
    spinSpeed: 0.035,
  },
  {
    id: "Titan_Gate_Frame",
    file: "Titan_Gate_Frame.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 7.0,
    position: [0, 0, -13.5],
    rotationY: Math.PI,
    motion: "static",
  },
  {
    id: "Magma_Reactor_Tower",
    file: "Magma_Reactor_Tower.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 4.6,
    position: [-13.2, 0, 7.5],
    rotationY: 0.4,
    motion: "showcase",
  },
  {
    id: "Cyclone_Engine",
    file: "Cyclone_Engine.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 4.6,
    position: [13.2, 0, 0],
    rotationY: 0.18,
    motion: "showcase",
  },
  {
    id: "Rift_Relic_Shard",
    file: "Rift_Relic_Shard.glb",
    zone: "arena",
    minQuality: "high",
    targetExtent: 3.4,
    position: [-13.2, 0, 0],
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
