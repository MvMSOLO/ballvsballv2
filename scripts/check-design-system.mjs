import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [tokens, primitives, root, packageText, wordmark, loadingMark, seasonBadge, brandGuide, homeRoute, portalShell, worldRenderer] = await Promise.all([
  readFile(new URL("../src/design-system.css", import.meta.url), "utf8"),
  readFile(new URL("../src/ui-primitives.css", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../public/brand/ball-arena-wordmark.svg", import.meta.url), "utf8"),
  readFile(new URL("../public/brand/ball-arena-loading.svg", import.meta.url), "utf8"),
  readFile(new URL("../public/brand/season-01-origin.svg", import.meta.url), "utf8"),
  readFile(new URL("../public/brand/BRAND_GUIDE.md", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/portal-shell.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/render/world.ts", import.meta.url), "utf8"),
]);
const pkg = JSON.parse(packageText);

const requiredTokens = [
  "--ba-void", "--ba-panel", "--ba-color-bg", "--ba-color-surface",
  "--ba-color-text", "--ba-color-text-secondary", "--ba-color-brand",
  "--ba-color-info", "--ba-color-success", "--ba-color-warning",
  "--ba-color-danger", "--ba-color-focus", "--ba-font-display",
  "--ba-font-body", "--ba-font-data", "--ba-text-sm", "--ba-text-md",
  "--ba-space-4", "--ba-space-8", "--ba-radius-md", "--ba-shadow-md",
  "--ba-motion-ui", "--ba-ease-standard", "--ba-layer-hud",
  "--ba-touch-target",
];

for (const token of requiredTokens) {
  assert.match(tokens, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:"), `Missing design token: ${token}`);
}

const requiredPrimitives = [
  ".ba-page", ".ba-card", ".ba-button", ".ba-button-primary",
  ".ba-icon-button", ".ba-field-control", ".ba-badge",
  ".ba-progress", ".ba-empty-state", ".ba-visually-hidden",
];
for (const selector of requiredPrimitives) {
  assert.ok(primitives.includes(selector), `Missing UI primitive: ${selector}`);
}

assert.ok(root.includes('import uiPrimitivesCss from "../ui-primitives.css?url";'), "UI primitives stylesheet is not imported");
assert.ok(root.includes("{ rel: \"stylesheet\", href: uiPrimitivesCss }"), "UI primitives stylesheet is not linked");
assert.ok(homeRoute.includes('src="/brand/ball-arena-wordmark.svg"'), "Arena header must use the official wordmark");
assert.ok(portalShell.includes('src="/brand/ball-arena-wordmark.svg"'), "Player hub must use the official wordmark");
assert.ok(root.includes('property: "og:title", content: "BALL ARENA — Physics Duel League"'), "Open Graph brand title is missing");
assert.ok(root.includes('property: "og:image", content: "/brand/ball-arena-wordmark.svg"'), "Open Graph wordmark preview is missing");
assert.match(wordmark, /<title[^>]*>Ball Arena<\/title>/i, "Wordmark needs an accessible SVG title");
assert.match(loadingMark, /<title[^>]*>Ball Arena loading<\/title>/i, "Loading mark needs an accessible SVG title");
assert.match(seasonBadge, /Season 01 — Origin/i, "Season badge identity is missing");
assert.ok(brandGuide.includes("Never fabricate online player counts"), "Brand guide must prohibit deceptive marketing");

assert.match(worldRenderer, /aspect >= 1\.85 \? 56 : aspect >= 1\.35 \? 48 : 44/, "Lobby camera must widen on desktop and landscape screens");
assert.ok(homeRoute.includes('x: -4.2, z: 3.7'), "Front-left rival must stay inside the lobby safe framing");
assert.ok(homeRoute.includes('x: 4.2, z: 3.7'), "Front-right rival must stay inside the lobby safe framing");
assert.ok(homeRoute.includes('x: -4.8, z: -2.4'), "Rear-left rival must stay inside the lobby safe framing");
assert.ok(homeRoute.includes('x: 4.8, z: -2.4'), "Rear-right rival must stay inside the lobby safe framing");
assert.ok(homeRoute.includes('className="world-guide-controls"'), "First-session lobby must show movement controls");
assert.ok(homeRoute.includes('> ARENA READY</span>'), "Lobby status must not imply an online-player session");

assert.ok(primitives.includes("@media (prefers-reduced-motion: reduce)"), "Reduced-motion behavior is missing");
assert.ok(primitives.includes("@media (forced-colors: active)"), "Forced-colors behavior is missing");
assert.ok(primitives.includes(":focus-visible"), "Keyboard focus styling is missing");
assert.ok(pkg.scripts?.test?.includes("check-design-system.mjs"), "Design-system validation must run as part of npm test");

function assertBalancedCss(source, name) {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
  const opens = (stripped.match(/\{/g) || []).length;
  const closes = (stripped.match(/\}/g) || []).length;
  assert.equal(opens, closes, `${name} has unbalanced CSS braces (${opens} opening, ${closes} closing)`);
}

assertBalancedCss(tokens, "design-system.css");
assertBalancedCss(primitives, "ui-primitives.css");

console.log(`Design/brand/lobby checks passed: ${requiredTokens.length} tokens, ${requiredPrimitives.length} UI primitives, brand assets, responsive camera and first-session lobby gates.`);
