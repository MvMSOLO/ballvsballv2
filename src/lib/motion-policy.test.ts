import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveImpactMotion, shouldReduceMotion } from "./motion-policy.ts";

describe("resolveImpactMotion", () => {
  it("makes strong hits more noticeable than light hits", () => {
    const light = resolveImpactMotion(2, false);
    const heavy = resolveImpactMotion(14, false);
    assert.ok(heavy.scale > light.scale);
    assert.ok(heavy.duration > light.duration);
    assert.ok(heavy.shake > light.shake);
    assert.ok(heavy.particles > light.particles);
  });

  it("preserves a brief hit cue without shake or particles in reduced-motion mode", () => {
    const reduced = resolveImpactMotion(14, true);
    assert.ok(reduced.scale > 0);
    assert.ok(reduced.duration > 0 && reduced.duration < 0.5);
    assert.equal(reduced.shake, 0);
    assert.equal(reduced.particles, 0);
  });

  it("clamps invalid and out-of-range hit magnitude", () => {
    assert.deepEqual(resolveImpactMotion(-100, false), resolveImpactMotion(0, false));
    assert.deepEqual(resolveImpactMotion(Number.NaN, false), resolveImpactMotion(0, false));
    assert.deepEqual(resolveImpactMotion(999, false), resolveImpactMotion(16, false));
  });
});

describe("shouldReduceMotion", () => {
  it("activates when either saved or operating-system preference requests it", () => {
    assert.equal(shouldReduceMotion(false, false), false);
    assert.equal(shouldReduceMotion(true, false), true);
    assert.equal(shouldReduceMotion(false, true), true);
    assert.equal(shouldReduceMotion(true, true), true);
  });
});
