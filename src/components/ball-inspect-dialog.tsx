import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Action, BallDef } from "@/sim/types";

const RARITY: Record<BallDef["rarity"], string> = {
  common: "#aebdce", rare: "#58c9ff", epic: "#c39aff", legendary: "#f5c96a", mythic: "#ff718b",
};
function glyph(action?: Action): string {
  if (!action) return "◎";
  switch (action.type) {
    case "damage": return "✦"; case "heal": return "✚"; case "applyStatus": return action.status === "shield" ? "⛨" : "✧";
    case "modifyStat": return "↗"; case "knockback": return "↯"; case "pull": return "⟲"; case "dash": return "➤";
    case "teleport": return "⌁"; case "grow": return "⤢"; case "shrink": return "⤡"; case "split": return "✣";
    case "spawnZone": return action.shape === "web" ? "✳" : action.shape === "ring" ? "◎" : "▱";
    case "spawnProjectile": return action.pattern === "homing" ? "➶" : "➤"; case "spawnTurret": return "⌖";
    case "spawnSummon": return "✧"; case "spawnOrbiter": return "⟳"; case "createBeam": case "chainLightning": return "ϟ";
    case "explode": return "✹"; case "lifesteal": return "♥"; case "thorns": return "✥"; case "reviveOnce": return "↻";
    case "randomChoice": return "⁕"; case "repeat": return "⟲"; case "scaleWith": return "⇧";
  }
}
function actionName(action?: Action): string {
  if (!action) return "Physics impact";
  switch (action.type) {
    case "damage": return "Burst damage"; case "heal": return "Regeneration";
    case "applyStatus": return action.status.replace(/([A-Z])/g, " $1");
    case "modifyStat": return action.stat + (action.mode === "mul" ? " boost" : " shift");
    case "knockback": return "Knockback"; case "pull": return "Gravity pull"; case "dash": return "Dash";
    case "teleport": return "Phase " + action.mode; case "grow": return "Overgrow"; case "shrink": return "Shrink";
    case "split": return "Split"; case "spawnZone": return action.shape + " zone"; case "spawnProjectile": return action.pattern + " shot";
    case "spawnTurret": return "Turret"; case "spawnSummon": return "Summon"; case "spawnOrbiter": return "Orbiters";
    case "createBeam": return "Energy beam"; case "chainLightning": return "Chain lightning"; case "explode": return "Explosion";
    case "lifesteal": return "Lifesteal"; case "thorns": return "Thorns"; case "reviveOnce": return "Second chance";
    case "randomChoice": return "Random chaos"; case "repeat": return "Combo"; case "scaleWith": return "Scaling power";
  }
}
function geometryFor(shape: string): THREE.BufferGeometry {
  switch (shape.toLowerCase()) {
    case "die": return new THREE.BoxGeometry(1.42, 1.42, 1.42, 2, 2, 2);
    case "crystal": case "diamond": return new THREE.OctahedronGeometry(1, 0);
    case "faceted": return new THREE.DodecahedronGeometry(1, 0);
    case "shield": return new THREE.IcosahedronGeometry(.98, 0);
    case "spiky": return new THREE.IcosahedronGeometry(1, 1);
    default: return new THREE.SphereGeometry(1, 36, 28);
  }
}

