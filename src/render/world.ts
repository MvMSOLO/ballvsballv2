import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { BallDef } from "../sim/types";
import type { FrameEnt, FrameFx } from "../game/session";
import { previewAim } from "../sim/engine";
import { CONFIG } from "../config";
import { resolveImpactMotion } from "@/lib/motion-policy";
import { createAdaptiveQualityState, stepAdaptiveQuality, type AdaptiveQualityState } from "@/lib/graphics-quality-policy";

export interface AvatarColors {
  skin: string;
  shirt: string;
  pants: string;
  hat: string;
  hatStyle?: string;
  face?: string;
  back?: string;
}

export interface DrawBot {
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  shirt: string;
  emote: string;
  name: string;
}

export interface DrawState {
  mode: "lobby" | "arena";
  px: number;
  pz: number;
  face: number;
  moving: boolean;
  emote: string;
  camYaw: number;
  colors: AvatarColors;
  bots: DrawBot[];
  quality: "low" | "medium" | "high";
  aimDrag: number;
  ents: FrameEnt[];
  effects: FrameFx[];
  ballA: BallDef | null;
  ballB: BallDef | null;
  arrow: number | null;
  shake: number;
  finisher: number;
  winner: -1 | 0 | 1;
  spectate: { ax: number; ay: number; bx: number; by: number } | null;
  oppColor: string;
  showcase?: BallDef | null;
  orbit?: number;
  /** Disable ornamental motion while preserving the deterministic fight and readable hit cues. */
  reduceMotion?: boolean;
  running?: boolean;
}

interface LiveFx {
  key: string;
  type: number;
  magnitude: number;
  impactScale?: number;
  group: THREE.Group;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  ring2?: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  shell?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  core: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
  particles: THREE.Mesh[];
  line?: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  tube?: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  age: number;
  duration: number;
}

interface TrailParticle {
  mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
  material: THREE.MeshBasicMaterial;
  age: number;
  duration: number;
  active: boolean;
  baseOpacity: number;
  baseScale: number;
}

interface Rig {
  group: THREE.Group;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  nameTag?: THREE.Sprite;
  phase: number;
  foreL: THREE.Object3D;
  foreR: THREE.Object3D;
  eyeL: THREE.Object3D;
  eyeR: THREE.Object3D;
  mouth: THREE.Mesh;
  cape: THREE.Group;
  mats: {
    skin: THREE.MeshStandardMaterial;
    shirt: THREE.MeshStandardMaterial;
    pants: THREE.MeshStandardMaterial;
  };
  blink: number;
  modelRoot: THREE.Group | null;
  mixer: THREE.AnimationMixer | null;
  animationActions: Map<string, THREE.AnimationAction>;
  activeAnimation: string;
}

const _v = new THREE.Vector3();

function lambert(color: string, emissive = "#000000", ei = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.58, metalness: 0.16 });
}

/**
 * A small studio-style equirectangular environment provides real reflection
 * information to PBR balls and machined metal without loading any external HDR.
 * The canvas texture is shared across the entire scene and disposed on teardown.
 */
function arenaEnvironmentTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const base = ctx.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, "#101b29");
  base.addColorStop(0.28, "#354454");
  base.addColorStop(0.52, "#9aa6b2");
  base.addColorStop(0.68, "#293746");
  base.addColorStop(1, "#080e17");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 256);

  // Broad softboxes, thin ceiling strips and colored bounce panels create
  // recognizable curved highlights on polished/enamel surfaces.
  const softbox = (x: number, y: number, w: number, h: number, color: string, alpha: number) => {
    const glow = ctx.createLinearGradient(x, y, x + w, y + h);
    glow.addColorStop(0, "rgba(255,255,255,0)");
    glow.addColorStop(0.42, color.replace("ALPHA", String(alpha)));
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 20, y - 18, w + 40, h + 36);
    ctx.fillStyle = color.replace("ALPHA", String(Math.min(1, alpha * 1.5)));
    ctx.fillRect(x, y, w, h);
  };

  softbox(22, 28, 92, 24, "rgba(228,245,255,ALPHA)", 0.38);
  softbox(169, 14, 126, 16, "rgba(255,255,255,ALPHA)", 0.32);
  softbox(356, 38, 74, 20, "rgba(220,245,255,ALPHA)", 0.3);
  softbox(65, 102, 52, 7, "rgba(73,226,255,ALPHA)", 0.32);
  softbox(388, 116, 70, 9, "rgba(255,111,77,ALPHA)", 0.25);
  softbox(208, 168, 100, 10, "rgba(113,158,198,ALPHA)", 0.22);

  ctx.fillStyle = "rgba(14,23,35,.88)";
  ctx.fillRect(0, 72, 512, 14);
  ctx.fillRect(0, 201, 512, 20);
  ctx.fillStyle = "rgba(230,242,255,.20)";
  for (let i = 0; i < 32; i++) {
    const x = i * 16;
    ctx.fillRect(x, 74, 8, 2);
    ctx.fillRect(x + 4, 218, 5, 1);
  }
  ctx.fillStyle = "rgba(6,13,22,.38)";
  ctx.fillRect(0, 238, 512, 18);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

function makeRig(c: AvatarColors): Rig {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: c.skin, roughness: 0.48, metalness: 0.02 });
  const shirt = new THREE.MeshStandardMaterial({ color: c.shirt, roughness: 0.7, metalness: 0.06 });
  const pants = new THREE.MeshStandardMaterial({ color: c.pants, roughness: 0.76, metalness: 0.04 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.4, 6, 14), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.08, 4, 8), skin);
  neck.position.y = 1.46;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 24, 18), skin);
  head.position.y = 1.7;
  head.scale.set(0.96, 1.06, 0.94);
  const eyeWhite = new THREE.MeshStandardMaterial({ color: "#f7f4ee", roughness: 0.25 });
  const iris = new THREE.MeshStandardMaterial({ color: "#142033", roughness: 0.2, emissive: "#3ee0ff", emissiveIntensity: 0.25 });
  const eyeL = new THREE.Group();
  eyeL.position.set(-0.075, 1.73, 0.16);
  const whiteL = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), eyeWhite);
  const irisL = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), iris);
  irisL.position.z = 0.028;
  eyeL.add(whiteL, irisL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.075;
  const browMat = new THREE.MeshStandardMaterial({ color: "#3a2a24", roughness: 0.6 });
  const browL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.014, 0.02), browMat);
  browL.position.set(-0.075, 1.8, 0.19);
  browL.rotation.z = 0.15;
  const browR = browL.clone();
  browR.position.x = 0.075;
  browR.rotation.z = -0.15;
  const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.045, 3, 8), new THREE.MeshStandardMaterial({ color: "#8d4548", roughness: 0.45 }));
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, 1.6, 0.19);
  const armL = new THREE.Group();
  armL.position.set(-0.38, 1.28, 0);
  const upperL = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.14, 4, 8), shirt);
  upperL.position.y = -0.12;
  const foreL = new THREE.Group();
  foreL.position.y = -0.26;
  const foreMeshL = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.14, 4, 8), skin);
  foreMeshL.position.y = -0.12;
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
  handL.position.y = -0.24;
  foreL.add(foreMeshL, handL);
  armL.add(upperL, foreL);
  const armR = armL.clone();
  armR.position.x = 0.38;
  const foreR = armR.children[1] as THREE.Object3D;
  const legL = new THREE.Group();
  legL.position.set(-0.11, 0.7, 0);
  const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.14, 4, 8), pants);
  thigh.position.y = -0.12;
  const shinL = new THREE.Group();
  shinL.position.y = -0.28;
  const shinMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.14, 4, 8), pants);
  shinMesh.position.y = -0.12;
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.2), new THREE.MeshStandardMaterial({ color: "#12151c", roughness: 0.35, metalness: 0.4 }));
  shoe.position.set(0, -0.22, 0.03);
  shinL.add(shinMesh, shoe);
  legL.add(thigh, shinL);
  const legR = legL.clone();
  legR.position.x = 0.11;
  const cape = new THREE.Group();
  cape.position.set(0, 1.32, -0.18);
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(0.4 - i * 0.05, 0.15, 0.025),
      new THREE.MeshStandardMaterial({ color: c.shirt, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide }),
    );
    seg.position.y = -0.08 - i * 0.15;
    cape.add(seg);
  }
  group.add(torso, neck, head, eyeL, eyeR, browL, browR, mouth, armL, armR, legL, legR, cape);
  return {
    group, armL, armR, legL, legR, torso, head, phase: Math.random() * 2,
    foreL, foreR, eyeL, eyeR, mouth, cape,
    mats: { skin, shirt, pants },
    blink: Math.random() * 2,
    modelRoot: null,
    mixer: null,
    animationActions: new Map<string, THREE.AnimationAction>(),
    activeAnimation: "",
  };
}

function makeNameTag(label: string, accent: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 72);
    ctx.fillStyle = "rgba(8,10,16,0.82)";
    ctx.beginPath();
    ctx.roundRect(28, 16, 200, 40, 20);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(48, 36, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6f1e8";
    ctx.font = "700 22px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label.slice(0, 14), 138, 37, 150);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(0.95, 0.27, 1);
  sprite.position.y = 2.15;
  sprite.renderOrder = 4;
  return sprite;
}

