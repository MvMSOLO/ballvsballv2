import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createArenaLifecycleState,
  shouldRunArenaLoop,
  transitionArenaLifecycle,
} from "./session-lifecycle-policy.ts";

describe("arena mobile lifecycle policy", () => {
  it("runs the renderer only while visible and the WebGL context is available", () => {
    const active = createArenaLifecycleState(true);
    assert.equal(shouldRunArenaLoop(active), true);

    const background = transitionArenaLifecycle(active, { type: "visibility", visible: false }).state;
    assert.equal(shouldRunArenaLoop(background), false);

    const restored = transitionArenaLifecycle(background, { type: "visibility", visible: true }).state;
    assert.equal(shouldRunArenaLoop(restored), true);

    const contextLost = transitionArenaLifecycle(restored, { type: "webgl-context", lost: true }).state;
    assert.equal(shouldRunArenaLoop(contextLost), false);
  });

  it("clears inputs and resets the frame clock on a visibility transition", () => {
    const active = createArenaLifecycleState(true);
    const hidden = transitionArenaLifecycle(active, { type: "visibility", visible: false });
    assert.equal(hidden.changed, true);
    assert.equal(hidden.clearInput, true);
    assert.equal(hidden.resetFrameClock, true);
    assert.equal(hidden.state.documentVisible, false);
  });

  it("keeps rendering suspended when the page returns before WebGL is restored", () => {
    const lost = transitionArenaLifecycle(
      createArenaLifecycleState(true),
      { type: "webgl-context", lost: true },
    ).state;
    const visibleAgain = transitionArenaLifecycle(lost, { type: "visibility", visible: true });
    assert.equal(visibleAgain.state.webglContextLost, true);
    assert.equal(shouldRunArenaLoop(visibleAgain.state), false);
  });

  it("resumes only after the lost WebGL context is restored", () => {
    const lost = transitionArenaLifecycle(
      createArenaLifecycleState(false),
      { type: "webgl-context", lost: true },
    ).state;
    const restored = transitionArenaLifecycle(lost, { type: "webgl-context", lost: false });
    assert.equal(restored.changed, true);
    assert.equal(restored.resetFrameClock, true);
    assert.equal(restored.clearInput, true);
    assert.equal(shouldRunArenaLoop(restored.state), false, "a hidden page stays suspended");
    const visible = transitionArenaLifecycle(restored.state, { type: "visibility", visible: true }).state;
    assert.equal(shouldRunArenaLoop(visible), true);
  });

  it("does not cause repeated resets for duplicate visibility notifications", () => {
    const active = createArenaLifecycleState(true);
    const duplicate = transitionArenaLifecycle(active, { type: "visibility", visible: true });
    assert.equal(duplicate.changed, false);
    assert.equal(duplicate.clearInput, false);
    assert.equal(duplicate.resetFrameClock, false);
  });
});
