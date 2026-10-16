export type RenderQuality = "low" | "medium" | "high";

export interface AdaptiveQualityState {
  /** Consecutive time over the current preset's frame-time budget. */
  overloadedMs: number;
  /** Consecutive time comfortably below the promotion threshold. */
  stableMs: number;
  /** Cooldown after a preset change, preventing quality oscillation. */
  cooldownMs: number;
}

export interface AdaptiveQualityStep {
  quality: RenderQuality;
  state: AdaptiveQualityState;
  changed: boolean;
}

const HIGH_DOWNGRADE_MS = 1_400;
const MEDIUM_DOWNGRADE_MS = 1_200;
const LOW_RECOVERY_MS = 8_000;
const MEDIUM_RECOVERY_MS = 10_000;
const CHANGE_COOLDOWN_MS = 4_000;
const MAX_ELAPSED_SAMPLE_MS = 50;

/** Create fresh adaptive history. The optional cooldown is useful after a transition. */
export function createAdaptiveQualityState(cooldownMs = 0): AdaptiveQualityState {
  return {
    overloadedMs: 0,
    stableMs: 0,
    cooldownMs: clamp(cooldownMs, 0, CHANGE_COOLDOWN_MS),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

/**
 * Apply sustained-frame-time policy with hysteresis.
 * High only downgrades after sustained >24 ms; Medium downgrades after sustained >29 ms.
 * Recovery needs a longer stable window: Low -> Medium below 19 ms, Medium -> High below 16 ms.
 * Frame samples and elapsed time are bounded so tab-resume spikes cannot trigger an instant drop.
 */
export function stepAdaptiveQuality(
  current: RenderQuality,
  frameTimeMs: number,
  elapsedMs: number,
  previous: AdaptiveQualityState = createAdaptiveQualityState(),
): AdaptiveQualityStep {
  const delta = clamp(elapsedMs, 0, MAX_ELAPSED_SAMPLE_MS);
  const validFrameTime = Number.isFinite(frameTimeMs);
  const frame = validFrameTime ? clamp(frameTimeMs, 0, 50) : Number.NaN;

  if (previous.cooldownMs > 0) {
    return {
      quality: current,
      state: {
        overloadedMs: 0,
        stableMs: 0,
        cooldownMs: Math.max(0, previous.cooldownMs - delta),
      },
      changed: false,
    };
  }

  const overloadLimit = current === "high" ? 24 : current === "medium" ? 29 : Number.POSITIVE_INFINITY;
  const downgradeAfter = current === "high" ? HIGH_DOWNGRADE_MS : MEDIUM_DOWNGRADE_MS;
  const recoveryLimit = current === "low" ? 19 : current === "medium" ? 16 : Number.NEGATIVE_INFINITY;
  const recoverAfter = current === "low" ? LOW_RECOVERY_MS : MEDIUM_RECOVERY_MS;

  const overloadedMs = validFrameTime && frame > overloadLimit
    ? previous.overloadedMs + delta
    : 0;
  const stableMs = validFrameTime && frame < recoveryLimit
    ? previous.stableMs + delta
    : 0;

  let next: RenderQuality = current;
  if ((current === "high" || current === "medium") && overloadedMs >= downgradeAfter) {
    next = current === "high" ? "medium" : "low";
  } else if ((current === "low" || current === "medium") && stableMs >= recoverAfter) {
    next = current === "low" ? "medium" : "high";
  }

  if (next !== current) {
    return {
      quality: next,
      state: createAdaptiveQualityState(CHANGE_COOLDOWN_MS),
      changed: true,
    };
  }

  return {
    quality: current,
    state: { overloadedMs, stableMs, cooldownMs: 0 },
    changed: false,
  };
}