function tickRig(rig: Rig, dt: number, moving: boolean, emote: string, running = false): void {
  // The authored BOPPO GLB owns its entire animation. Never combine its clips
  // with the procedural placeholder's limb rotations, body bob, blinking or emotes.
  if (rig.modelRoot && rig.mixer && rig.animationActions.size > 0) {
    const wanted = emote === "wave" || emote === "hi"
      ? "Emote_Hi"
      : emote === "win"
        ? "Jump"
        : emote === "lose"
          ? "Sit_Stand"
          : moving
            ? (running ? "Run" : "Walk")
            : "";

    if (wanted !== rig.activeAnimation) {
      const previous = rig.animationActions.get(rig.activeAnimation);
      const next = wanted ? rig.animationActions.get(wanted) : undefined;
      if (previous) previous.fadeOut(0.16);
      if (next) {
        const oneShot = wanted === "Jump" || wanted === "Sit_Stand" || wanted === "Emote_Hi";
        next.reset();
        next.enabled = true;
        next.clampWhenFinished = oneShot;
        next.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
        next.setEffectiveTimeScale(1);
        next.setEffectiveWeight(1);
        next.fadeIn(0.16);
        next.play();
      }
      rig.activeAnimation = next ? wanted : "";
    }

    rig.mixer.update(dt);
    return;
  }

  // Procedural motion is reserved for the original fallback/rival rigs only.
  rig.phase += dt * (moving ? 8.2 : 1.5);
  const gait = moving ? Math.sin(rig.phase) : 0;
  const blend = 1 - Math.exp(-dt * 10);
  rig.legL.rotation.x += (gait * 0.72 - rig.legL.rotation.x) * blend;
  rig.legR.rotation.x += (-gait * 0.72 - rig.legR.rotation.x) * blend;
  rig.armL.rotation.x += (-gait * 0.5 - rig.armL.rotation.x) * blend;
  rig.armR.rotation.x += (gait * 0.5 - rig.armR.rotation.x) * blend;
  rig.foreL.rotation.x = moving ? Math.max(0, -gait) * 0.45 : 0.06;
  rig.foreR.rotation.x = moving ? Math.max(0, gait) * 0.45 : 0.06;
  const bob = moving ? Math.abs(Math.sin(rig.phase * 2)) * 0.04 : Math.sin(rig.phase) * 0.012;
  rig.group.position.y += (bob - rig.group.position.y) * blend;
  rig.torso.rotation.z += (-gait * 0.05 - rig.torso.rotation.z) * blend;
  rig.torso.rotation.x += ((moving ? 0.06 : 0) - rig.torso.rotation.x) * blend;
  rig.head.rotation.y = Math.sin(rig.phase * 0.32) * 0.2;
  rig.head.rotation.x = moving ? -0.06 : Math.sin(rig.phase * 0.45) * 0.04;
  rig.cape.rotation.x = 0.2 + Math.sin(rig.phase * (moving ? 2.1 : 1)) * (moving ? 0.14 : 0.045);
  rig.blink += dt;
  const cycle = rig.blink % 3.6;
  const shut = cycle > 3.35 ? Math.sin(((cycle - 3.35) / 0.25) * Math.PI) : 0;
  rig.eyeL.scale.y = 1 - shut * 0.92;
  rig.eyeR.scale.y = 1 - shut * 0.92;
  if (emote === "win") {
    rig.armL.rotation.x = -2.35;
    rig.armR.rotation.x = -2.35;
    rig.mouth.scale.set(1.35, 0.55, 1);
  } else if (emote === "lose") {
    rig.torso.rotation.x = 0.4;
    rig.head.rotation.x = 0.45;
    rig.mouth.scale.set(0.65, 1.15, 1);
  } else if (emote === "wave") {
    rig.armR.rotation.z = -1.15;
    rig.foreR.rotation.z = Math.sin(rig.phase * 6) * 0.35;
  } else {
    rig.armL.rotation.z += (0 - rig.armL.rotation.z) * blend;
    rig.armR.rotation.z += (0 - rig.armR.rotation.z) * blend;
    rig.mouth.scale.set(1, 0.42, 1);
  }
}
function proceduralMicroTexture(
  seedText: string,
  kind: "bump" | "roughness",
  width = 256,
  height = 128,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  let state = 2166136261;
  for (let i = 0; i < seedText.length; i++) state = Math.imul(state ^ seedText.charCodeAt(i), 16777619) >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const image = ctx.createImageData(width, height);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = next();
    const value = kind === "bump"
      ? 116 + Math.floor(noise * 25)
      : 92 + Math.floor(noise * 128);
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  ctx.lineWidth = kind === "bump" ? 0.7 : 1;
  for (let i = 0; i < 30; i++) {
    const x = next() * width;
    const y = next() * height;
    const len = 2 + next() * (kind === "bump" ? 16 : 28);
    ctx.strokeStyle = kind === "bump"
      ? (i % 2 ? "rgba(245,250,255,.26)" : "rgba(0,0,0,.24)")
      : (i % 2 ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.16)");
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (next() - 0.5) * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

const microSurfaceTextures = new Map<string, THREE.CanvasTexture>();

function microSurfaceTexture(def: BallDef, kind: "bump" | "roughness"): THREE.CanvasTexture {
  // Micrograin is shared by visual family to avoid allocating two full canvas
  // textures for every ball in large imported inventories.
  const key = kind + ":" + def.visual.pattern;
  const cached = microSurfaceTextures.get(key);
  if (cached) return cached;
  const texture = proceduralMicroTexture("ball-shell:" + def.visual.pattern, kind, 128, 64);
  microSurfaceTextures.set(key, texture);
  return texture;
}

function arenaPanelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const sheen = ctx.createLinearGradient(0, 0, 256, 256);
  sheen.addColorStop(0, "#b9c2cc");
  sheen.addColorStop(0.45, "#8b96a2");
  sheen.addColorStop(1, "#646f7b");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 256, 256);

  // Recessed panel perimeter, brushed grain, seam ticks and four machine fasteners.
  ctx.strokeStyle = "rgba(15,24,35,.58)";
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 246, 246);
  ctx.strokeStyle = "rgba(238,246,255,.16)";
  ctx.lineWidth = 1;
  for (let y = 15; y < 250; y += 5) {
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(244, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(13,22,31,.24)";
  ctx.lineWidth = 1;
  ctx.strokeRect(17, 17, 222, 222);
  for (const [x, y] of [[13, 13], [243, 13], [13, 243], [243, 243]] as const) {
    const bolt = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, 4.5);
    bolt.addColorStop(0, "#e3e9ee");
    bolt.addColorStop(0.4, "#7d8894");
    bolt.addColorStop(1, "#252f3b");
    ctx.fillStyle = bolt;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(7,13,20,.7)";
    ctx.beginPath();
    ctx.moveTo(x - 2.2, y + 1.8);
    ctx.lineTo(x + 2.2, y - 1.8);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function patternTexture(def: BallDef): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  // 256×128 keeps the persistent per-ball cache lightweight even for huge inventories.
  const width = 256;
  const height = 128;
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (!g) return new THREE.CanvasTexture(canvas);

  let state = 2166136261;
  for (let i = 0; i < def.id.length; i++) state = Math.imul(state ^ def.id.charCodeAt(i), 16777619) >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  g.fillStyle = def.visual.baseColor;
  g.fillRect(0, 0, canvas.width, canvas.height);
  const highlight = g.createLinearGradient(12, 0, width - 18, height);
  highlight.addColorStop(0, "rgba(255,255,255,.30)");
  highlight.addColorStop(0.32, "rgba(255,255,255,.055)");
  highlight.addColorStop(0.72, "rgba(5,8,15,.12)");
  highlight.addColorStop(1, "rgba(0,0,0,.36)");
  g.fillStyle = highlight;
  g.fillRect(0, 0, width, height);

  const p = def.visual.pattern;
  g.save();
  g.globalAlpha = 0.42;
  g.fillStyle = def.visual.accentColor;
  g.strokeStyle = def.visual.accentColor;
  g.lineWidth = 2.2;
  if (p === "stripes") {
    for (let i = 0; i < 16; i++) if (i % 2 === 0) g.fillRect(i * 16, 0, 8, 128);
  } else if (p === "dots") {
    for (let y = 10; y < 128; y += 22) for (let x = 10; x < 256; x += 22) {
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
  } else if (p === "checker") {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2 === 0) g.fillRect(x * 16, y * 16, 16, 16);
  } else if (p === "hex") {
    for (let y = -8; y < 136; y += 22) for (let x = -8; x < 264; x += 24) {
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        const px = x + Math.cos(a) * 10;
        const py = y + Math.sin(a) * 10;
        if (!k) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.stroke();
    }
  } else if (p === "stars") {
    for (let i = 0; i < 24; i++) {
      const x = (i * 73 + 19) % 256, y = (i * 41 + 13) % 128;
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5;
        const r = k % 2 ? 3 : 8;
        if (!k) g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        else g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    }
  } else if (p === "spiral") {
    for (let n = 0; n < 4; n++) {
      g.beginPath();
      for (let i = 0; i < 180; i++) {
        const a = i * 0.12 + n * Math.PI / 2;
        const r = i * 0.22;
        const x = 32 + n * 62 + Math.cos(a) * r;
        const y = 64 + Math.sin(a) * r;
        if (!i) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  } else if (p === "runes") {
    g.font = "bold 26px sans-serif";
    g.textAlign = "center";
    for (let i = 0; i < 12; i++) g.fillText(["◇", "△", "⌁", "✦"][i % 4], 16 + (i % 6) * 44, 24 + Math.floor(i / 6) * 62);
  } else {
    for (let i = 0; i < 9; i++) {
      g.globalAlpha = 0.23;
      g.beginPath();
      g.arc((i * 47 + 21) % 256, (i * 31 + 18) % 128, 10 + (i % 3) * 5, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();

  // Deterministic micro-scratches and faint clearcoat scuffs make each shell feel handled.
  for (let i = 0; i < 82; i++) {
    const x = next() * width;
    const y = next() * height;
    const length = 1.5 + next() * 14;
    g.lineWidth = 0.45 + next() * 0.75;
    g.strokeStyle = i % 3 === 0 ? "rgba(255,255,255,.11)" : "rgba(0,0,0,.095)";
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + length, y + (next() - 0.5) * 2.6);
    g.stroke();
  }
  const vignette = g.createRadialGradient(128, 56, 8, 128, 64, 150);
  vignette.addColorStop(0, "rgba(255,255,255,.09)");
  vignette.addColorStop(0.58, "rgba(20,25,35,.025)");
  vignette.addColorStop(1, "rgba(0,0,0,.24)");
  g.fillStyle = vignette;
  g.fillRect(0, 0, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function makeBall(def: BallDef): THREE.Group {
  const group = new THREE.Group();
  const id = def.id.toLowerCase();
  const shape =
    id.includes("lucky_die") ? "die" :
    id.includes("aegis") ? "shield" :
    id.includes("glass_hail") || id.includes("prism") ? "crystal" :
    id.includes("halo") || id.includes("coil") ? "ringed" :
    id.includes("hook") || id.includes("last_knife") ? "horned" :
    id.includes("swarm") ? "spiky" : def.visual.shape;

  let geo: THREE.BufferGeometry;
  if (shape === "die") geo = new THREE.BoxGeometry(1.55, 1.55, 1.55, 2, 2, 2);
  else if (shape === "crystal") geo = new THREE.OctahedronGeometry(1, 0);
  else if (shape === "faceted") geo = new THREE.DodecahedronGeometry(1, 0);
  else if (shape === "shield") geo = new THREE.IcosahedronGeometry(0.96, 0);
  else if (shape === "spiky") geo = new THREE.IcosahedronGeometry(1, 1);
  else geo = new THREE.SphereGeometry(1, 32, 24);

  const mat = new THREE.MeshPhysicalMaterial({
    map: patternTexture(def),
    bumpMap: microSurfaceTexture(def, "bump"),
    bumpScale: shape === "crystal" ? 0.012 : 0.028,
    roughnessMap: microSurfaceTexture(def, "roughness"),
    color: "#ffffff",
    emissive: def.visual.accentColor,
    emissiveIntensity: def.visual.emissive * 0.28,
    roughness: shape === "crystal" ? 0.22 : 0.36,
    metalness: def.rarity === "common" ? 0.28 : 0.42,
    clearcoat: shape === "crystal" ? 0.82 : 0.52,
    clearcoatRoughness: 0.2,
    envMapIntensity: shape === "crystal" ? 1.25 : 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  group.add(mesh);

  if (shape === "shield") {
    const shieldFace = new THREE.Mesh(new THREE.CircleGeometry(0.68, 6), new THREE.MeshBasicMaterial({
      color: def.visual.accentColor, transparent: true, opacity: 0.48, side: THREE.DoubleSide,
    }));
    shieldFace.position.z = 0.77;
    shieldFace.rotation.z = Math.PI / 6;
    group.add(shieldFace);
    const shieldEdge = new THREE.LineSegments(new THREE.EdgesGeometry(shieldFace.geometry), new THREE.LineBasicMaterial({
      color: def.visual.baseColor, transparent: true, opacity: 0.95,
    }));
    shieldEdge.position.copy(shieldFace.position);
    shieldEdge.rotation.copy(shieldFace.rotation);
    shieldEdge.scale.setScalar(1.08);
    group.add(shieldEdge);
  }

  if (shape === "ringed") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.065, 10, 48), lambert(def.visual.accentColor, def.visual.accentColor, 0.65));
    ring.userData.ballPart = "signature-orbit";
    ring.rotation.x = Math.PI / 2.4;
    group.add(ring);
    const ring2 = ring.clone();
    ring2.scale.setScalar(0.78);
    ring2.rotation.set(0.9, 0.4, 0.2);
    group.add(ring2);
  }

  if (shape === "horned" || shape === "spiky" || id.includes("jolt") || id.includes("sprout")) {
    const count = shape === "spiky" ? 7 : id.includes("jolt") ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const tall = shape === "horned" || id.includes("sprout");
      const radius = shape === "spiky" ? 0.13 : 0.16;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(radius, tall ? 0.58 : 0.42, 8),
        lambert(def.visual.accentColor, def.visual.accentColor, 0.12),
      );
      const a = (i / count) * Math.PI * 2;
      cone.position.set(
        Math.cos(a) * (shape === "spiky" ? 0.75 : 0.48),
        shape === "spiky" ? Math.sin(a) * 0.5 : 0.82,
        Math.sin(a) * (shape === "spiky" ? 0.75 : 0.48),
      );
      cone.rotation.z = shape === "spiky" ? Math.cos(a) * 0.9 : -0.7;
      cone.rotation.x = Math.sin(a) * 0.8;
      group.add(cone);
    }
  }

  if (id.includes("magma") || id.includes("boom")) {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 24, 20),
      new THREE.MeshBasicMaterial({ color: def.visual.accentColor, transparent: true, opacity: 0.55 }),
    );
    core.userData.ballPart = "magma-core";
    group.add(core);
  }

  if (id.includes("ribbon") || id.includes("web") || id.includes("serpent")) {
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.035, 8, 48), lambert(def.visual.accentColor, def.visual.accentColor, 0.5));
    orbit.userData.ballPart = "signature-orbit";
    orbit.rotation.set(0.4, 0.9, 0.7);
    group.add(orbit);
    if (id.includes("web")) {
      const orbit2 = orbit.clone(); orbit2.rotation.set(1.2, 0.25, 0.6); group.add(orbit2);
      const orbit3 = orbit.clone(); orbit3.rotation.set(0.1, 0.9, 1.3); orbit3.scale.setScalar(0.74); group.add(orbit3);
    }
  }

  if (shape === "die") {
    // Raised pips on three visible die faces make Lucky Die unmistakable at game scale.
    const pipMaterial = new THREE.MeshBasicMaterial({ color: "#111827" });
    const pipGeo = new THREE.SphereGeometry(0.075, 10, 8);
    const pipFaces: Array<[number, number, number]> = [
      [-0.24, 0.24, 0.79], [0.24, -0.24, 0.79],
      [-0.24, -0.24, 0.79], [0.24, 0.24, 0.79], [0, 0, 0.79],
      [-0.25, 0.79, -0.25], [0.25, 0.79, 0.25], [0, 0.79, 0],
      [0.79, 0.24, -0.24], [0.79, -0.24, 0.24],
    ];
    for (const [x, y, z] of pipFaces) {
      const pip = new THREE.Mesh(pipGeo, pipMaterial);
      pip.position.set(x, y, z);
      group.add(pip);
    }
  } else if (shape !== "shield") {
    const eyeMat = lambert("#1c2430");
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
    eye.position.set(-0.28, 0.22, 0.86);
    const eye2 = eye.clone();
    eye2.position.x = 0.28;
    group.add(eye, eye2);
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(def.visual.face === "cute" ? 0.28 : 0.36, def.visual.face === "angry" ? 0.08 : 0.1, 0.08),
      lambert(def.visual.face === "grin" || def.visual.face === "cute" ? "#1c2430" : "#3a1016"),
    );
    mouth.position.set(0, -0.18, 0.92);
    if (def.visual.face === "sleepy") mouth.scale.y = 0.4;
    group.add(mouth);
  }

  // Signature parts: silhouettes are keyed by ball identity, not just shared color/pattern presets.
  if (id.includes("crimson_leech")) {
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.36, -0.05, Math.sin(a) * 0.36 + 0.62),
        new THREE.Vector3(Math.cos(a + 0.25) * 0.78, -0.22, Math.sin(a + 0.25) * 0.78),
        new THREE.Vector3(Math.cos(a + 0.52) * 1.08, 0.04, Math.sin(a + 0.52) * 1.08),
        new THREE.Vector3(Math.cos(a + 0.82) * 0.92, 0.22, Math.sin(a + 0.82) * 0.92),
      ]);
      const tendril = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.055, 6, false), lambert(def.visual.accentColor, def.visual.baseColor, 0.25));
      tendril.userData.ballPart = "signature-tendril";
      tendril.userData.tendrilIndex = i;
      group.add(tendril);
    }
  }

  if (id.includes("coil_ram")) {
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.8 + i * 0.12, 0.038, 7, 44), lambert(def.visual.accentColor, def.visual.accentColor, 0.55));
      coil.rotation.set(0.25 + i * 0.42, 0.4 + i * 0.6, 0.2 + i * 0.35);
      coil.userData.ballPart = "signature-orbit";
      group.add(coil);
    }
  }

  if (id.includes("halo_blades")) {
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const blade = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), lambert(def.visual.baseColor, def.visual.accentColor, 0.35));
      blade.scale.set(0.42, 1.35, 0.2);
      blade.position.set(Math.cos(angle) * 1.32, Math.sin(angle * 1.7) * 0.18, Math.sin(angle) * 1.32);
      blade.rotation.y = -angle;
      blade.userData.ballPart = "halo-blade";
      blade.userData.bladeIndex = i;
      group.add(blade);
    }
  }

  if (id.includes("hook_comet")) {
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12), new THREE.MeshBasicMaterial({
      color: def.visual.trail.color || "#93c5fd", transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    tail.scale.set(0.62, 0.62, 2.25);
    tail.position.z = -0.92;
    tail.userData.ballPart = "comet-tail";
    group.add(tail);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7, 5), lambert(def.visual.baseColor, def.visual.accentColor, 0.3));
    fin.position.set(0, 0.08, -1.25);
    fin.rotation.x = Math.PI / 2;
    group.add(fin);
  }

  if (id.includes("last_knife")) {
    const blade = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), lambert("#e2e8f0", def.visual.accentColor, 0.35));
    blade.scale.set(0.23, 0.3, 1.65);
    blade.position.set(0.32, 0.08, 0.78);
    blade.rotation.x = 0.16;
    blade.rotation.y = -0.22;
    blade.userData.ballPart = "knife-blade";
    group.add(blade);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.42, 8), lambert("#1f2937"));
    grip.position.set(0.32, -0.12, 0.38);
    grip.rotation.x = 0.32;
    group.add(grip);
  }

  if (id.includes("glass_hail")) {
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshLambertMaterial({
        color: "#e5fbff", emissive: def.visual.accentColor, emissiveIntensity: 0.45,
        transparent: true, opacity: 0.86,
      }));
      shard.scale.set(0.35, 1.2, 0.38);
      shard.position.set(Math.cos(a) * 0.78, Math.sin(a * 2) * 0.3, Math.sin(a) * 0.78);
      shard.rotation.set(a * 0.3, -a, a * 0.2);
      shard.userData.ballPart = "crystal-shard";
      shard.userData.shardIndex = i;
      group.add(shard);
    }
  }

  if (id.includes("prism_lancer")) {
    for (let i = 0; i < 3; i++) {
      const prismRing = new THREE.Mesh(new THREE.TorusGeometry(0.83 + i * 0.1, 0.024, 5, 36), lambert(def.visual.accentColor, def.visual.accentColor, 0.65));
      prismRing.rotation.set(i * 0.7, 0.3 + i * 0.75, i * 0.25);
      prismRing.userData.ballPart = "signature-orbit";
      group.add(prismRing);
    }
  }

  if (id.includes("boom_pebble")) {
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 5), lambert(def.visual.accentColor, "#fb923c", 0.3));
      spike.position.set(Math.cos(angle) * 0.86, Math.sin(angle * 2) * 0.22, Math.sin(angle) * 0.86);
      spike.rotation.z = Math.cos(angle) * 0.9;
      spike.rotation.x = Math.sin(angle) * 0.9;
      group.add(spike);
    }
  }

  if (id.includes("sprout_turret")) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.65, 8), lambert("#4d7c0f"));
    stem.position.y = 0.74;
    group.add(stem);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.68, 5), lambert(i % 2 ? "#65a30d" : "#86efac", "#22c55e", 0.15));
      leaf.position.set(Math.cos(angle) * 0.35, 0.95 + (i % 2) * 0.16, Math.sin(angle) * 0.35);
      leaf.rotation.z = Math.cos(angle) * 0.9;
      leaf.rotation.x = Math.sin(angle) * 0.9;
      leaf.userData.ballPart = "sprout-leaf";
      group.add(leaf);
    }
  }

  if (id.includes("web_weaver")) {
    const strands: THREE.Vector3[] = [];
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI * 2 / 10;
      strands.push(new THREE.Vector3(0, 0, 0.86));
      strands.push(new THREE.Vector3(Math.cos(a) * 0.86, Math.sin(a) * 0.86, 0.32));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(strands);
    const web = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: def.visual.trail.color || "#e0f2fe", transparent: true, opacity: 0.88,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    web.userData.ballPart = "web-skin";
    group.add(web);
  }

  const particleMode = def.visual.particles;
  if (particleMode && particleMode !== "none") {
    const count = particleMode === "leaves" ? 4 : particleMode === "smoke" ? 5 : 6;
    const particleColor = particleMode === "snow" ? "#effaff"
      : particleMode === "leaves" ? "#8df0b4"
      : particleMode === "embers" ? "#ffb45f"
      : particleMode === "bubbles" ? "#b8f5ff"
      : particleMode === "stars" ? "#ffffff"
      : def.visual.trail.color || def.visual.accentColor;
    for (let i = 0; i < count; i++) {
      const geometry = particleMode === "leaves"
        ? new THREE.ConeGeometry(0.085, 0.24, 4)
        : particleMode === "smoke" || particleMode === "bubbles"
          ? new THREE.SphereGeometry(particleMode === "smoke" ? 0.12 : 0.075, 10, 8)
          : new THREE.OctahedronGeometry(particleMode === "embers" ? 0.065 : 0.075, 0);
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: particleColor,
        transparent: true,
        opacity: particleMode === "smoke" ? 0.22 : particleMode === "bubbles" ? 0.48 : 0.82,
        blending: particleMode === "smoke" || particleMode === "bubbles" ? THREE.NormalBlending : THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particle = new THREE.Mesh(geometry, particleMaterial);
      particle.userData.ballPart = "aura-particle";
      particle.userData.auraIndex = i;
      particle.userData.auraCount = count;
      particle.userData.auraRadius = 1.13 + (i % 2) * 0.18;
      particle.userData.auraSpeed = particleMode === "smoke" ? 0.8 : particleMode === "leaves" ? 1.25 : 1.9;
      particle.position.set(Math.cos(i / count * Math.PI * 2) * 1.15, Math.sin(i * 1.7) * 0.35, Math.sin(i / count * Math.PI * 2) * 1.15);
      group.add(particle);
    }
  }

  const trailLength = Math.max(0, Math.min(1.5, def.visual.trail.length));
  if (trailLength >= 0.65) {
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: def.visual.trail.color || def.visual.accentColor,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const trailRing = new THREE.Mesh(new THREE.TorusGeometry(0.98 + trailLength * 0.15, 0.022 + trailLength * 0.012, 5, 36), trailMaterial);
    trailRing.userData.ballPart = "trail-orbit";
    trailRing.rotation.set(0.65, 0.25, 0.9);
    trailRing.scale.set(1.08, 0.78, 1);
    group.add(trailRing);
  }

  group.userData.defId = def.id;
  group.userData.signature = shape;
  return group;
}

