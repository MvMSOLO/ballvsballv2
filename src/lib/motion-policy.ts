export interface ImpactMotionProfile {
  /** Decorative scale multiplier for a hit ring; hit magnitude is clamped to the game's 0–16-ish range. */
  scale: number;
  /** Scale for the transient ring duration. */
  duration: number;
  /** Camera shake amount; intentionally zero when reduced motion is active. */
  shake: number;
  /** Decorative particles to spawn, never required to communicate the hit. */
  particles: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

/** Map the simulation's actual hit magnitude to a stable, accessible visual profile. */
export function resolveImpactMotion(magnitude: number, reduceMotion: boolean): ImpactMotionProfile {
  const strength = clamp(magnitude / 16, 0, 1);
  if (reduceMotion) {
    return {
      scale: 0.9 + strength * 0.25,
      duration: 0.38,
      shake: 0,
      particles: 0,
    };
  }
  return {
    scale: 0.62 + strength * 1.22,
    duration: 0.72 + strength * 0.42,
    shake: 0.025 + strength * 0.12,
    particles: strength >= 0.72 ? 9 : strength >= 0.3 ? 5 : 3,
  };
}

/** Saved preference and OS preference are cumulative: either can request reduced motion. */
export function shouldReduceMotion(savedPreference: boolean, systemPreference: boolean): boolean {
  return savedPreference || systemPreference;
}
