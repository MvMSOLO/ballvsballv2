import { describe, expect, it } from "vitest";
import { clampRiftPosition, RIFT_WALKABLE_RADIUS } from "../src/lib/rift-map";

describe("Rift Expanse walkable boundary", () => {
  it("keeps interior movement unchanged", () => {
    expect(clampRiftPosition(6, -8)).toEqual({ x: 6, z: -8 });
    expect(Math.hypot(6, -8)).toBeLessThan(RIFT_WALKABLE_RADIUS);
  });

  it("clamps diagonal movement to the circular floor instead of a square corner", () => {
    const position = clampRiftPosition(18.6, 18.6);
    expect(Math.hypot(position.x, position.z)).toBeCloseTo(RIFT_WALKABLE_RADIUS, 8);
    expect(Math.abs(position.x)).toBeLessThan(18.6);
    expect(Math.abs(position.z)).toBeLessThan(18.6);
  });

  it("preserves the Titan Gate route within the walkable radius", () => {
    const position = clampRiftPosition(0, -17);
    expect(position).toEqual({ x: 0, z: -17 });
    expect(Math.hypot(position.x, position.z)).toBeLessThanOrEqual(RIFT_WALKABLE_RADIUS);
  });

  it("recovers safely from invalid coordinate input", () => {
    expect(clampRiftPosition(Number.NaN, 2)).toEqual({ x: 0, z: 0 });
    expect(clampRiftPosition(3, Number.POSITIVE_INFINITY)).toEqual({ x: 0, z: 0 });
  });
});
