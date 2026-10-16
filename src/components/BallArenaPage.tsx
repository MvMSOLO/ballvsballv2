import { useCallback, useEffect, useRef, useState } from "react";
import type { BallDef } from "../sim/types";
import { CONFIG } from "../config";
import { World } from "../render/world";
import { advanceSession, applyCommand, createSession, publicView, renderFrame, type Session } from "../game/session";
import { enabledBalls } from "../packs/registry";
import { loadSave, writeSave } from "../economy/save";
import { sfx, setAudioLevels, setMuted, unlockAudio } from "../audio/synth";
import { BallInspectDialog } from "@/components/ball-inspect-dialog";
import { MatchPhaseUI } from "@/components/MatchPhaseUI";
import { shouldReduceMotion } from "@/lib/motion-policy";
import type { Action } from "../sim/types";

function abilityTriggerLabel(trigger: string, interval?: number): string {
  if (trigger === "onBallHit") return "ON HIT";
  if (trigger === "onWallHit") return "WALL BOUNCE";
  if (trigger === "onDamaged") return "WHEN HIT";
  if (trigger === "onSpawn") return "SPAWN BURST";
  if (trigger === "onTick") return "PASSIVE · " + (interval ?? 1).toFixed(1) + "s";
  return trigger.replace(/([A-Z])/g, " $1").toUpperCase();
}

function actionLabel(action: Action): string {
  switch (action.type) {
    case "damage": return "BURST";
    case "heal": return "REGEN";
    case "applyStatus": return action.status.toUpperCase();
    case "knockback": return "KNOCKBACK";
    case "explode": return "EXPLOSION";
    case "spawnZone": return action.shape.toUpperCase() + " ZONE";
    case "spawnProjectile": return action.pattern.toUpperCase() + " SHOT";
    default: return action.type.toUpperCase();
  }
}

function abilityGlyph(action?: Action): string {
  if (!action) return "◎";
  if (action.type === "damage") return "✦";
  if (action.type === "heal") return "✚";
  if (action.type === "explode") return "✹";
  return "✧";
}

export type ArenaRouteMode = "free-roam" | "duel" | "admin";

