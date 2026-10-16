export interface ArenaLifecycleState {
  documentVisible: boolean;
  webglContextLost: boolean;
}

export type ArenaLifecycleEvent =
  | { type: "visibility"; visible: boolean }
  | { type: "webgl-context"; lost: boolean };

export interface ArenaLifecycleTransition {
  state: ArenaLifecycleState;
  changed: boolean;
  /** Reset RAF timing after suspend/resume so paused time is never simulated as a frame. */
  resetFrameClock: boolean;
  /** Release all inputs after suspension or graphics-context loss. */
  clearInput: boolean;
}

export function createArenaLifecycleState(documentVisible = true): ArenaLifecycleState {
  return { documentVisible, webglContextLost: false };
}

export function shouldRunArenaLoop(state: ArenaLifecycleState): boolean {
  return state.documentVisible && !state.webglContextLost;
}

/** Pure state transition used by browser lifecycle handlers and the regression tests. */
export function transitionArenaLifecycle(
  current: ArenaLifecycleState,
  event: ArenaLifecycleEvent,
): ArenaLifecycleTransition {
  const next: ArenaLifecycleState = event.type === "visibility"
    ? { ...current, documentVisible: event.visible }
    : { ...current, webglContextLost: event.lost };
  const changed = next.documentVisible !== current.documentVisible
    || next.webglContextLost !== current.webglContextLost;

  return {
    state: next,
    changed,
    resetFrameClock: changed,
    clearInput: changed,
  };
}
