export type AudioChannel = "ui" | "effects";

export interface AudioLevels {
  master: number;
  music: number;
  ui: number;
  sfx: number;
}

export function clampAudioLevel(value: number, fallback = 0): number {
  const safe = Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, safe));
}

export function normalizeAudioLevels(values: Partial<AudioLevels> = {}): AudioLevels {
  return {
    master: clampAudioLevel(values.master ?? 1, 1),
    music: clampAudioLevel(values.music ?? 0.45, 0.45),
    ui: clampAudioLevel(values.ui ?? 0.7, 0.7),
    sfx: clampAudioLevel(values.sfx ?? 0.8, 0.8),
  };
}

const UI_SOUND_IDS = new Set([
  "click", "lock", "select", "confirm", "open", "close", "cancel", "error",
]);

export function audioChannelForSound(id: string): AudioChannel {
  return UI_SOUND_IDS.has(id) ? "ui" : "effects";
}

export function soundCooldownMs(id: string): number {
  if (id === "error") return 180;
  if (id === "footstep") return 120;
  if (["win", "lose", "victory", "defeat", "reward"].includes(id)) return 260;
  if (["hit", "boom", "explode", "tink"].includes(id)) return 60;
  if (["ability", "dash", "zap", "whoosh", "beam", "chain", "shield", "zone", "projectile", "orbit", "split", "spawn", "charge"].includes(id)) return 85;
  if (["tick", "hiss", "pop", "clink", "shing", "sip", "web", "dice"].includes(id)) return 55;
  return audioChannelForSound(id) === "ui" ? 65 : 55;
}

/** Stateful per-sound gate. No timers or browser APIs; easy to test deterministically. */
export function createSoundGate(): (id: string, now: number) => boolean {
  const lastPlayedAt = new Map<string, number>();
  return (id, now) => {
    const previous = lastPlayedAt.get(id);
    if (previous !== undefined && (now < previous || now - previous < soundCooldownMs(id))) return false;
    lastPlayedAt.delete(id);
    lastPlayedAt.set(id, now);
    if (lastPlayedAt.size > 32) {
      const oldest = lastPlayedAt.keys().next().value;
      if (oldest !== undefined) lastPlayedAt.delete(oldest);
    }
    return true;
  };
}