function BallPreview3D({ ball }: { ball: BallDef }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" }); }
    catch { el.dataset.previewUnavailable = "true"; return; }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 30);
    camera.position.set(0, .12, 5.2); camera.lookAt(0, 0, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight("#e6f5ff", "#101522", 2.1));
    const key = new THREE.DirectionalLight("#ffffff", 3); key.position.set(-3, 4, 5); scene.add(key);
    const rim = new THREE.PointLight(ball.visual.accentColor, 2.5, 9); rim.position.set(2, -1, 2.3); scene.add(rim);
    const root = new THREE.Group(); scene.add(root);
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: ball.visual.baseColor, emissive: ball.visual.accentColor,
      emissiveIntensity: Math.min(.95, Math.max(0, ball.visual.emissive * .6)),
      roughness: /glass|prism|ice/i.test(ball.id + " " + ball.visual.pattern) ? .19 : .31,
      metalness: .42, clearcoat: .9, clearcoatRoughness: .22,
    });
    root.add(new THREE.Mesh(geometryFor(ball.visual.shape), shellMat));
    const accent = new THREE.MeshStandardMaterial({ color: ball.visual.accentColor, emissive: ball.visual.accentColor, emissiveIntensity: .48, metalness: .62, roughness: .28 });
    const rarity = new THREE.MeshBasicMaterial({ color: RARITY[ball.rarity], transparent: true, opacity: .9 });
    if (ball.visual.shape.toLowerCase() === "ringed" || /ring|orbit|halo/i.test(ball.visual.pattern + " " + ball.id)) {
      for (let i = 0; i < 2; i++) {
        const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.02 + i * .12, .025, 7, 56), i ? accent : rarity);
        orbit.rotation.x = Math.PI * (.23 + i * .2); orbit.rotation.y = Math.PI * (.15 + i * .32); root.add(orbit);
      }
    } else {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(.93, .018, 6, 56), accent); seam.rotation.x = 1.04; root.add(seam);
    }
    if (["spiky", "horned"].includes(ball.visual.shape.toLowerCase()) || /jolt|sprout|thorn/i.test(ball.id)) {
      const count = ball.visual.shape.toLowerCase() === "spiky" ? 8 : 5;
      const spikeGeo = new THREE.ConeGeometry(.14, .38, 5);
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        const spike = new THREE.Mesh(spikeGeo, accent);
        spike.position.set(Math.cos(angle) * .78, Math.sin(angle) * .7, .12); spike.rotation.z = -angle + Math.PI / 2; root.add(spike);
      }
    }
    if (ball.visual.face !== "none" && ball.visual.shape.toLowerCase() !== "shield") {
      const face = new THREE.MeshStandardMaterial({ color: "#111923", roughness: .35 });
      const eyeGeo = new THREE.SphereGeometry(.075, 10, 8);
      for (const x of [-.24, .24]) { const eye = new THREE.Mesh(eyeGeo, face); eye.position.set(x, .12, .88); root.add(eye); }
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(.28, ball.visual.face === "angry" ? .045 : .065, .035), face);
      mouth.position.set(0, -.17, .9); root.add(mouth);
    }
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.16, 1.28, .12, 36),
      new THREE.MeshStandardMaterial({ color: "#131e2c", metalness: .8, roughness: .32, emissive: ball.visual.accentColor, emissiveIntensity: .12 }),
    );
    plinth.position.y = -1.12; root.add(plinth);
    const plinthRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, .022, 7, 40), rarity);
    plinthRing.rotation.x = Math.PI / 2; plinthRing.position.y = -1.055; root.add(plinthRing);
    const resize = () => {
      const width = Math.max(1, el.clientWidth), height = Math.max(1, el.clientHeight);
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = 0;
    const tick = (now: number) => {
      if (now - last > 32 || !last) {
        const dt = last ? Math.min(.06, (now - last) / 1000) : 0;
        if (!reduced) { root.rotation.y += dt * .46; root.rotation.x = Math.sin(now * .00035) * .055; }
        renderer.render(scene, camera); last = now;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf); observer.disconnect();
      root.traverse(node => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          for (const mat of (Array.isArray(node.material) ? node.material : [node.material])) mat.dispose();
        }
      });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [ball]);
  return <div ref={host} className="ball-inspect-preview" aria-label={"3D preview of " + ball.name.en}
    style={{ background: "radial-gradient(circle at 50% 35%, " + ball.visual.accentColor + "22, transparent 56%), linear-gradient(145deg, #111a27, #080d14)" }}>
    <span className="ball-preview-fallback" aria-hidden="true" style={{ background: "radial-gradient(circle at 32% 24%, #fff 0%, " + ball.visual.baseColor + " 25%, " + ball.visual.accentColor + " 100%)" }} />
    <span className="ball-preview-stage-label">HOLOGRAPHIC PREVIEW</span>
  </div>;
}

