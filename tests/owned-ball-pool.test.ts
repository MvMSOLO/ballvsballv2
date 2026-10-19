import { describe, expect, it } from "vitest";
import type { BallDef } from "@/sim/types";
import { buildOwnedBallPool } from "@/game/owned-ball-pool";

function ball(id: string): BallDef {
  return { id } as BallDef;
}

describe("buildOwnedBallPool", () => {
  const starterA = ball("starter-a");
  const starterB = ball("starter-b");
  const ownedA = ball("owned-a");
  const ownedB = ball("owned-b");
  const catalog = [starterA, starterB, ownedA, ownedB];

  it("uses every distinct owned ball instead of limiting rerolls to starters", () => {
    expect(
      buildOwnedBallPool(
        ["starter-a", "owned-a", "owned-b", "owned-a", "missing-id"],
        catalog,
        ["starter-a", "starter-b"],
        catalog,
      ),
    ).toEqual([starterA, ownedA, ownedB]);
  });

  it("falls back to starter balls only when fewer than two owned definitions resolve", () => {
    expect(buildOwnedBallPool(["owned-a", "missing-id"], catalog, ["starter-a", "starter-b"], catalog))
      .toEqual([starterA, starterB]);
  });

  it("keeps a playable fallback when starter definitions are unavailable", () => {
    expect(buildOwnedBallPool([], [ownedA], ["missing-a"], [ownedA])).toEqual([ownedA]);
  });
});