export function BallArenaPage({ mode = "free-roam" }: { mode?: ArenaRouteMode } = {}) {
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== "undefined" && shouldReduceMotion(
      document.documentElement.dataset.reduceMotion === "true",
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const ballMapRef = useRef<Map<string, BallDef>>(new Map());
  const [view, setView] = useState<ReturnType<typeof publicView> | null>(null);
  const [aim, setAim] = useState(90);
  const [notice, setNotice] = useState("");
  const [inspectedBall, setInspectedBall] = useState<BallDef | null>(null);
  const [opponentName, setOpponentName] = useState("NovaByte");
  const [diamonds, setDiamonds] = useState(CONFIG.starterDiamonds);
  const diamondsRef = useRef(diamonds);
  diamondsRef.current = diamonds;

  const startMatch = useCallback((rival: string) => {
    unlockAudio();
    sfx("lock");
    const all = enabledBalls();
    const byId = new Map(all.map((b) => [b.id, b]));
    ballMapRef.current = byId;
    const starter = CONFIG.starterBalls.map((id) => byId.get(id)).filter((b): b is BallDef => Boolean(b));
    const pool = starter.length >= 3 ? starter : all;
    if (pool.length < 2) {
      setNotice("No valid balls loaded.");
      return;
    }
    setOpponentName(rival);
    sessionRef.current = createSession({
      seed: Math.floor(Math.random() * 2_000_000_000),
      pool0: pool,
      pool1: all.length >= 3 ? all : pool,
      names: ["You", rival],
      diff: "normal",
      control: ["human", "bot"],
    });
    setView(publicView(sessionRef.current));
    setNotice("Challenge accepted · " + rival);
  }, []);

  const send = useCallback((cmd: Parameters<typeof applyCommand>[1]) => {
    if (cmd.t !== "aim") sfx("click");
    const s = sessionRef.current;
    if (!s) return;
    const err = applyCommand(s, cmd, (cost) => {
      if (diamondsRef.current < cost) return false;
      diamondsRef.current -= cost;
      setDiamonds(diamondsRef.current);
      return true;
    });
    if (err === "diamonds") setNotice("Not enough diamonds.");
    else if (err) setNotice(String(err));
    else setNotice("");
    setView(publicView(s));
  }, []);

  useEffect(() => {
    const saved = loadSave();
    setDiamonds(saved.diamonds);
    diamondsRef.current = saved.diamonds;
    setMuted(!saved.settings.sound);
    setAudioLevels({ master: saved.settings.master, music: saved.settings.music, ui: saved.settings.ui, sfx: saved.settings.sfx });
  }, []);

  useEffect(() => {
    if (mode === "duel") startMatch("NovaByte");
  }, [mode, startMatch]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let raf = 0;
    try {
      const world = new World(host);
      worldRef.current = world;
      let last = performance.now();
      const tick = (now: number) => {
        if (disposed) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const s = sessionRef.current;
        if (s) {
          advanceSession(s, dt, (cost) => {
            if (diamondsRef.current < cost) return false;
            diamondsRef.current -= cost;
            setDiamonds(diamondsRef.current);
            return true;
          });
          const v = publicView(s);
          setView(v);
          const frame = renderFrame(s);
          world.update(dt, {
            player: { x: 0, z: 0, moving: false, emote: "", camYaw: 0, colors: { skin: "#f3c7a1", shirt: "#ff5a36", pants: "#2f6bff", hat: "#1c2430" }, bots: [], quality: world.quality, aimDrag: v.flow === "aim" ? 1 : 0, ents: frame?.ents ?? [], effects: frame?.effects ?? [], ballA: null, ballB: null, arrow: frame?.arrow ?? null, shake: 0, reduceMotion: false, finisher: 0, winner: -1, spectate: null, oppColor: "#ff3b5c" },
            frameDeltaMs: dt * 1000,
          } as any);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Renderer failed");
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      worldRef.current?.destroy();
      worldRef.current = null;
    };
  }, []);

  const flow = view?.flow ?? "intro";
  const selected = view?.offers?.[view.picked];
  const selectedBall = selected ? ballMapRef.current.get(selected) : undefined;
  const opponentBall = view?.oppBall ? ballMapRef.current.get(view.oppBall) : undefined;

  return (
    <main className="game-shell">
      <div className="world-host" ref={hostRef} aria-label="3D BALL ARENA world" />
      <div className="game-vignette" />
      <header className="topbar">
        <div className="brand-mark">
          <strong>BALL ARENA</strong>
          <small>PHYSICS DUEL</small>
        </div>
        <div className="wallet">
          <span title="Diamonds">◈ {diamonds}</span>
        </div>
      </header>

      {!view && (
        <div className="lobby-panel" style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", zIndex: 3 }}>
          <p className="eyebrow">READY UP</p>
          <h1>BALL <em>ARENA</em></h1>
          <p>Choose your ball. Lock your aim. Let physics settle the fight.</p>
          <button className="primary-button" type="button" onClick={() => startMatch("NovaByte")}>
            QUICK PLAY ↗
          </button>
        </div>
      )}

      {view && flow !== "intro" && (
        <MatchPhaseUI
          flow={flow}
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
            setNotice("Back to lobby.");
          }}
          coinsReward={sessionRef.current?.coins ?? 0}
          xpReward={sessionRef.current?.xp ?? 0}
          abilityTriggerLabel={abilityTriggerLabel}
          actionLabel={actionLabel}
          abilityGlyph={abilityGlyph}
        />
      )}

      <BallInspectDialog ball={inspectedBall} onClose={() => setInspectedBall(null)} />
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">×</button>
        </div>
      )}
    </main>
  );
}
