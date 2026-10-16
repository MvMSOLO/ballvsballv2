import type { MatchRecord } from "./save";

export const MAX_MATCH_HISTORY = 20;

export interface MatchRecordInput {
  id?: string;
  at?: number;
  opponent: string;
  ball: string;
  oppBall: string;
  win: boolean;
  trophies?: number;
  seed: number;
  damage: number;
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  let clean = "";
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code >= 32 && code !== 127) clean += character;
  }
  return clean.trim().slice(0, maxLength);
}

function safeLabel(value: unknown, fallback: string): string {
  return cleanText(value, 48) || fallback;
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Coerce legacy or untrusted persisted data into the stable MatchRecord shape.
 * Invalid rows without a usable ID are discarded; bad optional fields get safe defaults.
 */
export function normalizeMatchRecord(value: unknown): MatchRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<MatchRecord>;
  const id = cleanText(row.id, 100);
  if (!id) return null;

  const at = Math.max(0, Math.floor(finiteNumber(row.at)));
  const seed = Math.trunc(finiteNumber(row.seed, 1)) | 0;
  const damage = Math.max(0, Math.min(1_000_000_000, Math.round(finiteNumber(row.damage))));
  const trophies = Math.max(-1_000_000, Math.min(1_000_000, Math.trunc(finiteNumber(row.trophies))));

  return {
    id,
    at,
    opponent: safeLabel(row.opponent, "Rival"),
    ball: safeLabel(row.ball, "Unknown ball"),
    oppBall: safeLabel(row.oppBall, "Unknown ball"),
    win: row.win === true,
    trophies,
    seed,
    damage,
  };
}

/** Normalize one completed local duel before it is added to the player's save. */
export function createMatchRecord(input: MatchRecordInput): MatchRecord {
  const at = Math.max(0, Math.floor(finiteNumber(input.at ?? Date.now(), Date.now())));
  const seed = Math.trunc(finiteNumber(input.seed, 1)) | 0;
  const suppliedId = cleanText(input.id, 100);
  const id = suppliedId || `match-${at.toString(36)}-${(seed >>> 0).toString(36)}`;

  // normalizeMatchRecord cannot return null for this fully-defined object.
  return normalizeMatchRecord({
    id,
    at,
    opponent: input.opponent,
    ball: input.ball,
    oppBall: input.oppBall,
    win: input.win,
    trophies: input.trophies ?? 0,
    seed,
    damage: input.damage,
  })!;
}

/**
 * Merge histories from multiple saves, keeping one normalized record per ID and
 * the newest 20 records by timestamp. This prevents stale devices from crowding
 * newer cloud records out simply because their array happened to be first.
 */
export function mergeMatchHistory(
  sources: readonly (readonly unknown[])[],
  limit = MAX_MATCH_HISTORY,
): MatchRecord[] {
  const cap = Math.max(0, Math.min(MAX_MATCH_HISTORY, Math.trunc(Number.isFinite(limit) ? limit : MAX_MATCH_HISTORY)));
  const byId = new Map<string, MatchRecord>();
  for (const source of sources) {
    for (const candidate of source) {
      const record = normalizeMatchRecord(candidate);
      if (!record) continue;
      const previous = byId.get(record.id);
      if (!previous || record.at > previous.at) byId.set(record.id, record);
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
    .slice(0, cap);
}

/**
 * Add a result without replacing an existing ID. Retries are idempotent; when
 * merging separate saves, mergeMatchHistory resolves conflicts by newest timestamp.
 */
export function appendMatchRecord(
  existing: readonly MatchRecord[],
  record: MatchRecord,
  limit = MAX_MATCH_HISTORY,
): MatchRecord[] {
  const alreadyExists = existing.some((item) => item?.id === record.id);
  return mergeMatchHistory([alreadyExists ? existing : [...existing, record]], limit);
}
