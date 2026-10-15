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
assert.ok(worldRenderer.includes("new THREE.InstancedMesh(pillarGeometry, pillarMaterial, 12)"), "Repeated lobby pillars must use instanced rendering");
assert.ok(worldRenderer.includes("if (targetQuality !== this.quality) this.setQuality(targetQuality, true)"), "Adaptive quality must not resize the renderer every frame");
assert.ok(worldRenderer.includes("this.quality === \"low\" ? 0.75 : this.quality === \"medium\" ? 1 : 1.5"), "Quality modes must cap framebuffer resolution for GPU headroom");
assert.ok(worldRenderer.includes("antialias: false"), "WebGL renderer must avoid expensive default MSAA on integrated GPUs");
assert.ok(worldRenderer.includes("update(dt: number, draw: DrawState, frameDeltaMs = dt * 1000)"), "Adaptive quality must receive the real animation-frame interval");
assert.ok(worldRenderer.includes("Math.max(updateCostMs, Math.max(0, frameDeltaMs))"), "Adaptive quality must account for GPU-bound frame pacing");
assert.ok(worldRenderer.includes("if (this.battleTrailsActive)"), "Idle lobby frames must not reset the full battle-trail pool");
assert.ok(worldRenderer.includes('if (draw.mode === "lobby") {\n      // The free-roam avatar and five rivals belong only to the lobby.'), "Hidden lobby rigs must not animate during duel frames");
assert.ok(worldRenderer.includes("this.lobbyWater = this.lobby.getObjectByName(\"water\")"), "Static decorative scene nodes should be cached once");
assert.ok(tokens.includes(".match-hud .lobby-button { position: relative; top: -3px; }"), "Short landscape duel lobby button must stay inside the viewport");
assert.ok(worldRenderer.includes("collectResources(this.scene)"), "Scene resources must be explicitly disposed on route teardown");
assert.ok(homeRoute.includes("world.update(dt, draw, frameDeltaMs)"), "Frame timing must flow from requestAnimationFrame to the renderer");
assert.ok(homeRoute.includes("const LOBBY_BOTS = RIVALS.map"), "Static rival draw data must be prepared once, not allocated each frame");
assert.ok(homeRoute.includes("if (world.quality !== qualityRef.current)"), "Automatic quality changes must keep the quality HUD in sync");
assert.ok(!tokens.includes(".world-host canvas.gl { filter: saturate(1.12) contrast(1.04); }"), "Canvas must not use an extra full-screen CSS filter");
assert.ok(tokens.includes(".world-guide::after { display: none; }"), "Decorative footer must not overlap controls in short landscape");
assert.ok(worldRenderer.includes('name = "lobby-crown"'), "Lobby must build the stadium crown architecture");
assert.ok(worldRenderer.includes('name = "lobby-crown-ring"'), "Lobby architecture needs its restrained signal pulse");
assert.ok(worldRenderer.includes('name = "arena-starfield"'), "Arena must have a lightweight deep-space background");
assert.ok(worldRenderer.includes("new THREE.PointsMaterial"), "Background stars must share a batched points material");
assert.ok(worldRenderer.includes('name = "arena-force-field"'), "Arena force field must stay above, not intersect, fighters");
assert.ok(worldRenderer.includes('name = "arena-graphic-inlays"'), "Arena floor needs broadcast-style spatial markings");
assert.ok(worldRenderer.includes('name = "arena-center-signal"'), "Arena center signal should have a controlled pulse");
assert.ok(worldRenderer.includes("const orbit = this.clock * 0.12"), "Lobby camera must use subtle eased cinematic parallax");
assert.ok(homeRoute.includes('x: -1.8, z: 3.7'), "Front-left rival must stay inside the lobby safe framing");
assert.ok(homeRoute.includes('x: 4.2, z: 3.7'), "Front-right rival must stay inside the lobby safe framing");
assert.ok(homeRoute.includes('x: -1.8, z: -2.4'), "Rear-left rival must stay inside the lobby safe framing");
assert.ok(homeRoute.includes('x: 4.8, z: -2.4'), "Rear-right rival must stay inside the lobby safe framing");
assert.ok(homeRoute.includes('x: 0, z: -7.2'), "Back-center rival must be placed away from the camera's bottom crop");
assert.ok(tokens.includes('top: calc(78px + env(safe-area-inset-top))'), "Short-landscape briefing must clear the top navigation rail");
assert.ok(tokens.includes('.world-guide > p,\n  .world-guide-metrics { display: none; }'), "Short-landscape briefing must compact nonessential content");
assert.ok(tokens.includes('.world-guide-controls { margin-top: 9px; padding-top: 8px; gap: 5px; }'), "Short-landscape movement hint must fit in the briefing");
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
