import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [tokens, primitives, root, packageText, wordmark, loadingMark, seasonBadge, brandGuide, homeRoute, portalShell, worldRenderer, profileRoute] = await Promise.all([
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
  readFile(new URL("../src/routes/profile.tsx", import.meta.url), "utf8"),
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
assert.ok(homeRoute.includes('if (view?.flow !== "aim" || view.myAim === null) return;'), "Aim slider must resync from the session view during aim");
assert.ok(homeRoute.includes('disabled={view.confirmed} title={view.confirmed ? "Pick confirmed — reroll locked" : "Reroll your current offers"}'), "Confirmed picks must disable reroll");
assert.ok(homeRoute.includes('flow === "fight" ? (view.sudden ? "SUDDEN DEATH" : view.matchSpeed === 2 ? "2× SPEED" : "LIVE MATCH")'), "Fight phase chip must not display a false zero-second timer");
assert.ok(homeRoute.includes('role="progressbar" aria-label={`${view.names[0]} HP`}'), "Combat HUD must expose accessible HP bars");
assert.ok(homeRoute.includes('view.offers.length === 0 ? <div className="ba-empty-state pick-empty-state" role="status">'), "Empty ball offers must show a recoverable status");
assert.ok(homeRoute.includes('disabled={view.offers.length === 0 || view.picked < 0 || view.confirmed}'), "Confirm must stay disabled when the offer list is empty");
assert.ok(homeRoute.includes('aria-label="Match rewards"'), "Match end screen must label the earned reward summary");
assert.ok(homeRoute.includes("sessionRef.current?.coins ?? 0") && homeRoute.includes("sessionRef.current?.xp ?? 0"), "Displayed rewards must come from the actual session");
assert.ok(tokens.includes(".pick-empty-state {") && tokens.includes(".reward-summary {"), "Empty-offer and end-reward states need dedicated styles");
assert.ok(homeRoute.includes('className="fight-health-warning">CRITICAL</strong>'), "Critical HP must have a non-color-only warning");
assert.ok(tokens.includes(".fight-health-track {"), "Combat HUD health bar styling is missing");
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

const ballInspect = await readFile(new URL("../src/components/ball-inspect-dialog.tsx", import.meta.url), "utf8");
const shopRoute = await readFile(new URL("../src/routes/shop.tsx", import.meta.url), "utf8");
const inventoryRoute = await readFile(new URL("../src/routes/inventory.tsx", import.meta.url), "utf8");
assert.ok(ballInspect.includes('new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" })'), "Ball inspect should use a low-overhead dedicated 3D preview");
assert.ok(ballInspect.includes("new ResizeObserver(resize)"), "3D ball preview must resize without layout jumps");
assert.ok(ballInspect.includes('role="dialog" aria-modal="true"'), "Ball inspect must expose a modal dialog to assistive technology");
assert.ok(ballInspect.includes('event.key === "Escape"'), "Ball inspect must support escape-to-close");
assert.ok(ballInspect.includes("ball.stats.contactDamage") && ballInspect.includes("ball.stats.mass") && ballInspect.includes("ball.stats.speed"), "Ball inspect stats must use actual ball definitions");
assert.ok(ballInspect.includes("ability.actions[0]") && ballInspect.includes("ball.visual.shape"), "Ball preview identity must derive from the selected ball's visual/ability definition");
assert.ok(shopRoute.includes('import { BallInspectDialog } from "@/components/ball-inspect-dialog";') && shopRoute.includes('onClick={() => setInspectedBall(ball)}'), "Shop cards must provide a real inspect action");
assert.ok(inventoryRoute.includes('import { BallInspectDialog } from "@/components/ball-inspect-dialog";') && inventoryRoute.includes('onClick={() => setInspectedBall(ball)}'), "Owned collection cards must provide the same inspect action");
assert.ok(tokens.includes(".ball-inspect-backdrop {") && tokens.includes(".shop-ball-orb.shape-crystal"), "Ball inspect and distinctive card silhouettes require shared design-system styles");

const arenaRoute = await readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8");
assert.ok(arenaRoute.includes('import { BallInspectDialog } from "@/components/ball-inspect-dialog";'), "Match drafting must reuse the shared ball inspector");
assert.ok(arenaRoute.includes('className="ball-card-inspect"') && arenaRoute.includes('onClick={() => setInspectedBall(ball)}'), "Match pick cards must inspect without submitting a pick");
assert.ok(arenaRoute.includes('className="ball-card-select" disabled={view.confirmed}'), "Locked match picks must not remain selectable");
assert.ok(arenaRoute.includes('view.confirmed ? "✓ LOCKED IN" : "✓ SELECTED"'), "Selection and confirmed states must be visually distinct");
assert.ok(arenaRoute.includes("AVAILABLE FOR THIS MATCH") && arenaRoute.includes("MATCH PICK LOCKED"), "Match inspect status must distinguish an available pick from a locked one");
assert.ok(tokens.includes(".ball-card-select {") && tokens.includes(".ball-card-inspect {") && tokens.includes(".ball-card.confirmed.selected"), "Match selection and inspect controls require responsive interaction styling");
assert.ok(tokens.includes("@media (max-height: 500px)") && tokens.includes("min-height: 27px"), "Inspect action must remain touchable in short landscape");


// Phase 07: truthful catalogue states, searchable owned collection, and explicit cosmetic equip.
assert.ok(shopRoute.includes('aria-label="Filter ownership"') && shopRoute.includes('value={ownership}'), "Shop must filter by real owned/unowned state");
assert.ok(shopRoute.includes('aria-label="Sort ball catalogue"') && shopRoute.includes('price-low') && shopRoute.includes('price-high'), "Shop must support explicit name/price/rarity sorting");
assert.ok(shopRoute.includes('ball.ai_hints.role') && shopRoute.includes('...ball.tags'), "Shop search must cover ball identity, role, and tags");
assert.ok(shopRoute.includes('setSaveStatus("syncing")') && shopRoute.includes('ACCOUNT SYNCED') && shopRoute.includes('Purchase could not be confirmed'), "Shop must expose hydration/sync state and avoid claiming an uncertain purchase succeeded or failed");
assert.ok(inventoryRoute.includes('aria-label="Search owned balls by name, role, or tag"') && inventoryRoute.includes('aria-label="Sort owned balls"'), "Inventory must support searchable/sortable owned collection");
assert.ok(inventoryRoute.includes('syncArenaSave(next)') && inventoryRoute.includes('Changes are saved locally, but cloud sync failed'), "Inventory updates must use the existing account-sync path and report fallback truthfully");
assert.ok(inventoryRoute.includes('" · EQUIPPED"') && inventoryRoute.includes('RESET COLLECTION FILTERS'), "Inventory must label active cosmetics and provide empty-filter recovery");
assert.ok(profileRoute.includes('async function equipFrame(frameId: FrameId)') && profileRoute.includes('frame: frameId'), "Profile frame selection must be an explicit persisted equip action");
assert.ok(profileRoute.includes('aria-label={"Progress to level " + (level + 1)}') && profileRoute.includes('xpForNext(level)'), "Profile XP progress must derive from the real XP/level model");
assert.ok(profileRoute.includes('✓ EQUIPPED') && profileRoute.includes('EQUIP FRAME'), "Owned profile frames must separate ownership from equipped state");
assert.ok(tokens.includes('.shop-save-state[data-state="error"]') && tokens.includes('.profile-xp-track') && tokens.includes('.profile-frame-card-iron'), "Phase 07 catalogue, XP, and baseline-frame styles must exist");


// Phase 08: authenticated onboarding, safe return targets, real provider availability, and recovery states.
const loginRoute = await readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8");
const authReturn = await readFile(new URL("../src/lib/auth/auth-return.ts", import.meta.url), "utf8");
const authCapabilities = await readFile(new URL("../src/lib/auth/auth-capabilities.ts", import.meta.url), "utf8");
const authClient = await readFile(new URL("../src/lib/auth/client.ts", import.meta.url), "utf8");
assert.ok(loginRoute.includes('validateSearch: (search: Record<string, unknown>)') && loginRoute.includes('resolveAuthReturnTo(search.callbackURL)'), "Login must validate the return target before OAuth redirects");
assert.ok(authReturn.includes('candidate.startsWith("//")') && authReturn.includes('AUTH_ROUTE_PATHS.has(target.pathname)'), "Auth return targets must reject open redirects and login loops");
assert.ok(loginRoute.includes('useCurrentUserState()') && loginRoute.includes('sessionPending'), "Login must resolve the current session before presenting auth success or redirecting");
assert.ok(loginRoute.includes('getAuthCapabilities()') && loginRoute.includes('capabilityError'), "Login must verify provider capability and expose a retry state");
assert.ok(authCapabilities.includes('process.env.GOOGLE_CLIENT_ID') && authCapabilities.includes('emailAndPasswordEnabled'), "Provider buttons must follow server-side capability flags, not hard-coded assumptions");
assert.ok(loginRoute.includes('profile.ok') && loginRoute.includes('Account created by the server'), "Registration must distinguish confirmed account creation from later profile-sync failure");
assert.ok(loginRoute.includes('friendlyCredentialError') && loginRoute.includes('friendlyProviderError'), "Auth failures must have actionable recovery messaging");
assert.ok(authClient.includes('if (!data?.url) throw new Error("Google sign-in is not configured') && authClient.includes('if (!data?.url) throw new Error("This sign-in provider is unavailable'), "A missing OAuth redirect URL must not leave the UI stuck in a false pending state");
assert.ok(portalShell.includes('AUTH_RETURN_PATHS[active]') && portalShell.includes('href={signInHref}'), "Player hub sign-in must preserve the requested route");
assert.ok(tokens.includes('.auth-provider-button') && tokens.includes('.auth-status-panel') && tokens.includes('.auth-benefit-list'), "Phase 08 needs responsive provider/status/onboarding styles");
