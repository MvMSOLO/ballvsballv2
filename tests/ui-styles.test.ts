import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("game and account UI styling regression", () => {
  it("loads the Tailwind layer and V2 theme tokens once", () => {
    expect(css.match(/@import "tailwindcss";/g)).toHaveLength(1);
    expect(css).toContain("--color-brand: #ff7a45");
    expect(css).toContain("--color-rim: #3ee0ff");
  });

  it("keeps the complete play HUD layout rules", () => {
    for (const selector of [
      ".world-guide",
      ".move-stick",
      ".challenge-button",
      ".match-hud.setup-hud",
      ".match-hud.fight-hud",
      ".match-hud.result-hud",
      ".ball-sphere",
      ".aim-area",
      ".sound-toggle",
      ".admin-console",
      ".speed-vote-button",
    ]) {
      expect(css, `missing expected game UI rule: ${selector}`).toContain(selector);
    }
  });

  it("gives the V2 sign-in sheet its own responsive card and form styles", () => {
    for (const selector of [
      ".login-screen .na-sheet",
      ".login-screen input",
      ".login-screen .seg button.on",
      ".login-screen .na-btn.primary",
      ".login-screen .form-error",
    ]) {
      expect(css, `missing account UI rule: ${selector}`).toContain(selector);
    }
  });
});
