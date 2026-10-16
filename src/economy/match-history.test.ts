import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { MatchRecord } from "./save.ts";
import { appendMatchRecord, createMatchRecord, MAX_MATCH_HISTORY } from "./match-history.ts";

function record(id: string, at: number): MatchRecord {
  return createMatchRecord({
    id,
    at,
    opponent: "Rival",
    ball: "Aegis",
    oppBall: "Nova",
    win: true,
    trophies: 0,
    seed: 7,
    damage: 42,
  });
}

describe("match history integrity", () => {
  it("normalizes invalid labels and numeric values before persistence", () => {
    const result = createMatchRecord({
      id: "  test-id  ",
      at: Number.NaN,
      opponent: "  \u0000  ",
      ball: "",
      oppBall: "  Rival ball  ",
      win: false,
      trophies: Number.POSITIVE_INFINITY,
      seed: Number.NaN,
      damage: Number.NEGATIVE_INFINITY,
    });

    assert.equal(result.id, "test-id");
    assert.equal(result.opponent, "Rival");
    assert.equal(result.ball, "Unknown ball");
    assert.equal(result.oppBall, "Rival ball");
    assert.equal(result.win, false);
    assert.equal(result.trophies, 0);
    assert.equal(result.seed, 1);
    assert.equal(result.damage, 0);
    assert.equal(Number.isFinite(result.at), true);
  });

  it("keeps the newest records first and caps storage at twenty matches", () => {
    const older = Array.from({ length: MAX_MATCH_HISTORY }, (_, i) => record("old-" + i, 100 + i));
    const next = record("newest", 10_000);
    const merged = appendMatchRecord(older, next);

    assert.equal(merged.length, MAX_MATCH_HISTORY);
    assert.equal(merged[0]?.id, "newest");
    assert.equal(merged.some((item) => item.id === "old-0"), false);
    assert.equal(merged.every((item, index) => index === 0 || merged[index - 1]!.at >= item.at), true);
  });

  it("does not duplicate a result when the same match ID is appended twice", () => {
    const first = record("same-match", 100);
    const second = record("same-match", 200);
    const once = appendMatchRecord([], first);
    const twice = appendMatchRecord(once, second);

    assert.deepEqual(twice, [first]);
  });

  it("does not mutate the caller's existing history array", () => {
    const original = [record("old", 10)];
    const snapshot = original.slice();
    const merged = appendMatchRecord(original, record("new", 20));

    assert.deepEqual(original, snapshot);
    assert.deepEqual(merged.map((item) => item.id), ["new", "old"]);
  });

  it("supports a zero history cap without mutating existing records", () => {
    const original = [record("old", 10)];
    assert.deepEqual(appendMatchRecord(original, record("new", 20), 0), []);
    assert.equal(original.length, 1);
  });
});
