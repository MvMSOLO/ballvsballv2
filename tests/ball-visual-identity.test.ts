import { describe, expect, it } from "vitest";
import { loadPack } from "./helpers";

const builtIns = [
  ...loadPack("core"),
  ...loadPack("chatgpt_nexus_pack"),
  ...loadPack("chatgpt_singularity_pack"),
];

describe("built-in ball visual identity", () => {
  it("covers all 34 built-ins with individual silhouette and texture identities", () => {
    expect(builtIns).toHaveLength(34);
    expect(new Set(builtIns.map((ball) => ball.visual.shape)).size).toBe(34);
    expect(new Set(builtIns.map((ball) => ball.visual.pattern)).size).toBe(34);
  });

  it("keeps each design localized and visually authored", () => {
    for (const ball of builtIns) {
      expect(ball.name.en, ball.id + " name.en").toBeTruthy();
      expect(ball.name.uz, ball.id + " name.uz").toBeTruthy();
      expect(ball.name.ru, ball.id + " name.ru").toBeTruthy();
      expect(ball.description.en, ball.id + " description.en").toBeTruthy();
      expect(ball.description.uz, ball.id + " description.uz").toBeTruthy();
      expect(ball.description.ru, ball.id + " description.ru").toBeTruthy();
      expect(ball.visual.baseColor, ball.id + " baseColor").toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(ball.visual.accentColor, ball.id + " accentColor").toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(ball.visual.trail.color, ball.id + " trail color").toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(ball.visual.shape).not.toBe("sphere");
      expect(ball.visual.pattern).not.toBe("none");
    }
  });
});