export interface BallInspectDialogProps {
  ball: BallDef | null; onClose: () => void; actionLabel?: string; actionDisabled?: boolean; onAction?: () => void; statusLabel?: string;
}
export function BallInspectDialog({ ball, onClose, actionLabel, actionDisabled = false, onAction, statusLabel }: BallInspectDialogProps) {
  useEffect(() => {
    if (!ball) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", keydown); };
  }, [ball, onClose]);
  if (!ball) return null;
  const stats = [
    { key: "HP", value: ball.stats.hp, max: 220, label: "Health pool" },
    { key: "SPD", value: ball.stats.speed, max: 22, label: "Movement speed" },
    { key: "MASS", value: ball.stats.mass, max: 10, label: "Mass" },
    { key: "DMG", value: ball.stats.contactDamage, max: 16, label: "Contact damage" },
  ];
  return <div className="ball-inspect-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="ball-inspect-dialog" role="dialog" aria-modal="true" aria-labelledby="ball-inspect-title">
      <header className="ball-inspect-header"><div><span className="portal-kicker">BALL CODEX / {ball.id.toUpperCase()}</span><span className={"rarity-pill rarity-" + ball.rarity}>{ball.rarity.toUpperCase()} CLASS</span></div><button className="ball-inspect-close" type="button" onClick={onClose} aria-label="Close ball details">×</button></header>
      <div className="ball-inspect-main">
        <div className="ball-inspect-art"><BallPreview3D ball={ball} /><div className="ball-inspect-id"><span>COLLECTION SIGNAL</span><strong style={{ color: RARITY[ball.rarity] }}>{ball.visual.shape.toUpperCase()}</strong></div></div>
        <div className="ball-inspect-copy">
          <h2 id="ball-inspect-title">{ball.name.en}</h2><p className="ball-inspect-description">{ball.description.en}</p>
          <div className="ball-inspect-tags"><span>{ball.ai_hints.role.toUpperCase()} ROLE</span>{ball.tags.slice(0, 3).map(tag => <span key={tag}>{tag.toUpperCase()}</span>)}</div>
          <div className="ball-inspect-section-head"><strong>COMBAT ATTRIBUTES</strong><span>SIM DATA / LIVE SOURCE</span></div>
          <div className="ball-inspect-stats">{stats.map(stat => <div className="ball-inspect-stat" key={stat.key}>
            <div><span>{stat.key}</span><strong>{Number.isInteger(stat.value) ? stat.value : stat.value.toFixed(1)}</strong></div>
            <div className="ball-inspect-stat-track" role="progressbar" aria-label={stat.label} aria-valuemin={0} aria-valuemax={stat.max} aria-valuenow={Math.min(stat.max, Math.max(0, stat.value))} aria-valuetext={stat.value + " " + stat.label.toLowerCase()}><span style={{ width: Math.max(0, Math.min(100, stat.value / stat.max * 100)) + "%" }} /></div>
          </div>)}</div>
          <div className="ball-inspect-section-head"><strong>ABILITY SIGNATURE</strong><span>{ball.abilities.length} SKILL{ball.abilities.length === 1 ? "" : "S"}</span></div>
          <div className="ball-inspect-abilities">{ball.abilities.slice(0, 2).map((ability, index) => {
            const action = ability.actions[0], timing = ability.cooldown ?? ability.interval ?? ability.seconds;
            return <div className="ball-inspect-ability" key={ability.trigger + "-" + index}>
              <span className="ball-inspect-glyph" aria-hidden="true">{glyph(action)}</span>
              <div><strong>{actionName(action)}</strong><small>{ability.trigger.replace(/^on/, "").replace(/([A-Z])/g, " $1").trim().toUpperCase()}{timing !== undefined ? " · " + timing.toFixed(1) + "S" : ""}</small></div>
            </div>;
          })}{!ball.abilities.length && <p className="portal-muted">Physics impact · No scripted abilities.</p>}</div>
          {statusLabel && <p className="ball-inspect-status" role="status">{statusLabel}</p>}
          {actionLabel && onAction && <button className="portal-button primary ball-inspect-action" type="button" disabled={actionDisabled} onClick={onAction}>{actionLabel}</button>}
        </div>
      </div>
    </section>
  </div>;
}
