import { describe, expect, it } from "vitest";
import type { BallDef } from "../src/sim/types";
import { buildOwnedBallPool } from "../src/game/owned-ball-pool";
import { advanceSession, applyCommand, createSession, publicView } from "../src/game/session";

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

  it("keeps the one valid owned ball and only appends starters needed for playability", () => {
    expect(buildOwnedBallPool(["owned-a", "missing-id"], catalog, ["starter-a", "starter-b"], catalog))
      .toEqual([ownedA, starterA, starterB]);
  });

  it("uses the full fallback catalog when starter definitions are unavailable", () => {
    expect(buildOwnedBallPool([], [ownedA, ownedB], ["missing-a"], [ownedA, ownedB]))
      .toEqual([ownedA, ownedB]);
  });

  it("rerolls offers from the full owned inventory pool, not just the starter set", () => {
    const ownedC = ball("owned-c");
    const ownedD = ball("owned-d");
    const fullCatalog = [...catalog, ownedC, ownedD];
    const playerPool = buildOwnedBallPool(
      ["owned-a", "owned-b", "owned-c", "owned-d"],
      fullCatalog,
      ["starter-a", "starter-b"],
      fullCatalog,
    );
    const s = createSession({
      seed: 123456,
      pool0: playerPool,
      pool1: [starterA, starterB],
      names: ["Player", "Rival"],
      diff: "normal",
      control: ["human", "human"],
    });

    // Step from intro into drafting. Both players are human-controlled so no bot
    // automation can confirm a pick while this test inspects and rerolls offers.
    advanceSession(s, s.cfg.introSeconds + 0.01);
    expect(s.flow).toBe("pick");
    expect(publicView(s).poolCount).toBe(4);
    expect(s.offers[0]).toHaveLength(3);
    expect(s.offers[0].every((id) => playerPool.some((ball) => ball.id === id))).toBe(true);
    expect(s.offers[0].some((id) => id.startsWith("starter-"))).toBe(false);

    const previousOffers = [...s.offers[0]].sort();
    expect(applyCommand(s, { t: "reroll", side: 0 })).toBeNull();
    expect(s.offers[0]).toHaveLength(3);
    expect(s.offers[0].every((id) => playerPool.some((ball) => ball.id === id))).toBe(true);
    expect(s.offers[0].some((id) => id.startsWith("starter-"))).toBe(false);
    expect([...s.offers[0]].sort()).not.toEqual(previousOffers);
  });
});
