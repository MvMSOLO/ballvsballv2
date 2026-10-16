import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  audioChannelForSound,
  clampAudioLevel,
  createSoundGate,
  normalizeAudioLevels,
  soundCooldownMs,
} from "./audio-policy.ts";

describe("audio mix policy", () => {
  it("clamps malformed levels and keeps every output within 0..1", () => {
    assert.equal(clampAudioLevel(-4), 0);
    assert.equal(clampAudioLevel(2), 1);
    assert.equal(clampAudioLevel(Number.NaN, 0.4), 0.4);
    assert.deepEqual(normalizeAudioLevels({ master: 2, music: -1, ui: Number.NaN, sfx: 0.35 }), {
      master: 1, music: 0, ui: 0.7, sfx: 0.35,
    });
  });

  it("separates interface feedback from gameplay effects", () => {
    assert.equal(audioChannelForSound("confirm"), "ui");
    assert.equal(audioChannelForSound("error"), "ui");
    assert.equal(audioChannelForSound("hit"), "effects");
    assert.equal(audioChannelForSound("win"), "effects");
  });

  it("gates rapid repeats but allows the next event after its cooldown", () => {
    const gate = createSoundGate();
    assert.equal(gate("footstep", 1000), true);
    assert.equal(gate("footstep", 1090), false);
    assert.equal(gate("footstep", 1120), true);
    assert.equal(gate("error", 2000), true);
    assert.equal(gate("error", 2100), false);
    assert.equal(gate("error", 2180), true);
  });

  it("assigns longer breathing room to footsteps and result cues than small ticks", () => {
    assert.ok(soundCooldownMs("footstep") > soundCooldownMs("tick"));
    assert.ok(soundCooldownMs("win") > soundCooldownMs("hit"));
  });
});