function makeEntityVisual(def: BallDef, kind: number, variant = 0): THREE.Group {
  const group = new THREE.Group();
  const accent = def.visual.accentColor || "#67e8f9";
  const base = def.visual.baseColor || "#e2e8f0";
  const glow = new THREE.MeshLambertMaterial({ color: base, emissive: accent, emissiveIntensity: 0.9 });
  const bright = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });

  if (kind === 3) {
    // Projectile: compact crystal core with a luminous propulsion halo, never a miniature face-ball.
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 0), glow);
    core.rotation.set(0.3, 0.4, 0.1);
    group.add(core);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.83, 0.045, 6, 24), bright);
    halo.rotation.set(Math.PI / 2, 0.35, 0.15);
    group.add(halo);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 7), bright);
    tail.position.z = -0.82;
    tail.rotation.x = -Math.PI / 2;
    group.add(tail);
  } else if (kind === 4) {
    // Ground hazards inherit their actual DSL shape: lane, damaging ring, web lattice or circle field.
    if (variant === 1) {
      const lane = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.46),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
      );
      lane.rotation.x = -Math.PI / 2;
      lane.position.y = 0.025;
      group.add(lane);
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.025, 0.025), bright.clone());
        rail.position.set(0, 0.045, side * 0.22);
        rail.userData.ballPart = "zone-rail";
        group.add(rail);
      }
      const centerLine = new THREE.Mesh(new THREE.BoxGeometry(1, 0.018, 0.018), bright.clone());
      centerLine.position.y = 0.052;
      centerLine.userData.ballPart = "zone-rail";
      group.add(centerLine);
    } else if (variant === 2) {
      const outer = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.095, 8, 48), bright);
      outer.rotation.x = Math.PI / 2;
      outer.userData.ballPart = "zone-rim";
      group.add(outer);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.035, 6, 40), bright.clone());
      inner.rotation.x = Math.PI / 2;
      inner.userData.ballPart = "zone-inner";
      group.add(inner);
      const ringFill = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.95, 48), new THREE.MeshBasicMaterial({
        color: accent, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false,
      }));
      ringFill.rotation.x = -Math.PI / 2;
      ringFill.position.y = 0.025;
      group.add(ringFill);
    } else {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.95, 36),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: variant === 3 ? 0.12 : 0.17, side: THREE.DoubleSide, depthWrite: false }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.018;
      group.add(disc);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.055, 7, 44), bright);
      ring.rotation.x = Math.PI / 2;
      ring.userData.ballPart = "zone-rim";
      group.add(ring);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 5, 36), bright.clone());
      inner.rotation.x = Math.PI / 2;
      inner.userData.ballPart = "zone-inner";
      group.add(inner);
      if (variant === 3) {
        const points: THREE.Vector3[] = [];
        const radius = 0.88;
        for (let spoke = 0; spoke < 8; spoke++) {
          const a = spoke * Math.PI / 4;
          points.push(new THREE.Vector3(0, 0.04, 0));
          points.push(new THREE.Vector3(Math.cos(a) * radius, 0.04, Math.sin(a) * radius));
        }
        for (const r of [0.3, 0.55, 0.8]) {
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const b = ((i + 1) / 16) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(a) * r, 0.04, Math.sin(a) * r));
            points.push(new THREE.Vector3(Math.cos(b) * r, 0.04, Math.sin(b) * r));
          }
        }
        const webGeo = new THREE.BufferGeometry().setFromPoints(points);
        const web = new THREE.LineSegments(webGeo, new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false }));
        web.userData.ballPart = "zone-web";
        group.add(web);
      }
    }
  } else if (kind === 5) {
    // Turret: anchored six-sided plinth, rotating head and short barrel.
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.9, 0.24, 6), glow);
    baseMesh.position.y = 0.12;
    group.add(baseMesh);
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), glow);
    head.position.y = 0.48;
    group.add(head);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.62, 8), bright);
    barrel.position.set(0, 0.48, 0.48);
    barrel.rotation.x = Math.PI / 2;
    group.add(barrel);
    const optic = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: "#f8fafc" }));
    optic.position.set(0, 0.5, 0.26);
    group.add(optic);
  } else if (kind === 6) {
    // Orbiter: tiny faceted satellite enclosed by its own gyroscopic ring.
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.68, 1), glow);
    group.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.055, 7, 30), bright);
    ring.rotation.set(Math.PI / 2.5, 0.35, 0.1);
    group.add(ring);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    tip.position.set(0.94, 0, 0);
    ring.add(tip);
  } else if (kind === 7) {
    // Summoned minion: a small independent drone silhouette, unlike the owner's main ball.
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.76, 1), glow);
    group.add(shell);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), new THREE.MeshBasicMaterial({ color: "#f8fafc" }));
    eye.position.set(0, 0.08, 0.66);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: accent }));
    pupil.position.set(0, 0.08, 0.81);
    group.add(pupil);
    for (let side = -1; side <= 1; side += 2) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.46, 6), bright);
      wing.position.set(side * 0.77, -0.02, 0);
      wing.rotation.z = side * Math.PI / 2;
      group.add(wing);
      const stabilizer = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 5, 16), bright.clone());
      stabilizer.position.set(side * 0.87, 0, 0);
      stabilizer.rotation.y = Math.PI / 2;
      stabilizer.userData.ballPart = "signature-orbit";
      group.add(stabilizer);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 6), bright);
    tail.position.z = -0.55;
    tail.rotation.x = Math.PI / 2;
    group.add(tail);
  } else {
    return makeBall(def);
  }

  group.userData.defId = def.id;
  group.userData.entityKind = kind;
  return group;
}

