import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { BallDef, Action } from "../sim/types";
import { CONFIG, type Difficulty } from "../config";
import { World, type DrawState } from "../render/world";
import { advanceSession, applyCommand, createSession, publicView, renderFrame, voteMatchSpeed, type Session } from "../game/session";
import { allPacks, enabledBalls } from "../packs/registry";
import { buildOwnedBallPool } from "../game/owned-ball-pool";
import { playerMoveInput } from "../game/controls";
import { loadSave, writeSave, type Save } from "../economy/save";
import { appendMatchRecord, createMatchRecord } from "../economy/match-history";
import { hydrateArenaSave, syncArenaSave } from "@/economy/persistence";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { sfx, setAudioLevels, setMuted, unlockAudio } from "../audio/synth";
import { BallInspectDialog } from "@/components/ball-inspect-dialog";
import { MatchPhaseUI } from "@/components/MatchPhaseUI";
import { PLAYER_HUB_NAV, canAccessOwnerTools } from "@/lib/player-navigation";
import { shouldReduceMotion } from "@/lib/motion-policy";
import { createArenaLifecycleState, shouldRunArenaLoop, transitionArenaLifecycle, type ArenaLifecycleEvent } from "@/lib/session-lifecycle-policy";

export const Route = createFileRoute("/")({ component: BallArenaPage });

type UiView = ReturnType<typeof publicView> | null;

function abilityTriggerLabel(trigger: string, interval?: number): string {
  if (trigger === "onBallHit") return "ON HIT";
  if (trigger === "onWallHit") return "WALL BOUNCE";
  if (trigger === "onDamaged") return "WHEN HIT";
  if (trigger === "onSpawn") return "SPAWN BURST";
  if (trigger === "onRoundStart") return "ROUND START";
  if (trigger === "onHpBelow") return "LOW HP";
  if (trigger === "onKill") return "FINISHER";
  if (trigger === "onDealDamage") return "DEAL DAMAGE";
  if (trigger === "onTimer") return "TIMED SKILL";
  if (trigger === "onTick") return "PASSIVE · " + (interval ?? 1).toFixed(1) + "s";
  return trigger.replace(/([A-Z])/g, " $1").toUpperCase();
}

function actionLabel(action: Action): string {
  switch (action.type) {
    case "damage": return "BURST";
    case "heal": return "REGEN";
    case "applyStatus": return action.status.toUpperCase();
    case "modifyStat": return action.stat.toUpperCase() + (action.mode === "mul" ? " BOOST" : " SHIFT");
    case "knockback": return "KNOCKBACK";
    case "pull": return "GRAVITY PULL";
    case "dash": return "DASH";
    case "teleport": return "PHASE " + action.mode.toUpperCase();
    case "grow": return "OVERGROW";
    case "shrink": return "SHRINK";
    case "split": return "SPLIT";
    case "spawnZone": return action.shape.toUpperCase() + " ZONE";
    case "spawnProjectile": return action.pattern.toUpperCase() + " SHOT";
    case "spawnTurret": return "TURRET";
    case "spawnSummon": return "SUMMON";
    case "spawnOrbiter": return "ORBITERS";
    case "createBeam": return "ENERGY BEAM";
    case "chainLightning": return "CHAIN LIGHTNING";
    case "explode": return "EXPLOSION";
    case "lifesteal": return "LIFESTEAL";
    case "thorns": return "THORNS";
    case "reviveOnce": return "SECOND CHANCE";
    case "randomChoice": return "RANDOM CHAOS";
    case "repeat": return "COMBO";
    case "scaleWith": return "SCALING POWER";
  }
}

function abilityGlyph(action?: Action): string {
  if (!action) return "◎";
  switch (action.type) {
    case "damage": return "✦";
    case "heal": return "✚";
    case "applyStatus": return action.status === "shield" ? "⛨" : "✧";
    case "modifyStat": return "↗";
    case "knockback": return "↯";
    case "pull": return "⟲";
    case "dash": return "➤";
    case "teleport": return "⌁";
    case "grow": return "⤢";
    case "shrink": return "⤡";
    case "split": return "✣";
    case "spawnZone": return action.shape === "web" ? "✳" : action.shape === "ring" ? "◎" : "▱";
    case "spawnProjectile": return action.pattern === "homing" ? "➶" : "➤";
    case "spawnTurret": return "⌖";
    case "spawnSummon": return "✧";
    case "spawnOrbiter": return "⟳";
    case "createBeam": return "ϟ";
    case "chainLightning": return "ϟ";
    case "explode": return "✹";
    case "lifesteal": return "♥";
    case "thorns": return "✥";
    case "reviveOnce": return "↻";
    case "randomChoice": return "⁕";
    case "repeat": return "⟲";
    case "scaleWith": return "⇧";
  }
  return "✧";
}

function ballGlyph(id: string): string {
  if (id.includes("die") || id.includes("lucky")) return "⚄";
  if (id.includes("glass") || id.includes("prism")) return "◆";
  if (id.includes("magma") || id.includes("boom")) return "✹";
  if (id.includes("coil") || id.includes("jolt")) return "ϟ";
  if (id.includes("ribbon")) return "〰";
  if (id.includes("sprout")) return "✿";
  if (id.includes("hook") || id.includes("knife")) return "➤";
  if (id.includes("halo") || id.includes("aegis")) return "◉";
  if (id.includes("swarm")) return "✣";
  if (id.includes("web")) return "✳";
  if (id.includes("serpent")) return "≈";
  if (id.includes("hail")) return "❖";
  return "⬡";
}

const RIVALS = [
  { name: "NovaByte", x: -1.8, z: 3.7, yaw: 0.4, moving: true, shirt: "#5b8cff", emote: "" },
  { name: "PixelFox", x: 4.2, z: 3.7, yaw: -0.4, moving: false, shirt: "#3ecf8e", emote: "wave" },
  { name: "OrbitJay", x: -1.8, z: -2.4, yaw: 1, moving: false, shirt: "#f5b942", emote: "" },
  { name: "MangoRush", x: 4.8, z: -2.4, yaw: -1, moving: true, shirt: "#ff5a36", emote: "" },
  { name: "ZedSpark", x: 0, z: -7.2, yaw: 3, moving: false, shirt: "#1c2430", emote: "" },
] as const;

const LOBBY_BOTS = RIVALS.map((rival) => ({
  name: rival.name, x: rival.x, z: rival.z, yaw: rival.yaw,
  moving: rival.moving, shirt: rival.shirt, emote: rival.emote,
}));
const PLAYER_COLORS = { skin: "#f3c7a1", shirt: "#ff5a36", pants: "#2f6bff", hat: "#1c2430" };


type HubLogoKind = "profile" | "shop" | "inventory" | "ranks" | "settings" | "account" | "login";

