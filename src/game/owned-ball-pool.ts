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

  // Keep every resolvable owned ball, then append only the minimum fallback set
  // needed to keep the draft playable. Never replace a valid owned ball with a starter.
  const combined = owned.slice();
  const included = new Set(combined.map((ball) => ball.id));
  const appendMissing = (balls: readonly BallDef[]) => {
    for (const ball of balls) {
      if (included.has(ball.id)) continue;
      included.add(ball.id);
      combined.push(ball);
    }
  };
  appendMissing(resolveUnique(starterIds));
  if (combined.length < 2) appendMissing(fallbackPool);
  return combined;
}