function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 30);
    grd.addColorStop(0, "rgba(0,0,0,0.45)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(48, 1, 0.1, 180);
  lobby = new THREE.Group();
  arena = new THREE.Group();
  player: Rig;
  crowd: Rig[] = [];
  pads: THREE.Mesh[] = [];
  ballGroups: THREE.Group[] = [];
  private ballMatCache = new Map<string, THREE.Group>();
  private blob: THREE.Mesh;
  private blobs: THREE.Mesh[] = [];
  private activeEffects: LiveFx[] = [];
  private seenFxKeys = new Set<string>();
  private seenFxQueue: string[] = [];
  private trailGeometry!: THREE.IcosahedronGeometry;
  private trailPool: TrailParticle[] = [];
  private trailCursor = 0;
  private lastTrailPosition = new Map<number, { x: number; y: number }>();
  private impactShake = 0;
  private specTex: THREE.CanvasTexture;
  private specCanvas: HTMLCanvasElement;
  private environmentTexture: THREE.CanvasTexture;
  private aimLine: THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
  private key: THREE.DirectionalLight;
  private rim: THREE.DirectionalLight;
  private lobbyBall: THREE.Group | null = null;
  private lobbyBallId = "";
  private dpr = 1;
  private frameMs = 16;
  private adaptiveQualityState: AdaptiveQualityState = createAdaptiveQualityState();
  private battleTrailsActive = false;
  private readonly nameTagWorldQuaternion = new THREE.Quaternion();
  private lobbyWater: THREE.Mesh | null = null;
  private lobbyCrownRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | null = null;
  private arenaCenterSignal: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | null = null;
  quality: "low" | "medium" | "high" = "medium";
  auto = true;
  host: HTMLElement;
  private clock = 0;
  private destroyed = false;
  finisherBall = new THREE.Vector3();

  constructor(host: HTMLElement) {
    this.host = host;
    const canvas = document.createElement("canvas");
    canvas.className = "gl";
    host.appendChild(canvas);
    // Keep the framebuffer inexpensive on integrated/mobile GPUs; High mode supersamples via DPR.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor("#080b13");
    this.scene.background = new THREE.Color("#080b13");
    this.environmentTexture = arenaEnvironmentTexture();
    this.scene.environment = this.environmentTexture;
    this.scene.fog = new THREE.Fog("#0b1120", 22, 58);
    this.scene.add(new THREE.HemisphereLight("#d9efff", "#111522", 0.82));
    this.key = new THREE.DirectionalLight("#ffd2a8", 2.05);
    this.key.position.set(8, 16, 6);
    this.scene.add(this.key);
    this.rim = new THREE.DirectionalLight("#3ee0ff", 1.3);
    this.rim.position.set(-12, 8, -8);
    this.scene.add(this.rim);
    const warmFill = new THREE.DirectionalLight("#ff684d", 0.48);
    warmFill.position.set(10, 4, 12);
    this.scene.add(warmFill);
    this.specCanvas = document.createElement("canvas");
    this.specCanvas.width = 256;
    this.specCanvas.height = 160;
    this.specTex = new THREE.CanvasTexture(this.specCanvas);
    this.player = makeRig({ skin: "#f3c7a1", shirt: "#ff5a36", pants: "#2f6bff", hat: "#1c2430" });
    this.player.nameTag = makeNameTag("YOU", "#3ee0ff");
    this.player.group.add(this.player.nameTag);
    this.loadBoppoAvatar(this.player);
    this.buildLobby();
    this.buildArena();
    this.lobbyWater = this.lobby.getObjectByName("water") as THREE.Mesh | null;
    this.lobbyCrownRing = this.lobby.getObjectByName("lobby-crown-ring") as THREE.Mesh<
      THREE.TorusGeometry,
      THREE.MeshBasicMaterial
    > | null;
    this.arenaCenterSignal = this.arena.getObjectByName("arena-center-signal") as THREE.Mesh<
      THREE.TorusGeometry,
      THREE.MeshBasicMaterial
    > | null;
    this.trailGeometry = new THREE.IcosahedronGeometry(0.11, 0);
    for (let i = 0; i < 44; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: "#67e8f9",
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.trailGeometry, material);
      mesh.visible = false;
      this.trailPool.push({ mesh, material, age: 0, duration: 0.3, active: false, baseOpacity: 0.2, baseScale: 1 });
      this.arena.add(mesh);
    }
    this.scene.add(this.lobby, this.arena);
    this.arena.visible = false;
    const blobGeo = new THREE.CircleGeometry(1, 16);
    const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false });
    this.blob = new THREE.Mesh(blobGeo, blobMat);
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.04;
    this.scene.add(this.blob);
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(blobGeo, blobMat);
      b.rotation.x = -Math.PI / 2;
      b.position.y = 0.04;
      this.blobs.push(b);
      this.arena.add(b);
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    this.aimLine = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: "#1c2430", dashSize: 0.35, gapSize: 0.22 }));
    this.aimLine.visible = false;
    this.arena.add(this.aimLine);
    this.resize();
  }

  private loadBoppoAvatar(rig: Rig): void {
    const url = "/assets/avatars/MVM_BOPPO_v5.glb";
    void new GLTFLoader().loadAsync(url).then((gltf) => {
      const model = gltf.scene;
      model.name = "MVM_BOPPO_v5_avatar";
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const height = bounds.getSize(new THREE.Vector3()).y;
      if (!Number.isFinite(height) || height < 0.05) {
        throw new Error("BOPPO GLB has no measurable character height.");
      }

      // Match the original lobby character height/ground contact; do not recolor or alter
      // the GLB materials so the embedded appearance is preserved exactly.
      model.scale.setScalar(1.92 / height);
      model.updateMatrixWorld(true);
      const scaledBounds = new THREE.Box3().setFromObject(model);
      model.position.y += 0.12 - scaledBounds.min.y;
      model.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      if (this.destroyed) {
        model.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          node.geometry.dispose();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          for (const material of materials) {
            for (const value of Object.values(material)) {
              if (value instanceof THREE.Texture) value.dispose();
            }
            material.dispose();
          }
        });
        return;
      }

      // Hide the generated placeholder body and preserve the existing player nameplate.
      for (const child of rig.group.children) {
        if (child !== rig.nameTag) child.visible = false;
      }
      rig.group.add(model);
      rig.modelRoot = model;
      rig.mixer = new THREE.AnimationMixer(model);
      const authoredClipNames = new Set(["Walk", "Run", "Jump", "Sit_Stand", "Emote_Hi"]);
      rig.animationActions = new Map(
        gltf.animations
          .filter((clip) => authoredClipNames.has(clip.name))
          .map((clip) => [clip.name, rig.mixer!.clipAction(clip)]),
      );
      console.info("[Ball Arena] BOPPO GLB loaded.", {
        url,
        animations: [...rig.animationActions.keys()],
      });
    }).catch((error: unknown) => {
      console.warn("[Ball Arena] Could not load BOPPO GLB; using the built-in avatar.", error);
    });
  }

  resize(): void {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    // The lobby contains several side-by-side rivals. Increase horizontal coverage on
    // wide screens so their nameplates and silhouettes remain inside the camera frame.
    // Tall/portrait framing is preserved for the deliberate rotate-to-landscape gate.
    const aspect = this.camera.aspect;
    const want = aspect < 0.85 ? 52 : aspect >= 1.85 ? 56 : aspect >= 1.35 ? 48 : 44;
    if (Math.abs(this.camera.fov - want) > 0.4) this.camera.fov = want;
    this.camera.updateProjectionMatrix();
    // Low mode intentionally renders below CSS resolution to reduce pixel workload on weaker GPUs.
    const cap = this.quality === "low" ? 0.75 : this.quality === "medium" ? 1 : 1.5;
    this.dpr = Math.min(cap, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
  }

  setQuality(q: "low" | "medium" | "high", auto: boolean, preserveAdaptiveState = false): void {
    this.quality = q;
    this.auto = auto;
    if (!preserveAdaptiveState) this.adaptiveQualityState = createAdaptiveQualityState();
    const high = q === "high";
    this.renderer.shadowMap.enabled = high;
    this.key.castShadow = high;
    if (high) {
      this.key.shadow.mapSize.set(512, 512);
      this.key.shadow.camera.near = 2;
      this.key.shadow.camera.far = 50;
      this.key.shadow.camera.left = -18;
      this.key.shadow.camera.right = 18;
      this.key.shadow.camera.top = 18;
      this.key.shadow.camera.bottom = -18;
    }
    this.resize();
  }

  private buildLobby(): void {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(20, 96),
      new THREE.MeshStandardMaterial({ color: "#101722", roughness: 0.3, metalness: 0.66 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.lobby.add(floor);

    // Fine machined inlays make the lobby feel like a built arena floor, not a flat disk.
    const inlayMaterial = new THREE.MeshStandardMaterial({
      color: "#1b2937",
      emissive: "#183949",
      emissiveIntensity: 0.18,
      roughness: 0.42,
      metalness: 0.78,
    });
    for (const [inner, outer, y] of [[10.75, 10.82, 0.012], [18.25, 18.34, 0.014]] as const) {
      const inlay = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128), inlayMaterial);
      inlay.rotation.x = -Math.PI / 2;
      inlay.position.y = y;
      this.lobby.add(inlay);
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(6.2, 6.45, 64),
      new THREE.MeshStandardMaterial({ color: "#ff7a45", emissive: "#ff5a36", emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.4 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.lobby.add(ring);
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(15.4, 16.1, 64),
      new THREE.MeshStandardMaterial({ color: "#12343f", emissive: "#3ee0ff", emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.5 }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.02;
    this.lobby.add(rim);
    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.6, 0.28, 28),
      new THREE.MeshStandardMaterial({ color: "#1c212c", roughness: 0.28, metalness: 0.7, emissive: "#ff7a45", emissiveIntensity: 0.18 }),
    );
    podium.position.y = 0.14;
    this.lobby.add(podium);
    const standMat = new THREE.MeshStandardMaterial({ color: "#1a1f2b", roughness: 0.7, metalness: 0.2 });
    for (let tier = 0; tier < 3; tier++) {
      const geo = new THREE.RingGeometry(16.6 + tier * 1.15, 17.5 + tier * 1.15, 48);
      const step = new THREE.Mesh(geo, standMat);
      step.rotation.x = -Math.PI / 2;
      step.position.y = 0.18 + tier * 0.28;
      this.lobby.add(step);
    }
    const glow = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshBasicMaterial({ color: "#d7fff8" }),
      48,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * (17.2 + (i % 3) * 0.7), 1.1 + (i % 4) * 0.25, Math.sin(a) * (17.2 + (i % 3) * 0.7));
      dummy.updateMatrix();
      glow.setMatrixAt(i, dummy.matrix);
      glow.setColorAt(i, new THREE.Color(i % 2 ? "#3ee0ff" : "#ffb15a"));
    }
    this.lobby.add(glow);

    // A stadium crown gives the lobby a legible silhouette at desktop and mobile aspect ratios.
    const crown = new THREE.Group();
    crown.name = "lobby-crown";
    const pillarMaterial = new THREE.MeshStandardMaterial({
      color: "#161f2c",
      roughness: 0.24,
      metalness: 0.84,
      emissive: "#142532",
      emissiveIntensity: 0.25,
    });
    const cyanRail = new THREE.MeshStandardMaterial({
      color: "#164458",
      emissive: "#3ee0ff",
      emissiveIntensity: 0.72,
      roughness: 0.28,
      metalness: 0.68,
    });
    const orangeRail = new THREE.MeshStandardMaterial({
      color: "#552b25",
      emissive: "#ff684d",
      emissiveIntensity: 0.65,
      roughness: 0.3,
      metalness: 0.64,
    });
    // Batch repeated architecture into instanced draws: the stadium still has 12 pylons,
    // but its repeated pillar/trim geometry no longer adds dozens of separate draw calls.
    const pillarGeometry = new THREE.BoxGeometry(0.42, 5.25, 0.42);
    const seamGeometry = new THREE.BoxGeometry(0.055, 4.25, 0.055);
    const footGeometry = new THREE.CylinderGeometry(0.34, 0.42, 0.16, 8);
    const pillars = new THREE.InstancedMesh(pillarGeometry, pillarMaterial, 12);
    const cyanSeams = new THREE.InstancedMesh(seamGeometry, cyanRail, 8);
    const orangeSeams = new THREE.InstancedMesh(seamGeometry, orangeRail, 4);
    const cyanFeet = new THREE.InstancedMesh(footGeometry, pillarMaterial, 8);
    const orangeFeet = new THREE.InstancedMesh(footGeometry, orangeRail, 4);
    pillars.castShadow = true;
    pillars.receiveShadow = true;
    const crownTransform = new THREE.Object3D();
    let cyanSeamIndex = 0;
    let orangeSeamIndex = 0;
    let cyanFootIndex = 0;
    let orangeFootIndex = 0;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const radius = 14.05;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      crownTransform.position.set(x, 2.64, z);
      crownTransform.rotation.set(0, -angle, 0);
      crownTransform.updateMatrix();
      pillars.setMatrixAt(i, crownTransform.matrix);

      crownTransform.position.set(Math.cos(angle) * (radius - 0.235), 2.72, Math.sin(angle) * (radius - 0.235));
      crownTransform.rotation.set(0, -angle, 0);
      crownTransform.updateMatrix();
      if (i % 3 === 0) orangeSeams.setMatrixAt(orangeSeamIndex++, crownTransform.matrix);
      else cyanSeams.setMatrixAt(cyanSeamIndex++, crownTransform.matrix);

      crownTransform.position.set(x, 0.1, z);
      crownTransform.rotation.set(0, 0, 0);
      crownTransform.updateMatrix();
      if (i % 3 === 0) orangeFeet.setMatrixAt(orangeFootIndex++, crownTransform.matrix);
      else cyanFeet.setMatrixAt(cyanFootIndex++, crownTransform.matrix);
    }
    for (const mesh of [pillars, cyanSeams, orangeSeams, cyanFeet, orangeFeet]) {
      mesh.instanceMatrix.needsUpdate = true;
      crown.add(mesh);
    }
    for (const [radius, y, material, tube] of [
      [14.05, 5.18, cyanRail, 0.075],
      [13.55, 6.05, pillarMaterial, 0.16],
    ] as const) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 96), material);
      rail.rotation.x = -Math.PI / 2;
      rail.position.y = y;
      rail.castShadow = true;
      crown.add(rail);
    }
    const crownPulse = new THREE.Mesh(
      new THREE.TorusGeometry(13.7, 0.035, 6, 96),
      new THREE.MeshBasicMaterial({ color: "#ff684d", transparent: true, opacity: 0.82, depthWrite: false }),
    );
    crownPulse.name = "lobby-crown-ring";
    crownPulse.rotation.x = -Math.PI / 2;
    crownPulse.position.y = 5.72;
    crown.add(crownPulse);
    this.lobby.add(crown);

    // Distant points add depth without a heavy particle simulation or extra draw calls per star.
    const starPositions = new Float32Array(360 * 3);
    for (let i = 0; i < 360; i++) {
      const angle = i * 2.399963229728653;
      const radius = 27 + (i % 11) * 2.45;
      starPositions[i * 3] = Math.cos(angle) * radius;
      starPositions[i * 3 + 1] = 2.5 + (i % 17) * 1.12;
      starPositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starField = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: "#8bb8da",
        size: 0.075,
        transparent: true,
        opacity: 0.68,
        sizeAttenuation: true,
        depthWrite: false,
        fog: false,
      }),
    );
    starField.name = "arena-starfield";
    this.scene.add(starField);

    // Rival pads stay locked to RIVALS in src/routes/index.tsx; this tighter
    // formation is intentional so the first-time lobby reads as one arena, not
    // five characters lost at the edges of a cinematic wide shot.
    const spots: [number, number, string][] = [
      [-1.8, 3.7, "#5b8cff"],
      [4.2, 3.7, "#3ecf8e"],
      [-1.8, -2.4, "#f5b942"],
      [4.8, -2.4, "#ff5a36"],
      [0, -7.2, "#c4b5fd"],
    ];
    for (const [x, z, color] of spots) {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.95, 0.08, 20),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.4 }),
      );
      pad.position.set(x, 0.05, z);
      this.pads.push(pad);
      this.lobby.add(pad);
    }
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.2), new THREE.MeshBasicMaterial({ map: this.specTex }));
    screen.position.set(0, 4.2, -16.2);
    this.lobby.add(screen);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.6, 0.16), lambert("#0e121a"));
    frame.position.set(0, 4.2, -16.35);
    this.lobby.add(frame);
    for (let i = 0; i < 4; i++) {
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 2.4),
        new THREE.MeshStandardMaterial({ color: i % 2 ? "#ff7a45" : "#14343f", emissive: i % 2 ? "#ff5a36" : "#3ee0ff", emissiveIntensity: 0.35, side: THREE.DoubleSide }),
      );
      const a = -0.8 + i * 0.55;
      banner.position.set(Math.sin(a) * 14.2, 2.2, -Math.cos(a) * 14.2);
      banner.lookAt(0, 1.5, 0);
      this.lobby.add(banner);
    }
    const shaft = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 9, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: "#ffd2a8", transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }),
    );
    shaft.position.set(2, 6, 1);
    this.lobby.add(shaft);
    this.lobby.add(this.player.group);
    for (let i = 0; i < 5; i++) {
      const rig = makeRig({
        skin: ["#f3c7a1", "#e0b090", "#c98b6a", "#f6d3b0", "#8d5a3c"][i],
        shirt: ["#5b8cff", "#3ecf8e", "#f5b942", "#ff5a36", "#1c2430"][i],
        pants: "#1a2030",
        hat: i % 2 ? "#ff7a45" : "#10141c",
        back: "cape",
      });
      this.crowd.push(rig);
      this.lobby.add(rig.group);
    }
  }

  private buildArena(): void {
    const tile = new THREE.BoxGeometry(2, 0.12, 2);
    const tileAlbedo = arenaPanelTexture();
    const tileBump = proceduralMicroTexture("arena-machined-floor", "bump", 256, 256);
    const a = new THREE.MeshStandardMaterial({
      color: "#1a2030",
      map: tileAlbedo,
      bumpMap: tileBump,
      bumpScale: 0.018,
      roughness: 0.48,
      metalness: 0.48,
      envMapIntensity: 0.72,
    });
    const b = new THREE.MeshStandardMaterial({
      color: "#121722",
      map: tileAlbedo,
      bumpMap: tileBump,
      bumpScale: 0.018,
      roughness: 0.52,
      metalness: 0.4,
      envMapIntensity: 0.62,
    });
    const instA = new THREE.InstancedMesh(tile, a, 72);
    const instB = new THREE.InstancedMesh(tile, b, 72);
    const dummy = new THREE.Object3D();
    let ia = 0;
    let ib = 0;
    for (let x = 0; x < 12; x++) {
      for (let z = 0; z < 12; z++) {
        dummy.position.set(-11 + x * 2, 0, -11 + z * 2);
        dummy.updateMatrix();
        if ((x + z) % 2 === 0) instA.setMatrixAt(ia++, dummy.matrix);
        else instB.setMatrixAt(ib++, dummy.matrix);
      }
    }
    instA.count = ia;
    instB.count = ib;
    instA.receiveShadow = true;
    instB.receiveShadow = true;
    this.arena.add(instA, instB);

    // Broadcast-style floor graphics: one center signal ring, two team-color lanes,
    // and a fine midfield seam. All markings remain flat under active effects.
    const arenaGraphics = new THREE.Group();
    arenaGraphics.name = "arena-graphic-inlays";
    const cyanSignal = new THREE.MeshBasicMaterial({
      color: "#3ee0ff",
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const orangeSignal = new THREE.MeshBasicMaterial({
      color: "#ff684d",
      transparent: true,
      opacity: 0.56,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const centerSignal = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.035, 6, 72), cyanSignal);
    centerSignal.name = "arena-center-signal";
    centerSignal.rotation.x = Math.PI / 2;
    centerSignal.position.y = 0.085;
    arenaGraphics.add(centerSignal);
    const innerSignal = new THREE.Mesh(new THREE.TorusGeometry(1.76, 0.014, 5, 72), orangeSignal);
    innerSignal.rotation.x = Math.PI / 2;
    innerSignal.position.y = 0.086;
    arenaGraphics.add(innerSignal);
    const midfield = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.018, 0.035),
      new THREE.MeshBasicMaterial({ color: "#28404f", transparent: true, opacity: 0.72, depthWrite: false }),
    );
    midfield.position.set(0, 0.082, 0);
    arenaGraphics.add(midfield);
    for (const [z, material] of [[-7.6, cyanSignal], [7.6, orangeSignal]] as const) {
      const teamRing = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.025, 5, 64), material);
      teamRing.rotation.x = Math.PI / 2;
      teamRing.position.set(0, 0.083, z);
      arenaGraphics.add(teamRing);
      const mark = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.018, 0.055),
        material,
      );
      mark.position.set(0, 0.084, z + (z < 0 ? 2.9 : -2.9));
      arenaGraphics.add(mark);
    }
    this.arena.add(arenaGraphics);

    const wallGeo = new THREE.BoxGeometry(24, 1.7, 0.45);
    const wallZ = new THREE.Mesh(wallGeo, lambert("#2a3344", "#3ee0ff", 0.15));
    wallZ.position.set(0, 0.85, -12);
    const wallZ2 = wallZ.clone();
    wallZ2.position.z = 12;
    const wallX = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.7, 24), lambert("#2a3344", "#ff7a45", 0.12));
    wallX.position.set(-12, 0.85, 0);
    const wallX2 = wallX.clone();
    wallX2.position.x = 12;
    this.arena.add(wallZ, wallZ2, wallX, wallX2);

    // Machined top rails and four compact corner beacons frame the playable floor.
    const northRail = new THREE.Mesh(new THREE.BoxGeometry(24.15, 0.075, 0.11), cyanSignal);
    northRail.position.set(0, 1.76, -12);
    const southRail = northRail.clone();
    southRail.material = orangeSignal;
    southRail.position.z = 12;
    const westRail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 24.15), cyanSignal);
    westRail.position.set(-12, 1.76, 0);
    const eastRail = westRail.clone();
    eastRail.material = orangeSignal;
    eastRail.position.x = 12;
    this.arena.add(northRail, southRail, westRail, eastRail);

    for (const [x, z, material] of [
      [-12.35, -12.35, cyanSignal],
      [12.35, -12.35, cyanSignal],
      [-12.35, 12.35, orangeSignal],
      [12.35, 12.35, orangeSignal],
    ] as const) {
      const beacon = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.22, 8), lambert("#161e2c", "#12202f", 0.3));
      base.position.y = 0.12;
      const column = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.1, 0.2), lambert("#1c2a38", "#132d3a", 0.25));
      column.position.y = 1.22;
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), material);
      crystal.position.y = 2.42;
      beacon.add(base, column, crystal);
      beacon.position.set(x, 0, z);
      this.arena.add(beacon);
    }

    // A very faint overhead force-field plane replaces the old thick glass slab,
    // which visually intersected the fighters and softened the whole combat read.
    const forceField = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshBasicMaterial({
        color: "#bfe6ff",
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    forceField.name = "arena-force-field";
    forceField.rotation.x = -Math.PI / 2;
    forceField.position.y = 7.4;
    this.arena.add(forceField);
    for (const [x, z, color] of [
      [0, 13.4, "#2f6bff"],
      [0, -13.4, "#ff3b5c"],
    ] as const) {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.45, 16), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.2 }));
      ped.position.set(x, 0.22, z);
      this.arena.add(ped);
    }
    const stand = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.7, 0.35), lambert("#1c2433"), 36);
    let s = 0;
    for (let i = 0; i < 18; i++) {
      dummy.position.set(-10 + i * 1.2, 0.4, -15.2);
      dummy.updateMatrix();
      stand.setMatrixAt(s++, dummy.matrix);
      dummy.position.z = 15.2;
      dummy.updateMatrix();
      stand.setMatrixAt(s++, dummy.matrix);
    }
    this.arena.add(stand);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), lambert("#1c2430"));
    pole.position.set(-13.5, 3, -13.5);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshLambertMaterial({ color: "#fff4c8", emissive: "#f5b942", emissiveIntensity: 0.8 }));
    lamp.position.set(-13.5, 6, -13.5);
    this.arena.add(pole, lamp);
  }

  ballGroup(def: BallDef | null, index: number, kind = 1, variant = 0): THREE.Group | null {
    if (!def) return null;
    const visualVariant = kind === 4 ? variant : 0;
    const poolKey = `${def.id}:${kind}:${visualVariant}`;
    let template = this.ballMatCache.get(poolKey);
    if (!template) {
      template = kind >= 3 && kind <= 7 ? makeEntityVisual(def, kind, visualVariant) : makeBall(def);
      template.userData.poolKey = poolKey;
      this.ballMatCache.set(poolKey, template);
    }
    while (this.ballGroups.length <= index) {
      const clone = template.clone(true);
      clone.userData.poolKey = poolKey;
      this.ballGroups.push(clone);
      this.arena.add(clone);
    }
    const current = this.ballGroups[index];
    if (current.userData.poolKey !== poolKey) {
      this.arena.remove(current);
      const clone = template.clone(true);
      clone.userData.poolKey = poolKey;
      this.ballGroups[index] = clone;
      this.arena.add(clone);
    }
    return this.ballGroups[index];
  }

  groundPoint(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    _v.set(ndcX, ndcY, 0.5).unproject(this.camera);
    const dir = _v.sub(this.camera.position).normalize();
    if (Math.abs(dir.y) < 1e-4) return null;
    const t = -this.camera.position.y / dir.y;
    if (t < 0) return null;
    return { x: this.camera.position.x + dir.x * t, z: this.camera.position.z + dir.z * t };
  }

  update(dt: number, draw: DrawState, frameDeltaMs = dt * 1000): void {
    const t0 = performance.now();
    this.clock += draw.reduceMotion ? 0 : dt;
    this.impactShake = draw.reduceMotion ? 0 : Math.max(0, this.impactShake - dt * 0.85);
    this.lobby.visible = draw.mode === "lobby";
    this.arena.visible = draw.mode === "arena";
    if (draw.mode === "lobby") {
      // The free-roam avatar and five rivals belong only to the lobby. Updating their
      // articulated rigs while the entire lobby is hidden wastes CPU during every duel.
      this.player.group.position.set(draw.px, 0, draw.pz);
      this.player.group.rotation.y = draw.face;
      this.paintAvatar(this.player, draw.colors);
      if (!draw.reduceMotion || draw.moving || draw.emote || draw.running) tickRig(this.player, dt, draw.moving, draw.emote, draw.running === true);
      this.updateNameTagFacing(this.player, true);
      for (let i = 0; i < this.crowd.length; i++) {
        const b = draw.bots[i];
        const rig = this.crowd[i];
        if (!b) {
          rig.group.visible = false;
          continue;
        }
        rig.group.visible = true;
        rig.group.position.set(b.x, 0, b.z);
        rig.group.rotation.y = b.yaw;
        if (b.name && !rig.nameTag) {
          rig.nameTag = makeNameTag(b.name, b.shirt);
          rig.group.add(rig.nameTag);
        }
        if (!draw.reduceMotion || b.moving || b.emote) tickRig(rig, dt, b.moving, draw.reduceMotion ? "" : b.emote ? "wave" : "");
        this.updateNameTagFacing(rig, false);
      }
      if (!draw.reduceMotion && this.lobbyWater) this.lobbyWater.position.y = 0.05 + Math.sin(this.clock * 2) * 0.03;
      if (!draw.reduceMotion && this.lobbyCrownRing) this.lobbyCrownRing.material.opacity = 0.68 + (Math.sin(this.clock * 1.15) + 1) * 0.09;
    }
    if (!draw.reduceMotion && draw.mode === "arena" && this.arenaCenterSignal) {
      this.arenaCenterSignal.material.opacity = 0.52 + (Math.sin(this.clock * 2.1) + 1) * 0.07;
    }
    if (draw.showcase && draw.mode === "lobby") {
      if (this.lobbyBallId !== draw.showcase.id || !this.lobbyBall) {
        if (this.lobbyBall) this.lobby.remove(this.lobbyBall);
        this.lobbyBall = makeBall(draw.showcase);
        this.lobbyBall.scale.setScalar(0.42);
        this.lobby.add(this.lobbyBall);
        this.lobbyBallId = draw.showcase.id;
      }
      const ang = draw.reduceMotion ? (draw.orbit ?? 0) : this.clock * 0.7 + (draw.orbit ?? 0);
      this.lobbyBall.position.set(Math.cos(ang) * 1.25, 1.65 + (draw.reduceMotion ? 0 : Math.sin(this.clock * 1.7) * 0.1), Math.sin(ang) * 1.25);
      if (!draw.reduceMotion) this.lobbyBall.rotation.y += dt;
      this.lobbyBall.visible = true;
    } else if (this.lobbyBall) this.lobbyBall.visible = false;
    if (draw.mode === "lobby") {
      // Slow, sub-degree camera parallax makes the lobby feel alive without affecting control aim.
      const orbit = draw.reduceMotion ? 0 : this.clock * 0.12;
      const dist = 9.2;
      const desiredX = draw.px + Math.sin(orbit) * (draw.reduceMotion ? 0 : 0.32);
      const desiredY = 5.15 + (draw.reduceMotion ? 0 : Math.sin(this.clock * 0.38) * 0.045);
      const desiredZ = draw.pz + dist + Math.cos(orbit) * (draw.reduceMotion ? 0 : 0.18);
      this.camera.position.x += (desiredX - this.camera.position.x) * (1 - Math.exp(-2.8 * dt));
      this.camera.position.y += (desiredY - this.camera.position.y) * (1 - Math.exp(-2.8 * dt));
      this.camera.position.z += (desiredZ - this.camera.position.z) * (1 - Math.exp(-2.8 * dt));
      this.camera.lookAt(draw.px + Math.sin(orbit) * 0.08, 1.25, draw.pz);
      this.paintSpectate(draw.spectate);
      this.aimLine.visible = false;
      for (const g of this.ballGroups) g.visible = false;
    } else {
      this.layoutArena(draw, dt);
    }
    this.updateCombatEffects(draw.effects, dt, Boolean(draw.reduceMotion));
    this.updateBattleTrails(draw, dt);
    this.renderer.render(this.scene, this.camera);
    // Use the measured RAF interval as well as synchronous update/render cost. A renderer
    // can block mostly on GPU work that performance.now() around render() does not expose.
    const updateCostMs = performance.now() - t0;
    // Clamp rare tab-resume/render stalls; policy timing separately requires sustained pressure.
    const observedFrameMs = Math.min(50, Math.max(updateCostMs, Math.max(0, frameDeltaMs)));
    this.frameMs = this.frameMs * 0.9 + observedFrameMs * 0.1;
    if (this.auto) {
      const decision = stepAdaptiveQuality(this.quality, this.frameMs, frameDeltaMs, this.adaptiveQualityState);
      this.adaptiveQualityState = decision.state;
      if (decision.changed) this.setQuality(decision.quality, true, true);
    }
  }

  private updateBattleTrails(draw: DrawState, dt: number): void {
    if (draw.mode !== "arena" || draw.reduceMotion) {
      // Lobby frames should not walk/reset the whole particle pool over and over.
      if (this.battleTrailsActive) {
        this.lastTrailPosition.clear();
        for (const particle of this.trailPool) {
          particle.active = false;
          particle.mesh.visible = false;
          particle.material.opacity = 0;
        }
        this.battleTrailsActive = false;
      }
      return;
    }
    this.battleTrailsActive = true;

    const currentIds = new Set<number>();
    for (const entity of draw.ents) {
      // Keep a readable trail on the two fighter balls and moving shots only; zones and minions stay uncluttered.
      if (entity.kind !== 1 && entity.kind !== 3) continue;
      const def = entity.owner === 1 ? draw.ballB : draw.ballA;
      if (!def) continue;
      const trailLength = Math.max(0, Math.min(1.5, def.visual.trail.length));
      if (trailLength < 0.08) continue;
      currentIds.add(entity.id);
      const previous = this.lastTrailPosition.get(entity.id);
      if (previous) {
        const moved = Math.hypot(entity.x - previous.x, entity.y - previous.y);
        const threshold = entity.kind === 3 ? 0.1 : Math.max(0.1, entity.r * 0.16);
        if (moved > threshold) {
          const particle = this.trailPool[this.trailCursor % this.trailPool.length];
          this.trailCursor += 1;
          particle.active = true;
          particle.age = 0;
          particle.duration = Math.max(0.16, Math.min(0.7, 0.15 + trailLength * 0.38));
          particle.baseOpacity = entity.kind === 3 ? 0.24 : 0.12 + trailLength * 0.12;
          particle.material.color.set(def.visual.trail.color || def.visual.accentColor);
          particle.material.opacity = particle.baseOpacity;
          particle.mesh.position.set(previous.x, Math.max(0.2, entity.r * 0.82), -previous.y);
          particle.baseScale = Math.max(0.48, entity.r * (0.72 + trailLength * 0.42));
          particle.mesh.scale.set(particle.baseScale, particle.baseScale, particle.baseScale * 1.7);
          particle.mesh.rotation.set(0, Math.atan2(entity.y - previous.y, entity.x - previous.x), Math.random() * 0.18);
          particle.mesh.visible = true;
        }
      }
      this.lastTrailPosition.set(entity.id, { x: entity.x, y: entity.y });
    }
    for (const id of this.lastTrailPosition.keys()) {
      if (!currentIds.has(id)) this.lastTrailPosition.delete(id);
    }
    for (const particle of this.trailPool) {
      if (!particle.active) continue;
      particle.age += dt;
      const progress = Math.min(1, particle.age / particle.duration);
      particle.material.opacity = particle.baseOpacity * (1 - progress) * (1 - progress);
      const scale = Math.max(0.015, particle.baseScale * (1 - progress));
      particle.mesh.scale.set(scale, scale, scale * 1.7);
      particle.mesh.rotation.x += dt * 3.2;
      particle.mesh.rotation.y += dt * 4.4;
      if (progress >= 1) {
        particle.active = false;
        particle.mesh.visible = false;
        particle.material.opacity = 0;
      }
    }
  }

  private updateCombatEffects(events: FrameFx[], dt: number, reduceMotion = false): void {
    for (const event of events) {
      if (this.seenFxKeys.has(event.key)) continue;
      this.seenFxKeys.add(event.key);
      this.seenFxQueue.push(event.key);
      if (!reduceMotion) {
        if (event.type === 3) this.impactShake = Math.max(this.impactShake, 0.22);
        else if (event.type === 1) this.impactShake = Math.max(this.impactShake, resolveImpactMotion(event.magnitude, false).shake);
        else if (event.type === 2) this.impactShake = Math.max(this.impactShake, 0.04);
      }
      const hitMotion = event.type === 1 ? resolveImpactMotion(event.magnitude, reduceMotion) : null;
      if (this.seenFxQueue.length > 96) {
        const expiredKey = this.seenFxQueue.shift();
        if (expiredKey) this.seenFxKeys.delete(expiredKey);
      }
      const color = event.color || (event.type === 3 ? "#ff9b55"
        : event.type === 4 ? "#86f7c5"
        : event.type === 5 ? "#c4b5fd"
        : event.type === 2 ? "#dbeafe"
        : event.type === 13 ? "#fb7185"
        : event.type === 14 ? "#a5f3fc"
        : event.type === 15 ? "#c4b5fd"
        : event.owner === 1 ? "#fb7185" : "#67e8f9");
      const group = new THREE.Group();
      group.position.set(event.x, 0.13, -event.y);
      group.renderOrder = 5;
      const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      const ringRadius = event.type === 8 ? 0.82 : event.type === 9 ? 0.74 : event.type === 13 ? 0.88 : event.type === 15 ? 1.25 : 0.62;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, event.type === 8 ? 0.05 : 0.035, 8, 40), ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = reduceMotion ? 0 : Math.random() * 0.6;
      group.add(ring);
      let ring2: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | undefined;
      if (!reduceMotion && [8, 9, 12, 13, 14, 15].includes(event.type)) {
        ring2 = new THREE.Mesh(new THREE.TorusGeometry(ringRadius * 0.72, 0.022, 6, 32), ringMaterial.clone());
        ring2.rotation.x = Math.PI / 2;
        ring2.rotation.z = ring.rotation.z + 0.8;
        group.add(ring2);
      }
      const coreMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), coreMaterial);
      core.position.y = 0.08;
      core.visible = ![6, 7, 8, 9, 10, 11, 12].includes(event.type);
      if ([6, 7, 10, 11].includes(event.type)) ring.visible = false;
      group.add(core);
      let shell: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | undefined;
      if (!reduceMotion && (event.type === 9 || event.type === 14)) {
        shell = new THREE.Mesh(
          new THREE.SphereGeometry(0.86, 20, 14),
          new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        shell.position.y = 0.45;
        shell.scale.set(1, 0.95, 1);
        group.add(shell);
      }
      const particles: THREE.Mesh[] = [];
      const particleCount = reduceMotion ? 0 : hitMotion?.particles ?? (event.type === 13 ? 12 : event.type === 15 ? 4 : 7);
      for (let i = 0; i < particleCount; i++) {
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
        const particle = new THREE.Mesh(new THREE.OctahedronGeometry(0.075 + Math.random() * 0.04, 0), material);
        particle.userData.angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.3;
        particle.userData.speed = 1.2 + Math.random() * 1.6;
        particle.position.y = 0.1 + Math.random() * 0.16;
        group.add(particle);
        particles.push(particle);
      }
      let line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | undefined;
      let tube: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial> | undefined;
      if ([6, 7, 10, 11, 15].includes(event.type) && (Math.abs(event.x2 - event.x) + Math.abs(event.y2 - event.y) > 0.08)) {
        const dx = event.x2 - event.x;
        const dz = -(event.y2 - event.y);
        const length = Math.max(0.001, Math.hypot(dx, dz));
        const segments = event.type === 10 || event.type === 15 ? 10 : event.type === 6 ? 5 : event.type === 11 ? 2 : 1;
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const wiggle = !reduceMotion && (event.type === 10 || event.type === 6 || event.type === 15) && i > 0 && i < segments ? Math.sin(i * 2.4 + this.clock * 16) * (event.type === 6 ? 0.12 : event.type === 15 ? 0.3 : 0.17) : 0;
          points.push(new THREE.Vector3(dx * t - (dz / length) * wiggle, 0.38 + Math.sin(i * 1.7 + this.clock * 8) * 0.035, dz * t + (dx / length) * wiggle));
        }
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, linewidth: 2, blending: THREE.AdditiveBlending, depthWrite: false });
        line = new THREE.Line(lineGeo, lineMat);
        group.add(line);

        // Tube glow preserves visibility on mobile GPUs where native GL line width is limited to one pixel.
        const curve = new THREE.CatmullRomCurve3(points);
        const radius = event.type === 7 ? 0.055 : event.type === 10 ? 0.045 : event.type === 15 ? 0.035 : event.type === 6 ? 0.03 : 0.025;
        const tubeGeo = new THREE.TubeGeometry(curve, Math.max(12, segments * 6), radius, 5, false);
        const tubeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.68, blending: THREE.AdditiveBlending, depthWrite: false });
        tube = new THREE.Mesh(tubeGeo, tubeMat);
        tube.renderOrder = 7;
        group.add(tube);
      }
      this.arena.add(group);
      const baseDuration = event.type === 3 ? 0.72 : event.type === 4 ? 0.66
        : event.type === 7 ? 0.34 : event.type === 10 ? 0.43
        : event.type === 8 ? 0.96 : event.type === 9 ? 0.78
        : event.type === 11 ? 0.34 : event.type === 12 ? 0.62
        : event.type === 13 ? 0.68 : event.type === 14 ? 0.72 : event.type === 15 ? 0.58
        : event.type === 6 ? 0.46 : 0.48;
      const duration = baseDuration * (hitMotion?.duration ?? (reduceMotion ? 0.38 : 1));
      this.activeEffects.push({ key: event.key, type: event.type, magnitude: event.magnitude, impactScale: hitMotion?.scale, group, ring, ring2, shell, core, particles, line, tube, age: 0, duration });
      if (this.activeEffects.length > 32) this.removeCombatEffect(0);
    }
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const fx = this.activeEffects[i];
      fx.age += dt;
      const p = Math.min(1, fx.age / fx.duration);
      const ease = 1 - (1 - p) * (1 - p);
      const maxSize = fx.type === 1 ? Math.min(2.2, 0.55 + (fx.impactScale ?? 1) * 0.9) : fx.type === 8 ? Math.min(4.2, 1.8 + fx.magnitude * 0.35) : fx.type === 9 ? 1.75 : fx.type === 12 ? 2.35 : fx.type === 11 ? 1.35 : fx.type === 6 ? 1.9 : 1.65;
      const startSize = fx.type === 9 ? 0.86 : fx.type === 13 ? 1.0 : 0.22;
      fx.ring.scale.setScalar(fx.type === 15 ? 1.7 - ease * 1.25 : startSize + ease * (maxSize - startSize));
      if (!reduceMotion) fx.ring.rotation.z += dt * (fx.type === 12 ? 2.4 : 1.2 + p * 2);
      fx.ring.material.opacity = (1 - p) * 0.82;
      if (fx.ring2) {
        fx.ring2.scale.setScalar(fx.type === 15 ? 1.3 - ease * 0.9 : startSize + ease * (maxSize * 0.78 - startSize));
        if (!reduceMotion) fx.ring2.rotation.z -= dt * 1.7;
        fx.ring2.material.opacity = (1 - p) * 0.55;
      }
      if (fx.line) fx.line.material.opacity = Math.max(0, 1 - p);
      if (fx.tube) { fx.tube.material.opacity = Math.max(0, 0.68 * (1 - p)); fx.tube.scale.setScalar(0.88 + Math.sin(p * Math.PI) * 0.18); }
      if (fx.shell) {
        fx.shell.scale.setScalar(fx.type === 14 ? 0.55 + p * 0.9 : 0.65 + p * 1.55);
        if (!reduceMotion) { fx.shell.rotation.y += dt * 1.25; fx.shell.rotation.x += dt * 0.4; }
        fx.shell.material.opacity = Math.max(0, 0.7 * (1 - p));
      }
      const coreScale = p < 0.22 ? 0.35 + p * 3.4 : Math.max(0.02, 1.1 - p);
      fx.core.scale.setScalar(coreScale);
      if (!reduceMotion) { fx.core.rotation.x += dt * 2.8; fx.core.rotation.y += dt * 3.4; }
      fx.core.material.opacity = Math.max(0, 1 - p * 1.3);
      for (const particle of fx.particles) {
        const a = particle.userData.angle as number;
        const speed = particle.userData.speed as number;
        const radius = p * speed;
        particle.position.x = Math.cos(a) * radius;
        particle.position.z = Math.sin(a) * radius;
        particle.position.y = 0.1 + Math.sin(p * Math.PI) * 0.22 + p * 0.15;
        if (!reduceMotion) { particle.rotation.x += dt * 5; particle.rotation.y += dt * 6; }
        (particle.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - p));
      }
      if (p >= 1) this.removeCombatEffect(i);
    }
  }

  private removeCombatEffect(index: number): void {
    const [fx] = this.activeEffects.splice(index, 1);
    if (!fx) return;
    this.arena.remove(fx.group);
    fx.ring.geometry.dispose();
    fx.ring.material.dispose();
    if (fx.ring2) {
      fx.ring2.geometry.dispose();
      fx.ring2.material.dispose();
    }
    if (fx.line) {
      fx.line.geometry.dispose();
      fx.line.material.dispose();
    }
    if (fx.tube) {
      fx.tube.geometry.dispose();
      fx.tube.material.dispose();
    }
    if (fx.shell) {
      fx.shell.geometry.dispose();
      fx.shell.material.dispose();
    }
    fx.core.geometry.dispose();
    fx.core.material.dispose();
    for (const particle of fx.particles) {
      particle.geometry.dispose();
      (particle.material as THREE.Material).dispose();
    }
  }

  private paintAvatar(rig: Rig, c: AvatarColors): void {
    rig.mats.skin.color.set(c.skin);
    rig.mats.shirt.color.set(c.shirt);
    rig.mats.pants.color.set(c.pants);
    // The generated hat geometry/material were intentionally removed; do not
    // reference the deleted rig.mats.hat or rig.hat properties here.
    rig.cape.visible = c.back !== "none";
  }

  private updateNameTagFacing(rig: Rig, self: boolean): void {
    if (!rig.nameTag) return;
    const parentRotation = this.nameTagWorldQuaternion;
    rig.group.getWorldQuaternion(parentRotation);
    rig.nameTag.quaternion.copy(parentRotation.invert().multiply(this.camera.quaternion));
    const dist = this.camera.position.distanceTo(rig.group.position);
    const scale = Math.min(1, Math.max(0.55, dist / 12));
    rig.nameTag.scale.set(0.95 * scale, 0.27 * scale, 1);
    rig.nameTag.visible = this.lobby.visible && !self && dist > 2.4 && dist < 24;
  }

  private layoutArena(draw: DrawState, dt: number): void {
    for (const g of this.ballGroups) g.visible = false;
    const defs = [draw.ballA, draw.ballB];
    let shown = 0;
    if (draw.ents.length === 0 && (draw.ballA || draw.ballB)) {
      const spots = [
        { x: 0, y: -CONFIG.spawnY, r: draw.ballA?.stats.radius ?? 1, owner: 0 },
        { x: 0, y: CONFIG.spawnY, r: draw.ballB?.stats.radius ?? 1, owner: 1 },
      ];
      for (const s of spots) {
        const def = defs[s.owner];
        const g = this.ballGroup(def, shown);
        if (!g || !def) continue;
        g.visible = true;
        g.position.set(s.x, s.r, -s.y);
        g.scale.setScalar(s.r);
        shown++;
      }
    }
    for (const e of draw.ents) {
      const def = e.owner === 1 ? draw.ballB : draw.ballA;
      const g = this.ballGroup(def ?? draw.ballA, shown, e.visualKind ?? e.kind, e.sub);
      if (!g) continue;
      g.visible = true;
      let x = e.x;
      let y = e.y;
      if (draw.finisher > 0 && draw.winner >= 0 && e.id === draw.winner) {
        const tz = draw.winner === 0 ? -13.2 : 13.2;
        x = e.x * (1 - draw.finisher);
        y = e.y * (1 - draw.finisher) + (draw.winner === 0 ? CONFIG.spawnY + 4 : -CONFIG.spawnY - 4) * draw.finisher;
        void tz;
      }
      g.position.set(x, e.kind === 4 ? 0.1 : Math.max(0.3, e.r), -y);
      const entityScale = Math.max(0.25, e.r);
      const entityPhase = this.clock * (e.kind === 3 ? 7.5 : e.kind === 6 ? 2.4 : 1.4);
      const pulse = draw.reduceMotion ? 1 : e.kind === 3 ? 1 + Math.sin(entityPhase) * 0.075 : e.kind === 4 ? 1 + Math.sin(entityPhase * 0.55) * 0.045 : 1;
      if (e.kind === 4 && e.sub === 1) {
        // The lane is a unit rectangle, scaled to the simulation's actual capsule length and zone thickness.
        g.scale.set(Math.max(0.5, e.shapeLength), 1, Math.max(0.4, e.r * 1.4));
      } else if (e.kind === 4 && e.sub === 2) {
        g.scale.setScalar(Math.max(0.25, e.shapeLength) * pulse);
      } else {
        g.scale.setScalar(entityScale * pulse);
      }
      const ballId = String(def?.id ?? g.userData.defId ?? "");
      if (e.kind === 4 && e.sub === 1) g.rotation.y = e.angle;
      else if (!draw.reduceMotion) g.rotation.y += dt * (e.kind === 3 ? (e.owner === 0 ? 4.2 : -4.2) : e.kind === 6 ? 2.5 : (e.owner === 0 ? 1.4 : -1.4));
      if (!draw.reduceMotion && ballId.includes("lucky_die")) { g.rotation.x += dt * 1.1; g.rotation.z += dt * 0.7; }
      else if (!draw.reduceMotion && (ballId.includes("prism") || ballId.includes("glass_hail"))) { g.rotation.x = Math.sin(this.clock * 1.5) * 0.14; g.rotation.z = Math.cos(this.clock * 1.2) * 0.1; }
      else if (!draw.reduceMotion && ballId.includes("aegis")) { g.rotation.z = Math.sin(this.clock * 1.2) * 0.18; }
      for (const part of g.children) {
        if (draw.reduceMotion) continue;
        if (part.userData.ballPart === "signature-orbit") { part.rotation.y += dt * 1.1; part.rotation.x += dt * 0.55; }
        if (part.userData.ballPart === "trail-orbit") { part.rotation.y += dt * 0.75; part.rotation.z -= dt * 0.35; }
        if (part.userData.ballPart === "magma-core") {
          const corePulse = 0.9 + Math.sin(this.clock * 5.4) * 0.12;
          part.scale.set(corePulse, corePulse, corePulse);
        }
        if (part.userData.ballPart === "aura-particle") {
          const angle = this.clock * (part.userData.auraSpeed as number) + (part.userData.auraIndex as number) / (part.userData.auraCount as number) * Math.PI * 2;
          const radius = part.userData.auraRadius as number;
          part.position.set(Math.cos(angle) * radius, Math.sin(angle * 1.35 + (part.userData.auraIndex as number)) * 0.42, Math.sin(angle) * radius);
          const pulse = 0.78 + (Math.sin(angle * 1.8) + 1) * 0.16;
          part.scale.setScalar(pulse);
          part.rotation.x += dt * 1.3;
          part.rotation.y += dt * 1.8;
        }
        if (e.kind === 4 && part.userData.ballPart === "zone-rim") {
          part.rotation.z += dt * 0.62;
        }
        if (e.kind === 4 && part.userData.ballPart === "zone-inner") {
          part.rotation.z -= dt * 0.9;
        }
        if (e.kind === 4 && part.userData.ballPart === "zone-web" && part instanceof THREE.LineSegments) {
          part.material.opacity = 0.58 + (Math.sin(this.clock * 3.2 + e.id) + 1) * 0.12;
        }
        if (e.kind === 4 && part.userData.ballPart === "zone-rail" && part instanceof THREE.Mesh) {
          const material = part.material;
          if (material instanceof THREE.MeshBasicMaterial) material.opacity = 0.5 + (Math.sin(this.clock * 4 + e.id) + 1) * 0.22;
        }
        if (part.userData.ballPart === "signature-tendril") {
          part.rotation.y += dt * 0.38;
          part.rotation.x = Math.sin(this.clock * 1.8 + (part.userData.tendrilIndex as number)) * 0.08;
        }
        if (part.userData.ballPart === "halo-blade") {
          part.rotation.y += dt * 0.75;
          part.rotation.x = Math.sin(this.clock * 2.4 + (part.userData.bladeIndex as number)) * 0.2;
        }
        if (part.userData.ballPart === "comet-tail") {
          const tailPulse = 0.9 + Math.sin(this.clock * 7.2) * 0.12;
          part.scale.set(0.62 * tailPulse, 0.62 * tailPulse, 2.25 + Math.sin(this.clock * 7.2) * 0.25);
        }
        if (part.userData.ballPart === "knife-blade") {
          part.rotation.y = -0.22 + Math.sin(this.clock * 2.8) * 0.12;
        }
        if (part.userData.ballPart === "crystal-shard") {
          part.rotation.y += dt * (0.45 + (part.userData.shardIndex as number) * 0.08);
          part.position.y = Math.sin(this.clock * 1.6 + (part.userData.shardIndex as number)) * 0.32;
        }
        if (part.userData.ballPart === "sprout-leaf") {
          part.rotation.z = Math.sin(this.clock * 2.1 + part.position.x) * 0.12;
          part.rotation.x = Math.cos(this.clock * 1.8 + part.position.z) * 0.12;
        }
        if (part.userData.ballPart === "web-skin" && part instanceof THREE.LineSegments && part.material instanceof THREE.LineBasicMaterial) {
          part.material.opacity = 0.58 + (Math.sin(this.clock * 2.6) + 1) * 0.18;
        }
      }
      if (e.kind === 3) {
        g.rotation.x += dt * 1.8;
      } else if (e.kind === 4) {
        g.rotation.z = Math.sin(this.clock * 1.2 + e.id) * 0.07;
      } else if (e.visualKind === 7) {
        g.rotation.x = Math.sin(this.clock * 2.8 + e.id) * 0.12;
        g.rotation.z = Math.sin(this.clock * 3.1 + e.id) * 0.08;
      }
      if (shown < this.blobs.length) {
        this.blobs[shown].visible = true;
        this.blobs[shown].position.set(x, 0.05, -y);
        this.blobs[shown].scale.setScalar(e.r * 1.3);
      }
      shown++;
      if (shown > 24) break;
    }
    for (let i = shown; i < this.blobs.length; i++) this.blobs[i].visible = false;
    const showArrow = draw.arrow !== null && Boolean(draw.ballA);
    this.aimLine.visible = showArrow;
    if (showArrow && draw.arrow !== null) {
      const ang = draw.arrow;
      const x = 0;
      const y = -CONFIG.spawnY;
      const prev = previewAim(x, y, Math.cos(ang), Math.sin(ang), CONFIG.arenaHalf, draw.ballA?.stats.radius ?? 1);
      const pos = this.aimLine.geometry.getAttribute("position") as THREE.BufferAttribute;
      pos.setXYZ(0, x, 0.4, -y);
      pos.setXYZ(1, prev.x2, 0.4, -prev.y2);
      pos.setXYZ(2, prev.x3, 0.4, -prev.y3);
      pos.needsUpdate = true;
      this.aimLine.computeLineDistances();
    }
    const shake = Math.max(draw.shake, this.impactShake);
    const sx = Math.sin(this.clock * 40) * shake;
    const sz = Math.cos(this.clock * 33) * shake;
    if (draw.aimDrag > 0.5) {
      this.camera.position.set(sx, 30, 6 + sz);
      this.camera.lookAt(0, 0, -1);
    } else {
      this.camera.position.set(sx, 22, 16 + sz);
      this.camera.lookAt(0, 0, 0);
    }
    this.blob.visible = false;
  }

  private paintSpectate(s: DrawState["spectate"]): void {
    if (!s) return;
    const g = this.specCanvas.getContext("2d");
    if (!g) return;
    g.fillStyle = "#e7f3ff";
    g.fillRect(0, 0, 256, 160);
    g.strokeStyle = "#1c2430";
    g.strokeRect(18, 14, 220, 132);
    const map = (x: number, y: number) => [128 + x * 8, 80 - y * 5];
    const A = map(s.ax, s.ay);
    const B = map(s.bx, s.by);
    g.fillStyle = "#2f6bff";
    g.beginPath();
    g.arc(A[0], A[1], 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ff3b5c";
    g.beginPath();
    g.arc(B[0], B[1], 8, 0, Math.PI * 2);
    g.fill();
    this.specTex.needsUpdate = true;
  }

  destroy(): void {
    this.destroyed = true;
    // Dispose scene and cached templates explicitly on route teardown. Mesh clones share
    // resources, so Sets ensure that each GPU-backed object is disposed only once.
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    const collectResources = (root: THREE.Object3D) => {
      root.traverse((node) => {
        const drawable = node as THREE.Object3D & {
          geometry?: THREE.BufferGeometry;
          material?: THREE.Material | THREE.Material[];
        };
        if (drawable.geometry instanceof THREE.BufferGeometry) geometries.add(drawable.geometry);
        const nodeMaterials = Array.isArray(drawable.material)
          ? drawable.material
          : drawable.material
            ? [drawable.material]
            : [];
        for (const material of nodeMaterials) {
          materials.add(material);
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) textures.add(value);
          }
        }
      });
    };
    collectResources(this.scene);
    for (const template of this.ballMatCache.values()) collectResources(template);
    textures.add(this.environmentTexture);
    // Micro-surface maps are shared across World instances. Keep their canvas
    // textures alive for a later route mount; renderer.dispose() releases this
    // renderer's GPU allocations, and the next renderer can upload them again.
    const sharedMicroTextures = new Set(microSurfaceTextures.values());
    for (const texture of textures) {
      if (!sharedMicroTextures.has(texture)) texture.dispose();
    }
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
    this.ballMatCache.clear();
    this.renderer.dispose();
    this.host.replaceChildren();
  }
}