function HubLogo({ kind }: { kind: HubLogoKind }) {
  return (
    <svg className={`hub-logo hub-logo-${kind}`} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`hub-grad-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a5f3fc" />
          <stop offset="55%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
      <path className="hub-logo-orbit" d="M17 3H31L45 17V31L31 45H17L3 31V17Z" />
      {kind === "profile" && <><path className="hub-logo-core" d="M24 9 31 13V21L24 25 17 21V13Z" /><path className="hub-logo-line" d="M10 38 14 30 24 26 34 30 38 38 34 41H14Z" /></>}
      {kind === "shop" && <><path className="hub-logo-line" d="M7 9H14L19 31H36L41 14H16" /><path className="hub-logo-core" d="M18 36 21 33 24 36 21 40Z M32 36 35 33 38 36 35 40Z" /><path className="hub-logo-line" d="M23 19V27M30 19V27" /></>}
      {kind === "inventory" && <><path className="hub-logo-line" d="M24 5 41 15V33L24 43 7 33V15Z" /><path className="hub-logo-line" d="m9 16 15 9 15-9M24 25v15" /><path className="hub-logo-core" d="m18 12 15 8" /></>}
      {kind === "ranks" && <><path className="hub-logo-line" d="M15 8H33V18L29 27 24 31 19 27 15 18Z" /><path className="hub-logo-line" d="M15 13H7V19L17 27M33 13H41V19L31 27M24 31V38M15 41H33" /><path className="hub-logo-core" d="M24 12 27 18 34 19 29 24 30 30 24 27 18 30 19 24 14 19 21 18Z" /></>}
      {kind === "settings" && <><path className="hub-logo-line" d="M19 5H29L31 11 37 14 43 12 46 20 41 24 43 29 38 36 32 34 28 43H20L18 37 12 34 6 36 3 28 8 24 6 19 11 12 17 14Z" /><path className="hub-logo-core" d="M24 17 31 21V27L24 31 17 27V21Z" /></>}
      {kind === "account" && <><path className="hub-logo-line" d="M24 4 41 12V24L35 35 24 43 13 35 7 24V12Z" /><path className="hub-logo-core" d="M24 12 30 16V22L24 26 18 22V16Z" /><path className="hub-logo-line" d="M15 33 19 28H29L33 33" /></>}
      {kind === "login" && <><path className="hub-logo-line" d="M26 7H41V41H26M5 24H31M21 14 31 24 21 34" /><path className="hub-logo-core" d="M8 8H17V17H8Z" /></>}
    </svg>
  );
}

export type ArenaRouteMode = "free-roam" | "duel" | "admin";

export function BallArenaPage({ mode = "free-roam" }: { mode?: ArenaRouteMode } = {}) {
  const { user: currentUser, isPending: authPending } = useCurrentUserState();
  const [reduceMotion, setReduceMotion] = useState(() => typeof window !== "undefined" && shouldReduceMotion(
    document.documentElement.dataset.reduceMotion === "true",
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ));
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => setReduceMotion(shouldReduceMotion(
      document.documentElement.dataset.reduceMotion === "true",
      motionQuery.matches,
    ));
    const observer = new MutationObserver(syncMotionPreference);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
    motionQuery.addEventListener("change", syncMotionPreference);
    syncMotionPreference();
    return () => {
      observer.disconnect();
      motionQuery.removeEventListener("change", syncMotionPreference);
    };
  }, []);
  const cloudSyncRef = useRef(false);
  cloudSyncRef.current = authEnabled && Boolean(currentUser && !currentUser.isDevFallback);
  const cloudUserIdRef = useRef<string | null>(currentUser?.id ?? null);
  cloudUserIdRef.current = currentUser?.id ?? null;
  const saveHydrationRef = useRef<Promise<Save> | null>(null);
  const saveHydrationUserRef = useRef<string | null>(null);
  const authReadyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!authReadyRef.current) {
    let resolve!: () => void;
    const promise = new Promise<void>((complete) => { resolve = complete; });
    authReadyRef.current = { promise, resolve };
  }
  useEffect(() => {
    if (!authEnabled || !authPending) authReadyRef.current?.resolve();
  }, [authPending]);
  const adminMode = mode === "admin";
  const ownerToolsAvailable = canAccessOwnerTools(currentUser);
  const availablePacks = useMemo(() => allPacks(), []);
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const lastFrameRef = useRef(0);
  const lastUiRef = useRef(0);
  const stepAudioRef = useRef(0);
  const smoothedMoveRef = useRef({ x: 0, z: 0 });
  const facingRef = useRef(0);
  const playedFxKeysRef = useRef<{ keys: Set<string>; queue: string[] }>({ keys: new Set(), queue: [] });
  const previousHpRef = useRef<[number, number] | null>(null);
  const [view, setView] = useState<UiView>(null);
  const [coins, setCoins] = useState(CONFIG.starterCoins);
  const [infiniteCoins, setInfiniteCoins] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [diamonds, setDiamonds] = useState(CONFIG.starterDiamonds);
  const [infiniteDiamonds, setInfiniteDiamonds] = useState(false);
  const [aim, setAim] = useState(90);
  const [inspectedBall, setInspectedBall] = useState<BallDef | null>(null);
  const closeBallInspect = useCallback(() => setInspectedBall(null), []);
  const [notice, setNotice] = useState("");
  const [rendererRecovering, setRendererRecovering] = useState(false);
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [autoQuality, setAutoQuality] = useState(true);
  const qualityRef = useRef(quality);
  const autoQualityRef = useRef(true);
  const [activeMap, setActiveMap] = useState<"lobby" | "rift">("lobby");
  const activeMapRef = useRef<"lobby" | "rift">("lobby");
  activeMapRef.current = activeMap;
  const playerPosRef = useRef({ x: 0, z: 0 });
  const touchMoveRef = useRef({ x: 0, y: 0 });
  const stickPointerRef = useRef<number | null>(null);
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 });
  const [nearbyRival, setNearbyRival] = useState<number | null>(null);
  const nearbyRivalRef = useRef<number | null>(null);
  const [riftGateNearby, setRiftGateNearby] = useState(false);
  const riftGateNearbyRef = useRef(false);
  const [opponentName, setOpponentName] = useState("NovaByte");
  const [adminBallA, setAdminBallA] = useState("chatgpt_ember_ledger");
  const [adminBallB, setAdminBallB] = useState("chatgpt_void_covenant");
  const [adminDifficulty, setAdminDifficulty] = useState<Difficulty>("hard");
  const [adminAimA, setAdminAimA] = useState(90);
  const [adminPaused, setAdminPaused] = useState(false);
  const adminPausedRef = useRef(false);
  adminPausedRef.current = adminPaused;
  const directBootRef = useRef(false);
  const diamondsRef = useRef(diamonds);
  diamondsRef.current = diamonds;
  const rewardedSessionRef = useRef<Session | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const hiEmoteUntilRef = useRef(0);
  const ballMapRef = useRef<Map<string, BallDef>>(new Map());

  // Start cloud hydration lazily as well as from the preference effect. This matters
  // for the direct-duel route, whose startup effect can run before later effects.
  const ensureSaveHydrated = useCallback((): Promise<Save | null> => {
    const userId = cloudUserIdRef.current;
    if (!cloudSyncRef.current || !userId) return Promise.resolve(null);

    if (saveHydrationUserRef.current !== userId || !saveHydrationRef.current) {
      saveHydrationUserRef.current = userId;
      const pending = hydrateArenaSave(loadSave());
      const tracked = pending.catch((error: unknown) => {
        if (saveHydrationUserRef.current === userId) saveHydrationRef.current = null;
        throw error;
      });
      saveHydrationRef.current = tracked;
    }
    return saveHydrationRef.current ?? Promise.resolve(null);
  }, []);

  const toggleActiveMap = useCallback(() => {
    if (sessionRef.current) {
      setNotice("Finish the current duel before changing maps.");
      return;
    }
    const nextMap = activeMapRef.current === "lobby" ? "rift" : "lobby";
    activeMapRef.current = nextMap;
    setActiveMap(nextMap);
    playerPosRef.current = nextMap === "rift" ? { x: 0, z: 8.2 } : { x: 0, z: -10.4 };
    facingRef.current = nextMap === "rift" ? Math.PI : 0;
    nearbyRivalRef.current = null;
    setNearbyRival(null);
    riftGateNearbyRef.current = false;
    setRiftGateNearby(false);
    sfx("click");
    setNotice(nextMap === "rift"
      ? "Rift Expanse loaded · free-roam map. Duels still use the dedicated combat arena."
      : "Returned to the social lobby.");
  }, []);

  const requestLandscape = useCallback(() => {
    const enterFullscreenAndLock = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fullscreen is optional; the on-screen rotate prompt handles browsers that deny it.
      }
      try {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (type: "landscape") => Promise<void>;
        };
        await orientation.lock?.("landscape");
      } catch {
        // Not all mobile browsers allow orientation locking from a web page.
      }
    };
    void enterFullscreenAndLock();
  }, []);

  const startMatch = useCallback(async (rival: string) => {
    unlockAudio();
    sfx("lock");
    let cloudHydrationFailed = false;
    // Auth-enabled deployments start with a pending session. Do not draft from
    // local starter defaults until the session has resolved (including direct-duel mode).
    if (authEnabled && authPending) {
      setNotice("Restoring account inventory…");
      await authReadyRef.current?.promise;
    }
    if (cloudSyncRef.current) {
      setNotice("Syncing your owned inventory…");
      try {
        await ensureSaveHydrated();
      } catch {
        cloudHydrationFailed = true;
      }
    }
    // Always read after hydration resolves: a fresh local save can contain only
    // starter balls while the authoritative account inventory is still downloading.
    const stored = loadSave();
    const all = enabledBalls();
    // Catalog definitions include already-owned balls even when their pack is not in the opponent pool.
    const catalog = allPacks().flatMap((pack) => pack.balls);
    const byId = new Map(catalog.map((ball) => [ball.id, ball]));
    ballMapRef.current = byId;
    const pool = buildOwnedBallPool(stored.owned, catalog, CONFIG.starterBalls, all);
    if (pool.length < 2) {
      setNotice("No valid balls were loaded. Check the core pack.");
      return;
    }
    requestLandscape();
    if (stored && typeof stored.coins === "number") setCoins(stored.coins);
    if (stored && typeof stored.adminInfiniteCoins === "boolean") setInfiniteCoins(stored.adminInfiniteCoins);
    if (stored && typeof stored.adminInfiniteDiamonds === "boolean") setInfiniteDiamonds(stored.adminInfiniteDiamonds);
    if (stored && typeof stored.diamonds === "number") {
      setDiamonds(stored.diamonds);
      diamondsRef.current = stored.diamonds;
    }
    setOpponentName(rival);
    nearbyRivalRef.current = null;
    setNearbyRival(null);
    sessionRef.current = createSession({
      seed: Math.floor(Math.random() * 2_000_000_000),
      pool0: pool,
      pool1: all.length >= 3 ? all : pool,
      names: ["You", rival],
      diff: "normal",
      control: ["human", "bot"],
    });
    setView(publicView(sessionRef.current));
    setNotice(cloudHydrationFailed
      ? "Cloud inventory unavailable · using this device's saved progress."
      : "Challenge accepted · " + rival);
  }, [authPending, ensureSaveHydrated, requestLandscape]);

  useEffect(() => {
    if (mode !== "duel" || directBootRef.current || (authEnabled && authPending)) return;
    directBootRef.current = true;
    void startMatch("NovaByte");
  }, [mode, authPending, startMatch]);

  const send = useCallback((cmd: Parameters<typeof applyCommand>[1]) => {
    if (cmd.t !== "aim") sfx("click");
    const s = sessionRef.current;
    if (!s) return;
    const err = applyCommand(s, cmd, (cost) => {
      if (diamonds < cost) return false;
      setDiamonds((d) => d - cost);
      return true;
    });
    if (err === "diamonds") setNotice("Not enough diamonds for that reroll.");
    else if (err) setNotice(err);
    else setNotice("");
    setView(publicView(s));
  }, [diamonds]);

  const startAdminDuel = useCallback((randomize = false) => {
    const all = allPacks().flatMap((pack) => pack.balls);
    const byId = new Map(all.map((ball) => [ball.id, ball]));
    ballMapRef.current = byId;
    let a = byId.get(adminBallA) ?? all[0];
    let b = byId.get(adminBallB) ?? all.find((ball) => ball.id !== a?.id) ?? all[1];
    if (randomize && all.length) {
      a = all[Math.floor(Math.random() * all.length)] ?? all[0];
      const rivalPool = all.filter((ball) => ball.id !== a?.id);
      b = rivalPool[Math.floor(Math.random() * Math.max(1, rivalPool.length))] ?? a;
      if (a) setAdminBallA(a.id);
      if (b) setAdminBallB(b.id);
    }
    if (!a || !b) {
      setNotice("No valid ball definitions are loaded. Check pack validation.");
      return;
    }
    const s = createSession({
      seed: Math.floor(Math.random() * 2_000_000_000),
      pool0: [a],
      pool1: [b],
      names: [a.name.en, "BOT · " + b.name.en],
      diff: adminDifficulty,
      control: ["human", "bot"],
      aimStyle: ["manual", "smart"],
      viewSide: 0,
    });
    // Admin route skips drafting; any built-in pack, including disabled packs, may be tested.
    // The bot opponent is enabled by default and chooses its own launch direction.
    s.flow = "aim";
    s.timer = CONFIG.aimSeconds;
    s.offers = [[a.id], [b.id]];
    s.picked = [0, 0];
    s.confirmed = [true, true];
    s.aim = [adminAimA * Math.PI / 180, -Math.PI / 2];
    s.aimLocked = [false, false];
    s.think = [999, 0];
    s.ballName = [a.name.en, b.name.en];
    s.matchSpeed = 1;
    s.speedVotes = [false, false];
    sessionRef.current = s;
    rewardedSessionRef.current = null;
    previousHpRef.current = null;
    setOpponentName(b.name.en);
    setAdminPaused(false);
    setView(publicView(s));
    setNotice("Admin lab ready · bot auto-aim enabled. Choose A's launch angle.");
    requestLandscape();
  }, [adminBallA, adminBallB, adminDifficulty, adminAimA, requestLandscape]);

  useEffect(() => {
    if (mode !== "admin" || directBootRef.current) return;
    directBootRef.current = true;
    startAdminDuel(true);
  }, [mode, startAdminDuel]);

  const updateAdminAim = useCallback((angle: number) => {
    setAdminAimA(angle);
    const s = sessionRef.current;
    if (s && s.flow === "aim" && !s.aimLocked[0]) s.aim[0] = angle * Math.PI / 180;
  }, []);

  const lockAdminLaunch = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.flow !== "aim") return;
    s.aim[0] = adminAimA * Math.PI / 180;
    s.aimLocked[0] = true;
    s.think[1] = 0;
    advanceSession(s, 0.016);
    setView(publicView(s));
    setNotice("Player A locked · bot auto-aim is enabled.");
  }, [adminAimA]);

  const toggleMatchSpeed = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.flow !== "fight") return;
    const enabling = s.matchSpeed !== 2;
    const enabled = voteMatchSpeed(s, 0, enabling);
    setView(publicView(s));
    setNotice(enabled ? "2× speed approved by you + bot." : "2× match speed vote cancelled.");
  }, []);

  const toggleAdminPause = useCallback(() => {
    setAdminPaused((paused) => {
      adminPausedRef.current = !paused;
      return !paused;
    });
  }, []);

  const adjustAdminHealth = useCallback((side: 0 | 1, delta: number) => {
    const s = sessionRef.current;
    const fight = s?.fight;
    if (!s || !fight) return;
    fight.hp[side] = Math.max(1, Math.min(fight.maxHp[side], fight.hp[side] + delta));
    setView(publicView(s));
  }, []);

  const forceAdminWinner = useCallback((side: 0 | 1) => {
    const s = sessionRef.current;
    if (!s?.fight) return;
    s.fight.hp[side === 0 ? 1 : 0] = 0;
    s.fight.over = true;
    advanceSession(s, 0.016);
    setView(publicView(s));
    setAdminPaused(false);
  }, []);

  const updateStickFromPointer = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (stickPointerRef.current !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
    let x = (e.clientX - (rect.left + rect.width / 2)) / radius;
    let y = (e.clientY - (rect.top + rect.height / 2)) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    touchMoveRef.current = { x, y };
    setStickOffset({ x: x * 27, y: y * 27 });
  }, []);

  const onStickPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    unlockAudio();
    stickPointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateStickFromPointer(e);
  }, [updateStickFromPointer]);

  const onStickPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (stickPointerRef.current !== e.pointerId) return;
    stickPointerRef.current = null;
    touchMoveRef.current = { x: 0, y: 0 };
    setStickOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    let active = true;
    const saved = loadSave();
    setCoins(saved.coins);
    setDiamonds(saved.diamonds);
    setInfiniteCoins(saved.adminInfiniteCoins);
    setInfiniteDiamonds(saved.adminInfiniteDiamonds);
    diamondsRef.current = saved.diamonds;
    setAudioMuted(!saved.settings.sound);
    setAudioLevels({ master: saved.settings.master, music: saved.settings.music, ui: saved.settings.ui, sfx: saved.settings.sfx });
    setMuted(!saved.settings.sound);
    autoQualityRef.current = saved.settings.quality === "auto";
    setAutoQuality(autoQualityRef.current);
    const initialQuality: "low" | "medium" | "high" = saved.settings.quality === "auto" ? "medium" : saved.settings.quality;
    qualityRef.current = initialQuality;
    setQuality(initialQuality);
    worldRef.current?.setQuality(initialQuality, autoQualityRef.current);
    if (cloudSyncRef.current) {
      void ensureSaveHydrated().then((merged) => {
        if (!active || !merged) return;
        setCoins(merged.coins);
        setDiamonds(merged.diamonds);
        diamondsRef.current = merged.diamonds;
        setAudioMuted(!merged.settings.sound);
        setAudioLevels({ master: merged.settings.master, music: merged.settings.music, ui: merged.settings.ui, sfx: merged.settings.sfx });
        setMuted(!merged.settings.sound, false);
        autoQualityRef.current = merged.settings.quality === "auto";
        setAutoQuality(autoQualityRef.current);
        const mergedQuality: "low" | "medium" | "high" = merged.settings.quality === "auto" ? "medium" : merged.settings.quality;
        qualityRef.current = mergedQuality;
        setQuality(mergedQuality);
        worldRef.current?.setQuality(mergedQuality, autoQualityRef.current);
      }).catch(() => {
        if (active) setNotice("Cloud save unavailable; continuing with local progress.");
      });
    }
    return () => { active = false; };
  }, [currentUser?.id, ensureSaveHydrated]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let raf = 0;
    let frameScheduled = false;
    let lifecycle = createArenaLifecycleState(!document.hidden);
    try {
      const world = new World(host);
      world.setQuality(qualityRef.current, autoQualityRef.current);
      worldRef.current = world;

      const clearInputState = () => {
        keysRef.current.clear();
        touchMoveRef.current = { x: 0, y: 0 };
        smoothedMoveRef.current = { x: 0, z: 0 };
        stickPointerRef.current = null;
        setStickOffset({ x: 0, y: 0 });
      };
      const canRunFrame = () => shouldRunArenaLoop(lifecycle) && document.documentElement.dataset.arenaEntry !== "locked";
      let tick: (now: number) => void = () => undefined;
      const scheduleFrame = () => {
        if (disposed || frameScheduled || !canRunFrame()) return;
        frameScheduled = true;
        raf = window.requestAnimationFrame(tick);
      };
      const stopFrame = () => {
        if (!frameScheduled) return;
        window.cancelAnimationFrame(raf);
        frameScheduled = false;
      };
      const syncEntryState = () => {
        if (document.documentElement.dataset.arenaEntry === "locked") stopFrame();
        else scheduleFrame();
      };
      const applyLifecycleEvent = (event: ArenaLifecycleEvent) => {
        const transition = transitionArenaLifecycle(lifecycle, event);
        lifecycle = transition.state;
        if (transition.clearInput) clearInputState();
        if (transition.resetFrameClock) {
          lastFrameRef.current = 0;
          lastUiRef.current = 0;
        }
        setRendererRecovering(lifecycle.webglContextLost);
        if (canRunFrame()) scheduleFrame();
        else stopFrame();
      };
      const resize = () => world.resize();
      window.addEventListener("resize", resize);
      window.addEventListener("ball-arena-entry-state", syncEntryState);
      syncEntryState();
      const onDown = (e: KeyboardEvent) => {
        if (!canRunFrame()) return;
        unlockAudio();
        const key = e.key.toLowerCase();
        const target = e.target;
        const editingText = target instanceof HTMLElement &&
          (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
        if (!editingText && key === "e" && riftGateNearbyRef.current && !sessionRef.current) {
          e.preventDefault();
          toggleActiveMap();
          return;
        }
        if (!editingText && key === "h" && !sessionRef.current) {
          e.preventDefault();
          hiEmoteUntilRef.current = performance.now() + 2400;
          return;
        }
        if (key === "shift") {
          keysRef.current.add(key);
          return;
        }
        if (["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(key)) {
          e.preventDefault();
          keysRef.current.add(key);
        }
      };
      const onUp = (e: KeyboardEvent) => {
        keysRef.current.delete(e.key.toLowerCase());
      };
      window.addEventListener("keydown", onDown);
      window.addEventListener("keyup", onUp);
      const onVisibilityChange = () => applyLifecycleEvent({ type: "visibility", visible: !document.hidden });
      const onPageHide = () => applyLifecycleEvent({ type: "visibility", visible: false });
      const onPageShow = () => applyLifecycleEvent({ type: "visibility", visible: !document.hidden });
      const onWindowBlur = () => clearInputState();
      const canvas = host.querySelector<HTMLCanvasElement>("canvas.gl");
      const onWebglContextLost = (event: Event) => {
        event.preventDefault();
        applyLifecycleEvent({ type: "webgl-context", lost: true });
        setNotice("Graphics context lost. Waiting for the browser to restore the arena…");
      };
      const onWebglContextRestored = () => {
        try {
          world.resize();
          applyLifecycleEvent({ type: "webgl-context", lost: false });
          setNotice("Graphics restored. Arena resumed.");
        } catch {
          setRendererRecovering(true);
          setNotice("Graphics recovery failed. Refresh the page to restart the arena.");
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("pagehide", onPageHide);
      window.addEventListener("pageshow", onPageShow);
      window.addEventListener("blur", onWindowBlur);
      canvas?.addEventListener("webglcontextlost", onWebglContextLost);
      canvas?.addEventListener("webglcontextrestored", onWebglContextRestored);
      tick = (now: number) => {
        frameScheduled = false;
        if (disposed || !canRunFrame()) return;
        const frameDeltaMs = lastFrameRef.current ? Math.max(0, now - lastFrameRef.current) : 16;
        const dt = Math.min(0.05, frameDeltaMs / 1000);
        lastFrameRef.current = now;
        const keys = keysRef.current;
        const { x: inputX, z: inputZ } = playerMoveInput(keys, touchMoveRef.current);
        const inputLength = Math.hypot(inputX, inputZ);
        const targetX = inputLength > 1 ? inputX / inputLength : inputX;
        const targetZ = inputLength > 1 ? inputZ / inputLength : inputZ;
        const smoothing = 1 - Math.exp(-dt * (inputLength > 0.04 ? 11 : 15));
        smoothedMoveRef.current.x += (targetX - smoothedMoveRef.current.x) * smoothing;
        smoothedMoveRef.current.z += (targetZ - smoothedMoveRef.current.z) * smoothing;
        let dx = smoothedMoveRef.current.x;
        let dz = smoothedMoveRef.current.z;
        const moveLength = Math.hypot(dx, dz);
        if (moveLength > 1) { dx /= moveLength; dz /= moveLength; }
        if (moveLength > 0.13) facingRef.current = Math.atan2(dx, dz);
        if (!sessionRef.current) {
          if (moveLength > 0.13) {
            if (now - stepAudioRef.current > 390) {
              stepAudioRef.current = now;
              sfx("footstep");
            }
            const mapLimit = activeMapRef.current === "rift" ? 18.6 : 13;
          const mapDepth = activeMapRef.current === "rift" ? 18.6 : 15.5;
          playerPosRef.current = {
            x: Math.max(-mapLimit, Math.min(mapLimit, playerPosRef.current.x + dx * dt * 5.5)),
            z: Math.max(-mapDepth, Math.min(mapDepth, playerPosRef.current.z + dz * dt * 5.5)),
          };
          }
          const gateZ = activeMapRef.current === "lobby" ? -12.6 : -17.0;
          const gateNearby = Math.hypot(playerPosRef.current.x, playerPosRef.current.z - gateZ) <= 3.3;
          if (riftGateNearbyRef.current !== gateNearby) {
            riftGateNearbyRef.current = gateNearby;
            setRiftGateNearby(gateNearby);
          }
          let near = -1;
          if (activeMapRef.current === "lobby") {
            for (let i = 0; i < RIVALS.length; i++) {
              const rival = RIVALS[i];
              if (Math.hypot(playerPosRef.current.x - rival.x, playerPosRef.current.z - rival.z) <= 2.9) {
                near = i;
                break;
              }
            }
          }
          const nearState = near >= 0 ? near : null;
          if (nearbyRivalRef.current !== nearState) {
            nearbyRivalRef.current = nearState;
            setNearbyRival(nearState);
          }
        } else if (nearbyRivalRef.current !== null) {
          nearbyRivalRef.current = null;
          setNearbyRival(null);
        }
        const s = sessionRef.current;
        if (s) {
          const fight = s.fight;
          if (fight && fight.active[0] && fight.active[1]) {
            const previous = previousHpRef.current;
            const currentHp: [number, number] = [fight.hp[0], fight.hp[1]];
            if (previous) {
              if (currentHp[0] < previous[0] - 0.01 || currentHp[1] < previous[1] - 0.01) sfx("hit");
              else if (currentHp[0] > previous[0] + 0.01 || currentHp[1] > previous[1] + 0.01) sfx("heal");
            }
            previousHpRef.current = currentHp;
          } else {
            previousHpRef.current = null;
          }
          if (!(adminMode && adminPausedRef.current && s.flow === "fight")) advanceSession(s, dt, (cost) => {
            if (diamondsRef.current < cost) return false;
            diamondsRef.current -= cost;
            setDiamonds(diamondsRef.current);
            return true;
          });
          if (!adminMode && s.flow === "end" && rewardedSessionRef.current !== s) {
            rewardedSessionRef.current = s;
            sfx(s.matchWinner === s.viewSide ? "win" : "lose");
            const hasValidResult = (s.matchWinner === 0 || s.matchWinner === 1)
              && Boolean(s.ballName[0] && s.ballName[1]);
            if (!hasValidResult) {
              setNotice("Match ended without a valid result. No rewards or history were saved.");
            } else {
              try {
                const saved = loadSave();
                saved.coins += s.coins;
                saved.diamonds = diamondsRef.current;
                saved.xp += s.xp;
                saved.matches += 1;
                if (s.matchWinner === s.viewSide) saved.wins += 1;
                const playerSide = s.viewSide;
                const rivalSide: 0 | 1 = playerSide === 0 ? 1 : 0;
                const matchRecord = createMatchRecord({
                  at: Date.now(),
                  opponent: s.names[rivalSide],
                  // This game's draft is per-round; label the last round's choices honestly.
                  ball: s.ballName[playerSide],
                  oppBall: s.ballName[rivalSide],
                  win: s.matchWinner === playerSide,
                  // Local bot duels are not ranked; do not fabricate trophy changes.
                  trophies: 0,
                  seed: s.seed,
                  damage: s.matchDamage[playerSide],
                });
                saved.history = appendMatchRecord(saved.history, matchRecord);
                writeSave(saved);
                setCoins(saved.coins);
                if (cloudSyncRef.current) {
                  void syncArenaSave(saved).then((merged) => {
                    setCoins(merged.coins);
                    setDiamonds(merged.diamonds);
                    diamondsRef.current = merged.diamonds;
                  }).catch(() => setNotice("Match saved locally, but cloud sync failed."));
                }
              } catch { setNotice("Match finished, but progress could not be saved on this device."); }
            }
          }
          if (now - lastUiRef.current > 100) {
            lastUiRef.current = now;
            setView(publicView(s));
          }
        }
        const current = sessionRef.current;
        const v = current ? publicView(current) : null;
        const frame = current ? renderFrame(current) : null;
        for (const fx of frame?.effects ?? []) {
          const played = playedFxKeysRef.current;
          if (played.keys.has(fx.key)) continue;
          played.keys.add(fx.key);
          played.queue.push(fx.key);
          if (played.queue.length > 120) {
            const oldest = played.queue.shift();
            if (oldest) played.keys.delete(oldest);
          }
          if (fx.sound) sfx(fx.sound);
          else if (fx.type >= 6) sfx("ability");
        }
        const adminAId = adminMode && current ? current.offers[0][0] : undefined;
        const adminBId = adminMode && current ? current.offers[1][0] : undefined;
        const mine = adminMode && adminAId ? ballMapRef.current.get(adminAId) ?? null : v?.myBall ? ballMapRef.current.get(v.myBall) ?? null : null;
        const opponent = adminMode && adminBId ? ballMapRef.current.get(adminBId) ?? null : v?.oppBall ? ballMapRef.current.get(v.oppBall) ?? null : null;
        const draw: DrawState = {
          mode: current ? "arena" : activeMapRef.current === "rift" ? "rift" : "lobby",
          px: playerPosRef.current.x,
          pz: playerPosRef.current.z,
          face: facingRef.current,
          moving: moveLength > 0.13,
          running: moveLength > 0.13 && keysRef.current.has("shift"),
          emote: current?.flow === "end"
            ? (current.matchWinner === 0 ? "win" : "lose")
            : hiEmoteUntilRef.current > performance.now() ? "wave" : "",
          camYaw: 0,
          colors: PLAYER_COLORS,
          bots: LOBBY_BOTS,
          quality: world.quality,
          aimDrag: v?.flow === "aim" ? 1 : 0,
          ents: frame?.ents ?? [],
          effects: frame?.effects ?? [],
          ballA: mine,
          ballB: opponent,
          arrow: frame?.arrow ?? null,
          shake: reduceMotionRef.current ? 0 : current?.fight && current.fight.over ? 0.2 : 0,
          reduceMotion: reduceMotionRef.current,
          finisher: 0,
          winner: current?.roundWinner ?? -1,
          spectate: null,
          oppColor: "#ff3b5c",
        };
        world.update(dt, draw, frameDeltaMs);
        if (world.quality !== qualityRef.current) {
          qualityRef.current = world.quality;
          setQuality(world.quality);
        }
        scheduleFrame();
      };
      scheduleFrame();
      return () => {
        disposed = true;
        stopFrame();
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("pagehide", onPageHide);
        window.removeEventListener("pageshow", onPageShow);
        window.removeEventListener("blur", onWindowBlur);
        canvas?.removeEventListener("webglcontextlost", onWebglContextLost);
        canvas?.removeEventListener("webglcontextrestored", onWebglContextRestored);
        window.removeEventListener("resize", resize);
        window.removeEventListener("ball-arena-entry-state", syncEntryState);
        window.removeEventListener("keydown", onDown);
        window.removeEventListener("keyup", onUp);
        world.destroy();
        worldRef.current = null;
      };
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "3D renderer could not start on this device.");
    }
  }, [adminMode]);

  useEffect(() => {
    qualityRef.current = quality;
    const world = worldRef.current;
    if (world && world.quality !== quality) world.setQuality(quality, autoQualityRef.current);
  }, [quality]);

  const changeGraphicsQuality = useCallback((next: "low" | "medium" | "high") => {
    // Choosing a concrete preset in the HUD intentionally locks that preset.
    autoQualityRef.current = false;
    setAutoQuality(false);
    qualityRef.current = next;
    worldRef.current?.setQuality(next, false);
    setQuality(next);
    try {
      const saved = loadSave();
      saved.settings.quality = next;
      writeSave(saved);
    } catch {
      // Keep the current in-memory quality when local storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (view?.flow !== "aim" || view.myAim === null) return;
    const degrees = ((Math.round(view.myAim * 180 / Math.PI) % 360) + 360) % 360;
    setAim(degrees);
  }, [view?.flow, view?.myAim]);

  const flow = view?.flow;
  const selected = view?.offers[view.picked];
  const selectedBall = selected ? ballMapRef.current.get(selected) : undefined;
  const opponentBall = view?.oppBall ? ballMapRef.current.get(view.oppBall) : undefined;

  return (
    <main className="game-shell">
      <div className="world-host" ref={hostRef} aria-label="3D BALL ARENA world" />
      {rendererRecovering && <div className="renderer-recovery" role="status" aria-live="polite" aria-atomic="true">
        <span className="renderer-recovery-icon" aria-hidden="true">↻</span>
        <strong>GRAPHICS RECOVERY</strong>
        <p>The 3D graphics context is unavailable. Waiting for the browser to restore the arena.</p>
      </div>}
      <div className="game-vignette" />
      <header className={"topbar" + (mode === "free-roam" ? " topbar-main" : "")}>
        <div className="brand-mark"><img className="brand-wordmark" src="/brand/ball-arena-wordmark.svg" alt="BALL ARENA — Physics Duel League" /></div>
        {mode !== "admin" && <nav className="game-nav" aria-label="Player hub">
          {PLAYER_HUB_NAV.map((item) => {
            const guestProfile = item.key === "profile" && (!currentUser || currentUser.isDevFallback);
            const destination = guestProfile ? "/login?callbackURL=" + encodeURIComponent(item.href) : item.href;
            return <a key={item.key} className="hub-icon-link" href={destination} title={guestProfile ? "Sign in to open your profile" : item.title} aria-label={guestProfile ? "Sign in to open your profile" : item.title}>
              <HubLogo kind={guestProfile ? "login" : item.icon} />
              <span className="hub-icon-label">{guestProfile ? "SIGN IN" : item.label}</span>
            </a>;
          })}
        </nav>}
        {mode === "admin" ? <a className="admin-route-link" href="/1v1/" title="Return to standard duel mode">↗ DUEL</a> : mode === "duel" && ownerToolsAvailable ? <a className="admin-route-link" href="/1v1/admin" title="Owner-only bot and ball-pack testing lab" aria-label="Open owner-only pack testing lab">⚙ OWNER LAB</a> : null}
        <div className="wallet">{view?.flow === "fight" && <button className={"speed-vote-button" + (view.matchSpeed === 2 ? " active" : "")} onClick={toggleMatchSpeed} aria-pressed={view.matchSpeed === 2} title="Both sides must approve 2x speed"><strong>2×</strong><span>{view.matchSpeed === 2 ? "BOTH READY" : "MATCH SPEED"}</span></button>}<span title={infiniteDiamonds ? "Infinite diamonds enabled" : "Diamonds"}>◈ {infiniteDiamonds ? "∞" : diamonds.toLocaleString()}</span><span title={infiniteCoins ? "Infinite coins enabled" : "Coins"}>● {infiniteCoins ? "∞" : coins.toLocaleString()}</span><button className="icon-button sound-toggle" onClick={() => { const next = !audioMuted; setAudioMuted(next); setMuted(next); try { const saved = loadSave(); saved.settings.sound = !next; writeSave(saved); } catch { /* keep the in-memory toggle */ } }} aria-label={audioMuted ? "Enable sound" : "Mute sound"}>{audioMuted ? "◌" : "♫"}</button><button className="icon-button" onClick={() => { const next = quality === "medium" ? "high" : quality === "high" ? "low" : "medium"; changeGraphicsQuality(next); }} aria-label={autoQuality ? "Automatic graphics quality, currently " + quality + ". Click to lock a fixed preset." : "Change fixed graphics quality"} title={autoQuality ? "Auto adjusts after sustained frame-time changes; choose a fixed preset with this button." : "Fixed preset active. Select Auto in Settings to enable adaptive quality."}>◉ {autoQuality ? "AUTO " : ""}{quality.toUpperCase()}</button></div>
      </header>

      {!view && mode === "free-roam" && <section className="world-guide" aria-label="Arena briefing">
        <div className="world-guide-topline">
          <span className="eyebrow">{activeMap === "rift" ? "MVM WORLD EXPANSION" : "ARENA FORGE"} <i> / {activeMap === "rift" ? "002" : "001"}</i></span>
          <span className="world-guide-live"><i className="status-dot" /> ARENA READY</span>
        </div>
        <h1>{activeMap === "rift" ? <>ENTER THE <em>RIFT EXPANSE.</em></> : <>ENTER THE <em>ARENA.</em></>}</h1>
        <p>{activeMap === "rift" ? "A new MVM world built around the Eclipse Ring, a fractured portal, a rail bridge and twelve purpose-placed landmarks. Explore freely; start duels from the social lobby." : "One ball. One launch. No second chances. Find a rival and let physics decide."}</p>
        <div className="world-guide-metrics">
          <div><strong>{String(RIVALS.length).padStart(2, "0")}</strong><span>RIVALS</span></div>
          <div><strong>{String(availablePacks.reduce((count, pack) => count + pack.balls.length, 0)).padStart(2, "0")}</strong><span>BALL TYPES</span></div>
          <div><strong>{activeMap === "rift" ? "RIFT" : "1V1"}</strong><span>{activeMap === "rift" ? "NEW MAP" : "DUEL MODE"}</span></div>
        </div>
        <div className="world-guide-objective">
          <span className="world-guide-step">01</span>
          <span><b>{activeMap === "rift" ? "EXPLORE THE LANDMARKS" : "FIND YOUR TARGET"}</b><small>{activeMap === "rift" ? "Walk the ring, inspect the relics and follow the perimeter route." : "Move close to a rival to unlock the challenge."}</small></span>
          <span className="world-guide-arrow" aria-hidden="true">↗</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={toggleActiveMap}
            aria-label={activeMap === "rift" ? "Return to the social lobby" : "Explore the new Rift Expanse map"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
              width: "100%", minWidth: 0, textAlign: "left", padding: "12px 14px",
              color: "#e7f4ff", background: activeMap === "rift" ? "linear-gradient(110deg,#182034,#111a27)" : "linear-gradient(110deg,#122e3a,#17182e)",
              border: "1px solid " + (activeMap === "rift" ? "#394762" : "#2f7d91"), borderRadius: 8,
              cursor: "pointer", font: "inherit",
            }}
          >
            <span style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
              <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 38, height: 38, flex: "0 0 38px", borderRadius: 7, background: "#0a1420", border: "1px solid #2b5165", color: "#73e7fa", fontSize: 20 }}>{activeMap === "rift" ? "⌂" : "⟁"}</span>
              <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <strong style={{ fontSize: 11, letterSpacing: ".08em" }}>{activeMap === "rift" ? "RETURN TO SOCIAL LOBBY" : "EXPLORE RIFT EXPANSE"}</strong>
                <small style={{ color: "#9bafc4", fontSize: 10, lineHeight: 1.35 }}>{riftGateNearby ? "PRESS E TO USE THE NEARBY GATE" : activeMap === "rift" ? "Return via the Titan Gate or switch maps here" : "New authored map · 12 world landmarks"}</small>
              </span>
            </span>
            <span aria-hidden="true" style={{ color: "#7deaff", fontSize: 20 }}>↗</span>
          </button>
          <a
            href="/mvm-model-lab"
            style={{ display: "grid", alignContent: "center", gap: 5, padding: "10px 12px", minWidth: 92, borderRadius: 8, border: "1px solid #2b3549", background: "#0b111b", color: "#b8c8dd", textDecoration: "none", textAlign: "center", fontSize: 10, fontWeight: 900, letterSpacing: ".08em" }}
          >
            <span aria-hidden="true" style={{ fontSize: 17, color: "#b59aff" }}>◈</span>
            MODEL LAB
            <small style={{ color: "#74889f", fontSize: 9, fontWeight: 700 }}>18 GLBs</small>
          </a>
        </div>
        <div className="world-guide-controls" aria-label="Movement controls">
          <span className="world-guide-controls-label">MOVE</span>
          <span className="world-guide-keys" aria-hidden="true"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>
          <span className="world-guide-controls-or">OR</span>
          <span className="world-guide-stick" aria-hidden="true"><i /></span>
          <span className="world-guide-controls-label">LEFT STICK</span>
        </div>
      </section>}

      {!view && mode === "free-roam" && <div
        className="move-stick"
        role="application"
        aria-label="Movement joystick"
        onPointerDown={onStickPointerDown}
        onPointerMove={updateStickFromPointer}
        onPointerUp={onStickPointerUp}
        onPointerCancel={onStickPointerUp}
        onLostPointerCapture={onStickPointerUp}
      >
        <span className="stick-knob" style={{ transform: "translate(" + stickOffset.x + "px, " + stickOffset.y + "px)" }} />
      </div>}

      {!view && mode === "free-roam" && <button
        className="avatar-emote-button"
        type="button"
        onClick={() => { hiEmoteUntilRef.current = performance.now() + 2400; }}
        aria-label="Make BOPPO wave hello"
      >
        <span aria-hidden="true">👋</span><strong>SAY HI</strong><kbd>H</kbd>
      </button>}

      {!view && mode === "free-roam" && nearbyRival !== null && <button className="challenge-button" onClick={() => startMatch(RIVALS[nearbyRival].name)}>
        <span className="challenge-kicker">RIVAL IN RANGE</span><strong>⚔ CHALLENGE {RIVALS[nearbyRival].name}</strong><small>Tap to start a 1v1 duel</small>
      </button>}

      <div className="orientation-warning">
        <div className="rotate-icon">↻</div>
        <strong>ROTATE TO LANDSCAPE</strong>
        <span>Ball Arena is designed for horizontal play.</span>
        <small>Turn your phone sideways to enter the arena.</small>
      </div>

      {view && flow === "intro" && <div className="match-found-banner" role="status" aria-live="polite">
        <i className="intro-spinner" aria-hidden="true" /><span>CHALLENGE ACCEPTED</span><strong>You vs {view.names[1]}</strong><small>Preparing arena · Loading ball selections…</small>
      </div>}

      {view && view.flow !== "intro" && (
        <MatchPhaseUI
          flow={view.flow}
          view={view as any}
          aim={aim}
          setAim={setAim}
          send={send as any}
          ballMap={ballMapRef.current}
          selectedBall={selectedBall}
          opponentBall={opponentBall}
          reduceMotion={reduceMotion}
          opponentName={opponentName}
          onInspect={setInspectedBall}
          onRematch={() => startMatch(opponentName)}
          onLobby={() => {
            sessionRef.current = null;
            setView(null);
            nearbyRivalRef.current = null;
            setNearbyRival(null);
            setNotice("Back to the plaza.");
          }}
          coinsReward={sessionRef.current?.coins ?? 0}
          xpReward={sessionRef.current?.xp ?? 0}
          abilityTriggerLabel={abilityTriggerLabel}
          actionLabel={actionLabel}
          abilityGlyph={abilityGlyph}
        />
      )}

      <BallInspectDialog ball={inspectedBall} onClose={closeBallInspect} statusLabel={inspectedBall ? (view?.flow === "pick" && view.offers.includes(inspectedBall.id) ? view.confirmed && view.offers[view.picked] === inspectedBall.id ? "MATCH PICK LOCKED" : "AVAILABLE FOR THIS MATCH" : "BALL CODEX · DETAILS ONLY") : undefined} />

      {adminMode && <section className="admin-console" aria-label="1v1 admin control panel">
        <div className="admin-console-head"><span>ADMIN ROUTE · /1v1/admin</span><strong>1V1 CONTROL DECK</strong></div>
        <div className="admin-select-grid">
          <label>PLAYER A
            <select value={adminBallA} onChange={(e) => setAdminBallA(e.target.value)}>
              {availablePacks.map((pack) => <optgroup key={pack.meta.id} label={pack.meta.name}>{pack.balls.map((ball) => <option key={ball.id} value={ball.id}>{ball.name.en} · {ball.rarity}</option>)}</optgroup>)}
            </select>
          </label>
          <label>PLAYER B
            <select value={adminBallB} onChange={(e) => setAdminBallB(e.target.value)}>
              {availablePacks.map((pack) => <optgroup key={pack.meta.id} label={pack.meta.name}>{pack.balls.map((ball) => <option key={ball.id} value={ball.id}>{ball.name.en} · {ball.rarity}</option>)}</optgroup>)}
            </select>
          </label>
        </div>
        <label className="admin-difficulty">SIMULATION PRESET
          <select value={adminDifficulty} onChange={(e) => setAdminDifficulty(e.target.value as Difficulty)}>
            <option value="easy">EASY</option><option value="normal">NORMAL</option><option value="hard">HARD</option>
          </select>
        </label>
        <div className="admin-action-row"><button className="admin-primary" onClick={() => startAdminDuel()}>START SELECTED MATCH ↗</button><button onClick={() => startAdminDuel(true)}>🎲 RANDOM PACK MATCH</button></div>
        {view && flow === "aim" && <>
          <div className="admin-angle"><label>PLAYER A LAUNCH ANGLE <b>{adminAimA}°</b><input type="range" min="0" max="359" value={adminAimA} onChange={(e) => updateAdminAim(Number(e.target.value))} /></label></div>
          <div className="admin-bot-status"><span className="admin-bot-pulse" /> PLAYER B BOT · AUTO AIM / AUTO LOCK</div>
          <button className="admin-primary" onClick={lockAdminLaunch}>LOCK A · BOT AUTO-LAUNCH ⚡</button>
        </>}
        {view && flow === "fight" && <>
          <div className="admin-action-row">
            <button onClick={toggleAdminPause}>{adminPaused ? "▶ RESUME" : "Ⅱ PAUSE"}</button>
            <button onClick={() => { setAdminPaused(false); adminPausedRef.current = false; startAdminDuel(); }}>↻ RESET FIGHT</button>
          </div>
          <div className="admin-action-row">
            <button onClick={() => adjustAdminHealth(0, -25)}>A −25 HP</button>
            <button onClick={() => adjustAdminHealth(0, 25)}>A +25 HP</button>
            <button onClick={() => adjustAdminHealth(1, -25)}>B −25 HP</button>
            <button onClick={() => adjustAdminHealth(1, 25)}>B +25 HP</button>
          </div>
          <div className="admin-action-row">
            <button onClick={() => forceAdminWinner(0)}>FORCE A WIN</button>
            <button onClick={() => forceAdminWinner(1)}>FORCE B WIN</button>
          </div>
        </>}
        {view && (flow === "round" || flow === "end") && <button className="admin-primary" onClick={() => startAdminDuel()}>REMATCH SELECTED BALLS ↗</button>}
      </section>}

      <footer className="bottom-status"><span><i className="status-dot" /> SYSTEM ONLINE</span><span>{adminMode ? "PACK LAB · AI AUTO-AIM · ANY PACK / ANY BALL" : mode === "duel" ? "DIRECT 1V1 DUEL SIMULATION" : "LOCAL RIVAL DUELS · WALK TO CHALLENGE"}</span></footer>
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice">×</button></div>}
    </main>
  );
}