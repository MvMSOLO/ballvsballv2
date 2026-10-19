import type { BallDef } from "@/sim/types";

/**
 * Build the human draft pool from saved ownership, not from the fixed starter list.
 * A starter fallback keeps corrupted/legacy saves playable without discarding valid inventories.
 */
export function buildOwnedBallPool(
  ownedIds: readonly string[],
  catalog: readonly BallDef[],
  starterIds: readonly string[],
  fallbackPool: readonly BallDef[],
): BallDef[] {
  const byId = new Map(catalog.map((ball) => [ball.id, ball]));
  const resolveUnique = (ids: readonly string[]): BallDef[] => {
    const seen = new Set<string>();
    const out: BallDef[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const ball = byId.get(id);
      if (ball) out.push(ball);
    }
    return out;
  };

  const owned = resolveUnique(ownedIds);
  if (owned.length >= 2) return owned;

  const starters = resolveUnique(starterIds);
  return starters.length >= 2 ? starters : [...fallbackPool];
}
