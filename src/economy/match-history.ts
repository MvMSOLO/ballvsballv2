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

function safeLabel(value: unknown, fallback: string): string {
  const clean = typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim()
    : "";
  return (clean || fallback).slice(0, 48);
}

function finiteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Normalize one completed local duel before it is added to the player's save. */
export function createMatchRecord(input: MatchRecordInput): MatchRecord {
  const at = Math.max(0, Math.floor(finiteNumber(input.at ?? Date.now(), Date.now())));
  const seed = Math.trunc(finiteNumber(input.seed, 1)) | 0;
  const suppliedId = typeof input.id === "string" ? input.id.trim().slice(0, 100) : "";
  const id = suppliedId || `match-${at.toString(36)}-${(seed >>> 0).toString(36)}`;
  const damage = Math.max(0, Math.min(1_000_000_000, Math.round(finiteNumber(input.damage))));
  const trophies = Math.max(-1_000_000, Math.min(1_000_000, Math.trunc(finiteNumber(input.trophies ?? 0))));

  return {
    id,
    at,
    opponent: safeLabel(input.opponent, "Rival"),
    ball: safeLabel(input.ball, "Unknown ball"),
    oppBall: safeLabel(input.oppBall, "Unknown ball"),
    win: input.win === true,
    trophies,
    seed,
    damage,
  };
}

/**
 * Return the newest unique match records first, without mutating a save's existing array.
 * A repeated result ID is ignored so retries cannot duplicate a single match in history.
 */
export function appendMatchRecord(
  existing: readonly MatchRecord[],
  record: MatchRecord,
  limit = MAX_MATCH_HISTORY,
): MatchRecord[] {
  const cap = Math.max(0, Math.min(MAX_MATCH_HISTORY, Math.trunc(Number.isFinite(limit) ? limit : MAX_MATCH_HISTORY)));
  const byId = new Map<string, MatchRecord>();
  for (const item of existing) {
    if (!item || typeof item.id !== "string" || !item.id.trim()) continue;
    if (!Number.isFinite(item.at) || typeof item.opponent !== "string"
      || typeof item.ball !== "string" || typeof item.oppBall !== "string"
      || typeof item.win !== "boolean" || !Number.isFinite(item.trophies)
      || !Number.isFinite(item.seed) || !Number.isFinite(item.damage)) continue;
    byId.set(item.id, item);
  }
  if (!byId.has(record.id)) byId.set(record.id, record);
  return [...byId.values()]
    .sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
    .slice(0, cap);
}
