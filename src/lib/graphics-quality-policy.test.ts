import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAdaptiveQualityState, stepAdaptiveQuality, type RenderQuality } from "./graphics-quality-policy.ts";

function advance(
  quality: RenderQuality,
  frameMs: number,
  count: number,
  elapsedMs = 50,
  initial = createAdaptiveQualityState(),
): { quality: RenderQuality; state: ReturnType<typeof createAdaptiveQualityState> } {
  let state = initial;
  let current = quality;
  for (let i = 0; i < count; i++) {
    const step = stepAdaptiveQuality(current, frameMs, elapsedMs, state);
    current = step.quality;
    state = step.state;
    if (step.changed) break;
  }
  return { quality: current, state };
}

describe("adaptive graphics quality policy", () => {
  it("downgrades High only after sustained overloaded frame times", () => {
    assert.equal(advance("high", 30, 27).quality, "high");
    assert.equal(advance("high", 30, 28).quality, "medium");
  });

  it("moves Medium to Low only after its stricter sustained overload window", () => {
    assert.equal(advance("medium", 35, 23).quality, "medium");
    assert.equal(advance("medium", 35, 24).quality, "low");
  });

  it("recovers from Low only after sustained healthy rendering", () => {
    assert.equal(advance("low", 18, 159).quality, "low");
    assert.equal(advance("low", 18, 160).quality, "medium");
  });

  it("promotes Medium to High only after a longer stable window", () => {
    assert.equal(advance("medium", 15, 199).quality, "medium");
    assert.equal(advance("medium", 15, 200).quality, "high");
  });

  it("resets the overload streak after a recovered frame", () => {
    let state = createAdaptiveQualityState();
    for (let i = 0; i < 20; i++) state = stepAdaptiveQuality("high", 30, 50, state).state;
    state = stepAdaptiveQuality("high", 16, 50, state).state;
    const afterAnotherSecond = advance("high", 30, 20, 50, state);
    assert.equal(afterAnotherSecond.quality, "high");
  });

  it("uses a cooldown after quality changes to prevent immediate oscillation", () => {
    const down = advance("high", 30, 28);
    assert.equal(down.quality, "medium");
    const immediate = stepAdaptiveQuality(down.quality, 45, 50, down.state);
    assert.equal(immediate.quality, "medium");
    assert.equal(immediate.state.cooldownMs, 3950);
  });

  it("bounds a large tab-resume delta to a single small sample", () => {
    const oneResume = stepAdaptiveQuality("high", 40, 30_000, createAdaptiveQualityState());
    assert.equal(oneResume.quality, "high");
    assert.equal(oneResume.state.overloadedMs, 50);
  });

  it("ignores invalid frame samples instead of treating them as an instant performance failure", () => {
    const step = stepAdaptiveQuality("high", Number.NaN, 50, createAdaptiveQualityState());
    assert.equal(step.quality, "high");
    assert.equal(step.state.overloadedMs, 0);
    assert.equal(step.state.stableMs, 0);
  });
});
