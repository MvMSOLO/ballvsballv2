/**
 * Free-roam boundary for the octagonal Rift Expanse floor.
 * The floor radius is 22 world units; keep the player inside its 18.35-unit
 * walkable radius so they cannot leave the platform at diagonal corners or
 * cross the outer perimeter ring.
 */
export const RIFT_WALKABLE_RADIUS = 18.35;

export function clampRiftPosition(x: number, z: number): { x: number; z: number } {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { x: 0, z: 0 };
  const distance = Math.hypot(x, z);
  if (distance <= RIFT_WALKABLE_RADIUS || distance === 0) return { x, z };
  const scale = RIFT_WALKABLE_RADIUS / distance;
  return { x: x * scale, z: z * scale };
}
