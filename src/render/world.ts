import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { getEnvironmentAssetUrl, getEnvironmentAssetsForQuality, type EnvironmentAssetDefinition } from "./arena-assets";
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
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.mapping = THREE.EquirectangularReflectionMapping;
    fallback.colorSpace = THREE.SRGBColorSpace;
    return fallback;
  }

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
  } else if (p === "armor") {
    for (let y = -4; y < height + 18; y += 34) for (let x = -8; x < width + 18; x += 42) {
      g.strokeStyle = "rgba(255,255,255,.24)"; g.lineWidth = 1.2; g.strokeRect(x + 3, y + 3, 34, 26);
      g.strokeStyle = "rgba(0,0,0,.28)"; g.strokeRect(x, y, 34, 26);
      g.fillStyle = "rgba(255,255,255,.52)"; g.beginPath(); g.arc(x + 7, y + 7, 1.6, 0, Math.PI * 2); g.fill();
    }
  } else if (p === "fuse") {
    for (let i = 0; i < 7; i++) { const x = 14 + i * 39; g.strokeStyle = i % 2 ? "rgba(255,184,111,.6)" : "rgba(0,0,0,.42)"; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 9, height); g.stroke(); g.fillStyle = "rgba(255,211,136,.8)"; g.beginPath(); g.arc(x - 4, (i % 2) * 54 + 28, 3, 0, Math.PI * 2); g.fill(); }
  } else if (p === "winding") {
    for (let n = 0; n < 5; n++) { g.beginPath(); for (let i = 0; i < 190; i++) { const a = i * .075 + n * Math.PI / 2.5, r = i * .13, x = 128 + Math.cos(a) * r, y = 64 + Math.sin(a) * r * .55; if (!i) g.moveTo(x,y); else g.lineTo(x,y); } g.strokeStyle = n % 2 ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.25)"; g.lineWidth = 2; g.stroke(); }
  } else if (p === "veins") {
    for (let i = 0; i < 10; i++) { const x = (i * 71 + 17) % width, y = (i * 37 + 11) % height; g.beginPath(); g.moveTo(x,y); g.bezierCurveTo(x+18,y-12,x-9,y+19,x+12,y+28); g.moveTo(x+4,y+11); g.lineTo(x-7,y+5); g.moveTo(x+7,y+19); g.lineTo(x+19,y+12); g.strokeStyle = "rgba(255,106,142,.5)"; g.lineWidth = 1.3; g.stroke(); }
  } else if (p === "shards") {
    for (let i = 0; i < 25; i++) { const x = next()*width, y = next()*height, r = 4+next()*14; g.beginPath(); g.moveTo(x,y-r); g.lineTo(x+r*.55,y+r*.2); g.lineTo(x-r*.4,y+r*.7); g.closePath(); g.fillStyle = i%2 ? "rgba(255,255,255,.22)" : "rgba(8,55,78,.24)"; g.fill(); g.strokeStyle = "rgba(255,255,255,.28)"; g.stroke(); }
  } else if (p === "rays") {
    for (let i = 0; i < 26; i++) { const a=i*Math.PI*2/26; g.beginPath(); g.moveTo(128,64); g.lineTo(128+Math.cos(a)*155,64+Math.sin(a)*155); g.strokeStyle=i%2?"rgba(255,255,255,.12)":"rgba(173,126,25,.42)"; g.lineWidth=i%3===0?2.2:1; g.stroke(); }
  } else if (p === "lightning") {
    for (let i=0;i<7;i++){const x=9+i*39,shift=(i%3)*8;g.beginPath();g.moveTo(x,0);g.lineTo(x+10,20+shift);g.lineTo(x-4,38+shift);g.lineTo(x+8,60+shift);g.lineTo(x-3,86+shift);g.lineTo(x+1,height);g.strokeStyle=i%2?"rgba(255,255,255,.34)":"rgba(255,230,95,.65)";g.lineWidth=i%3===0?2.8:1.3;g.stroke();}
  } else if (p === "blade_marks") {
    for(let i=0;i<16;i++){const x=(i*43+12)%width,y=(i*31+8)%height;g.beginPath();g.moveTo(x-8,y+12);g.lineTo(x+12,y-12);g.strokeStyle=i%2?"rgba(255,255,255,.33)":"rgba(0,0,0,.38)";g.lineWidth=1+(i%3)*.45;g.stroke();}
  } else if (p === "fissure") {
    for(let i=0;i<13;i++){let x=(i*53+15)%width,y=(i*29+6)%height;g.beginPath();g.moveTo(x,y);for(let j=0;j<5;j++){x+=(next()-.5)*20;y+=6+next()*13;g.lineTo(x,y);}g.strokeStyle=i%2?"rgba(255,98,32,.75)":"rgba(255,202,92,.6)";g.lineWidth=1.2+next()*1.7;g.stroke();}
  } else if (p === "prism") {
    for(let y=-8;y<height+20;y+=28)for(let x=-8;x<width+20;x+=34){g.beginPath();g.moveTo(x+17,y);g.lineTo(x+34,y+14);g.lineTo(x+17,y+28);g.lineTo(x,y+14);g.closePath();g.fillStyle=(Math.floor(x/34)+Math.floor(y/28))%2?"rgba(255,255,255,.14)":"rgba(89,248,255,.19)";g.fill();g.strokeStyle="rgba(255,255,255,.42)";g.stroke();g.beginPath();g.moveTo(x+17,y);g.lineTo(x+17,y+28);g.stroke();}
  } else if (p === "scales") {
    for(let y=-9;y<height+12;y+=16)for(let x=-12;x<width+14;x+=20){g.beginPath();g.arc(x+((y/16)%2)*10,y,11,.08,Math.PI-.08);g.strokeStyle="rgba(220,255,240,.35)";g.lineWidth=1.4;g.stroke();g.beginPath();g.arc(x+((y/16)%2)*10,y,7,.1,Math.PI-.1);g.strokeStyle="rgba(0,0,0,.2)";g.lineWidth=.8;g.stroke();}
  } else if (p === "growth_rings") {
    for(let i=0;i<12;i++){g.beginPath();g.ellipse(128+Math.sin(i)*8,64+Math.cos(i*.7)*5,13+i*13,5+i*5,i*.12,0,Math.PI*2);g.strokeStyle=i%2?"rgba(211,255,160,.24)":"rgba(29,100,48,.42)";g.lineWidth=1.4;g.stroke();}
  } else if (p === "hive_hex") {
    for(let y=-9;y<height+15;y+=22)for(let x=-8;x<width+15;x+=25){const cx=x+(Math.round(y/22)%2)*12;g.beginPath();for(let k=0;k<6;k++){const a=k*Math.PI/3,px=cx+Math.cos(a)*11,py=y+Math.sin(a)*11;if(!k)g.moveTo(px,py);else g.lineTo(px,py);}g.closePath();g.strokeStyle="rgba(238,215,255,.42)";g.lineWidth=1.4;g.stroke();g.fillStyle="rgba(16,7,30,.16)";g.fill();}
  } else if (p === "web") {
    for(let i=0;i<16;i++){const a=i*Math.PI/8;g.beginPath();g.moveTo(128,64);g.lineTo(128+Math.cos(a)*190,64+Math.sin(a)*100);g.strokeStyle="rgba(210,239,255,.5)";g.lineWidth=1;g.stroke();}
    for(let rr=16;rr<160;rr+=19){g.beginPath();g.ellipse(128,64,rr,rr*.52,0,0,Math.PI*2);g.strokeStyle="rgba(31,64,91,.46)";g.lineWidth=1.1;g.stroke();}
  } else if (p === "celestial") {
    g.font="bold 20px sans-serif";g.textAlign="center";for(let i=0;i<14;i++)g.fillText(["✦","◇","☼","⌁","✧"][i%5],(i*71+18)%width,(i*37+20)%height);
    for(let i=0;i<7;i++){const x=(i*67+13)%width,y=(i*41+10)%height;g.beginPath();g.arc(x,y,2,0,Math.PI*2);g.fill();if(i){g.beginPath();g.moveTo(x,y);g.lineTo((x+37)%width,(y+17)%height);g.strokeStyle="rgba(255,231,172,.48)";g.stroke();}}
  } else if (p === "soundwaves") {
    for(let i=0;i<12;i++){g.beginPath();g.moveTo(-20,64+i*5);for(let x=-20;x<=width+20;x+=4)g.lineTo(x,64+i*3+Math.sin(x*.075+i*.42)*(6+(i%4)*3));g.strokeStyle=i%2?"rgba(175,201,255,.34)":"rgba(40,74,198,.36)";g.lineWidth=1.2;g.stroke();}
  } else if (p === "masonry") {
    for(let y=0;y<height+22;y+=24){const offset=Math.floor(y/24)%2?20:0;for(let x=-22+offset;x<width+24;x+=42){g.strokeStyle="rgba(238,244,250,.22)";g.strokeRect(x+2,y+2,38,20);g.strokeStyle="rgba(0,0,0,.3)";g.strokeRect(x,y,38,20);}}
  } else if (p === "ledger") {
    for(let y=13;y<height;y+=14){g.beginPath();g.moveTo(0,y);g.lineTo(width,y);g.strokeStyle="rgba(255,186,128,.34)";g.lineWidth=1;g.stroke();}
    g.beginPath();g.moveTo(28,0);g.lineTo(28,height);g.strokeStyle="rgba(255,104,104,.65)";g.lineWidth=2;g.stroke();
    for(let i=0;i<10;i++){const x=44+(i%5)*42,y=22+Math.floor(i/5)*55;g.beginPath();g.moveTo(x,y);g.lineTo(x+11,y+12);g.moveTo(x+11,y);g.lineTo(x,y+12);g.strokeStyle="rgba(255,223,170,.48)";g.stroke();}
  } else if (p === "gusts") {
    for(let i=0;i<9;i++){g.beginPath();g.moveTo(-10,8+i*15);g.bezierCurveTo(45,i*11+30,80,i*17-20,138,i*13+12);g.bezierCurveTo(182,i*17+36,220,i*9+2,270,i*15-10);g.strokeStyle=i%2?"rgba(173,255,235,.28)":"rgba(255,255,255,.45)";g.lineWidth=1.5;g.stroke();}
  } else if (p === "shell_ribs") {
    for(let i=0;i<14;i++){g.beginPath();g.ellipse(128,130,16+i*11,9+i*7,-.08,Math.PI*1.03,Math.PI*1.98);g.strokeStyle=i%2?"rgba(225,253,255,.29)":"rgba(0,0,0,.25)";g.lineWidth=1.5;g.stroke();}
  } else if (p === "quartz_facets") {
    for(let i=0;i<22;i++){const x=(i*67+17)%width,y=(i*43+9)%height,w=12+(i%4)*4,h=10+(i%3)*5;g.beginPath();g.moveTo(x,y);g.lineTo(x+w,y+h);g.lineTo(x-w*.3,y+h*1.3);g.closePath();g.fillStyle=i%2?"rgba(255,255,255,.19)":"rgba(249,208,235,.26)";g.fill();g.strokeStyle="rgba(255,255,255,.34)";g.stroke();}
  } else if (p === "beads") {
    for(let row=0;row<5;row++){const y=14+row*25;g.beginPath();g.moveTo(0,y);g.lineTo(width,y);g.strokeStyle="rgba(238,233,255,.28)";g.lineWidth=2;g.stroke();for(let i=0;i<8;i++){const x=8+i*34+(row%2)*6;g.beginPath();g.arc(x,y,4.5,0,Math.PI*2);g.fillStyle=i%2?"rgba(255,255,255,.55)":"rgba(171,151,255,.7)";g.fill();g.strokeStyle="rgba(22,12,63,.55)";g.stroke();}}
  } else if (p === "eclipse") {
    g.beginPath();g.ellipse(128,64,80,48,-.25,0,Math.PI*2);g.strokeStyle="rgba(235,168,255,.75)";g.lineWidth=2.4;g.stroke();
    g.beginPath();g.ellipse(128,64,62,36,.3,0,Math.PI*2);g.strokeStyle="rgba(111,62,175,.75)";g.lineWidth=5;g.stroke();
    g.beginPath();g.arc(128,64,31,0,Math.PI*2);g.fillStyle="rgba(0,0,0,.5)";g.fill();
    for(let i=0;i<9;i++){const a=i*Math.PI*2/9;g.beginPath();g.arc(128+Math.cos(a)*75,64+Math.sin(a)*40,2.4,0,Math.PI*2);g.fillStyle="rgba(255,255,255,.7)";g.fill();}
  } else if (p === "orbit_map") {
    for(let i=0;i<6;i++){g.beginPath();g.ellipse(128,64,25+i*18,10+i*10,i*.31,0,Math.PI*2);g.strokeStyle=i%2?"rgba(255,220,150,.23)":"rgba(255,255,255,.35)";g.lineWidth=1;g.stroke();const x=128+Math.cos(i*1.9)*(25+i*18),y=64+Math.sin(i*1.9)*(10+i*10);g.beginPath();g.arc(x,y,2.2,0,Math.PI*2);g.fillStyle="rgba(255,218,143,.8)";g.fill();}
  } else if (p === "event_horizon") {
    for(let i=0;i<12;i++){g.beginPath();g.ellipse(128+Math.sin(i*.6)*14,64+Math.cos(i*.4)*5,10+i*10,5+i*4,i*.22,0,Math.PI*2);g.strokeStyle=i%3===0?"rgba(255,210,255,.5)":"rgba(174,93,255,.36)";g.lineWidth=1.3;g.stroke();}
    g.beginPath();g.arc(128,64,17,0,Math.PI*2);g.fillStyle="rgba(0,0,0,.55)";g.fill();
  } else if (p === "topographic") {
    for(let i=0;i<15;i++){g.beginPath();g.moveTo(-10,12+i*8);for(let x=-10;x<=width+10;x+=4)g.lineTo(x,12+i*8+Math.sin(x*.042+i*.3)*5+Math.cos(x*.08+i*.15)*2);g.strokeStyle=i%2?"rgba(255,225,174,.25)":"rgba(10,20,25,.27)";g.lineWidth=1;g.stroke();}
  } else if (p === "plum_skin") {
    for(let i=0;i<150;i++){const x=next()*width,y=next()*height,rr=.35+next()*1.2;g.beginPath();g.arc(x,y,rr,0,Math.PI*2);g.fillStyle=i%3?"rgba(255,220,255,.18)":"rgba(10,5,20,.2)";g.fill();}
    g.beginPath();g.ellipse(74,32,38,13,-.5,0,Math.PI*2);g.strokeStyle="rgba(255,231,255,.16)";g.lineWidth=3;g.stroke();
  } else if (p === "petal_veins") {
    for(let petal=0;petal<7;petal++){const a=petal*Math.PI*2/7;for(let k=0;k<5;k++){g.beginPath();g.moveTo(128,64);g.quadraticCurveTo(128+Math.cos(a)*50-k*3,64+Math.sin(a)*25,128+Math.cos(a)*(40+k*8),64+Math.sin(a)*(22+k*4));g.strokeStyle=k%2?"rgba(255,229,173,.32)":"rgba(255,255,255,.3)";g.lineWidth=1;g.stroke();}}
  } else if (p === "mirror_facets") {
    for(let i=0;i<14;i++){const x=(i*47+9)%width,y=(i*31+12)%height;g.beginPath();g.moveTo(x,y);g.lineTo(x+25,y-12);g.lineTo(x+37,y+8);g.lineTo(x+8,y+18);g.closePath();g.strokeStyle="rgba(255,255,255,.58)";g.lineWidth=1;g.stroke();g.fillStyle=i%2?"rgba(255,255,255,.12)":"rgba(175,255,245,.16)";g.fill();}
  } else if (p === "moth_scales") {
    for(let y=-4;y<height+8;y+=10)for(let x=-8;x<width+10;x+=14){g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+7,y+10,x+14,y);g.strokeStyle=((x+y)%2)?"rgba(255,255,255,.25)":"rgba(183,162,255,.43)";g.lineWidth=1.1;g.stroke();}
  } else if (p === "sonar_rings") {
    for(let i=0;i<9;i++){g.beginPath();g.ellipse(128,64,11+i*15,6+i*7,0,0,Math.PI*2);g.strokeStyle=i%2?"rgba(200,250,255,.25)":"rgba(120,241,255,.55)";g.lineWidth=i%3===0?2:1;g.stroke();}
    for(let i=0;i<18;i++){const a=i*Math.PI/9;g.beginPath();g.moveTo(128+Math.cos(a)*25,64+Math.sin(a)*13);g.lineTo(128+Math.cos(a)*132,64+Math.sin(a)*65);g.strokeStyle="rgba(183,251,255,.24)";g.stroke();}
  } else if (p === "architecture") {
    for(let i=0;i<5;i++){const x=12+i*54;g.strokeStyle="rgba(170,241,255,.4)";g.lineWidth=1.7;g.strokeRect(x,16,33,92);g.strokeRect(x+5,22,23,80);g.beginPath();g.arc(x+16.5,47,10,Math.PI,Math.PI*2);g.stroke();g.beginPath();g.moveTo(x+16.5,58);g.lineTo(x+16.5,96);g.stroke();}
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
  const shape = def.visual.shape;
  const accent = def.visual.accentColor || "#67e8f9";
  const base = def.visual.baseColor || "#e2e8f0";
  let geo: THREE.BufferGeometry;

  // The visual shell is content-authored per ball; collision remains the stable arena body.
  switch (shape) {
    case "die": geo = new THREE.BoxGeometry(1.38, 1.38, 1.38); break;
    case "meteor": geo = new THREE.DodecahedronGeometry(0.88, 0); break;
    case "shield": geo = new THREE.IcosahedronGeometry(0.96, 0); break;
    case "crystal": geo = new THREE.OctahedronGeometry(1, 0); break;
    case "faceted": geo = new THREE.DodecahedronGeometry(1, 0); break;
    case "spiky": geo = new THREE.IcosahedronGeometry(1, 1); break;
    case "gear": geo = new THREE.CylinderGeometry(0.76, 0.76, 0.4, 16); geo.rotateX(Math.PI / 2); break;
    case "leech": geo = new THREE.CapsuleGeometry(0.62, 0.38, 5, 12); geo.scale(1.06, 0.92, 0.8); break;
    case "shardcluster": geo = new THREE.IcosahedronGeometry(0.72, 0); break;
    case "halo": geo = new THREE.SphereGeometry(0.82, 24, 18); break;
    case "comet": geo = new THREE.SphereGeometry(0.78, 24, 18); geo.scale(1.02, 0.88, 0.92); break;
    case "mite": geo = new THREE.CapsuleGeometry(0.55, 0.42, 4, 10); geo.scale(1.03, 0.88, 0.8); break;
    case "knife": geo = new THREE.OctahedronGeometry(0.95, 0); geo.scale(0.52, 0.62, 1.16); break;
    case "magma": geo = new THREE.DodecahedronGeometry(0.9, 0); break;
    case "lance": geo = new THREE.OctahedronGeometry(0.9, 0); geo.scale(0.64, 1.12, 0.7); break;
    case "serpent": geo = new THREE.SphereGeometry(0.85, 24, 18); geo.scale(1.03, 0.7, 0.76); break;
    case "sprout": geo = new THREE.SphereGeometry(0.83, 24, 18); geo.scale(0.98, 0.88, 0.82); break;
    case "hive": geo = new THREE.DodecahedronGeometry(0.86, 0); break;
    case "webbed": geo = new THREE.IcosahedronGeometry(0.86, 1); break;
    case "reliquary": geo = new THREE.BoxGeometry(1.08, 1.28, 0.72); break;
    case "mandolin": geo = new THREE.SphereGeometry(0.8, 24, 18); geo.scale(1.06, 0.88, 0.62); break;
    case "monolith": geo = new THREE.BoxGeometry(1.08, 1.43, 0.74); break;
    case "book": geo = new THREE.BoxGeometry(1.24, 1.02, 0.62); break;
    case "windblade": geo = new THREE.TetrahedronGeometry(0.96, 0); geo.scale(1.1, 0.85, 0.58); break;
    case "shell": geo = new THREE.SphereGeometry(0.9, 24, 18); geo.scale(1.04, 0.86, 0.74); break;
    case "crystalcluster": geo = new THREE.OctahedronGeometry(0.68, 0); break;
    case "abacus": geo = new THREE.CylinderGeometry(0.82, 0.82, 0.38, 12); geo.rotateX(Math.PI / 2); break;
    case "void": geo = new THREE.SphereGeometry(0.83, 28, 20); break;
    case "kettle": geo = new THREE.SphereGeometry(0.78, 24, 18); geo.scale(1.04, 0.86, 0.88); break;
    case "crown": geo = new THREE.DodecahedronGeometry(0.78, 0); break;
    case "atlas": geo = new THREE.CylinderGeometry(0.84, 0.84, 0.25, 48); geo.rotateX(Math.PI / 2); break;
    case "plum": geo = new THREE.SphereGeometry(0.88, 24, 18); geo.scale(0.8, 1.15, 0.78); break;
    case "orchid": geo = new THREE.SphereGeometry(0.44, 20, 16); break;
    case "mirror": geo = new THREE.OctahedronGeometry(0.91, 0); break;
    case "moth": geo = new THREE.SphereGeometry(0.43, 20, 16); geo.scale(0.74, 1.18, 0.62); break;
    case "sonar": geo = new THREE.CylinderGeometry(0.82, 0.82, 0.3, 48); geo.rotateX(Math.PI / 2); break;
    case "cathedral": geo = new THREE.BoxGeometry(0.94, 1.2, 0.72); break;
    default: geo = new THREE.SphereGeometry(1, 32, 24);
  }

  const glassy = shape === "mirror" || shape === "crystal" || shape === "shardcluster" || shape === "crystalcluster";
  const organic = shape === "plum" || shape === "moth" || shape === "sprout" || shape === "leech" || shape === "orchid";
  const roughness = glassy ? 0.18 : organic ? 0.45 : 0.34;
  const metalness = organic ? 0.22 : def.rarity === "common" ? 0.3 : 0.52;
  const mat = new THREE.MeshPhysicalMaterial({
    map: patternTexture(def),
    bumpMap: microSurfaceTexture(def, "bump"),
    bumpScale: glassy ? 0.012 : 0.028,
    roughnessMap: microSurfaceTexture(def, "roughness"),
    color: "#ffffff",
    emissive: accent,
    emissiveIntensity: def.visual.emissive * 0.25,
    roughness,
    metalness,
    clearcoat: glassy ? 0.9 : 0.62,
    clearcoatRoughness: glassy ? 0.08 : 0.2,
    envMapIntensity: shape === "void" || shape === "crown" ? 1.4 : glassy ? 1.35 : 0.94,
  });
  const shell = new THREE.Mesh(geo, mat);
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const accentMat = new THREE.MeshStandardMaterial({
    color: accent, metalness: 0.68, roughness: 0.24,
    emissive: accent, emissiveIntensity: 0.12 + def.visual.emissive * 0.24,
  });
  const edgeMat = new THREE.MeshStandardMaterial({ color: base, metalness: 0.7, roughness: 0.3 });
  const glowMat = new THREE.MeshBasicMaterial({
    color: accent, transparent: true, opacity: 0.48,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: "#111827", metalness: 0.46, roughness: 0.3 });
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
  ): THREE.Mesh => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(position[0], position[1], position[2]);
    part.rotation.set(rotation[0], rotation[1], rotation[2]);
    part.scale.set(scale[0], scale[1], scale[2]);
    part.castShadow = true;
    group.add(part);
    return part;
  };
  const addRing = (radius: number, tube: number, position: [number, number, number], rotation: [number, number, number], material: THREE.Material = accentMat) =>
    add(new THREE.TorusGeometry(radius, tube, 8, 40), material, position, rotation);
  const addSpike = (radius: number, height: number, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0], material: THREE.Material = accentMat) =>
    add(new THREE.ConeGeometry(radius, height, 7), material, position, rotation);
  const addTube = (points: Array<[number, number, number]>, radius: number, material: THREE.Material, segments = 24) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    return add(new THREE.TubeGeometry(curve, segments, radius, 6, false), material);
  };

  switch (shape) {
    case "meteor":
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI * 2 / 8;
        addSpike(0.105, 0.31, [Math.cos(a) * 0.79, Math.sin(a * 2) * 0.2, Math.sin(a) * 0.79],
          [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7], accentMat);
      }
      addRing(0.22, 0.032, [0.18, 0.68, 0.02], [0.25, 0.1, 0.2], glowMat);
      addSpike(0.12, 0.35, [0.18, 0.84, 0.02], [0, 0, -0.35], accentMat);
      break;

    case "shield": {
      const face = add(new THREE.CircleGeometry(0.6, 6), glowMat, [0, 0, 0.79], [0, 0, Math.PI / 6]);
      face.userData.ballPart = "shield-face";
      const outline = add(new THREE.EdgesGeometry(face.geometry), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.88 }), [0, 0, 0.8], [0, 0, Math.PI / 6], [1.12, 1.12, 1]);
      outline.userData.ballPart = "shield-outline";
      break;
    }
    case "gear":
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI * 2 / 10;
        add(new THREE.BoxGeometry(0.22, 0.19, 0.36), accentMat, [Math.cos(a) * 0.77, Math.sin(a) * 0.77, 0], [0, 0, a]);
      }
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.46, 12), edgeMat, [0, 0, 0], [Math.PI / 2, 0, 0]);
      addRing(0.33, 0.035, [0, 0, 0.26], [0, 0, 0]);
      break;
    case "leech":
      addRing(0.32, 0.07, [0, -0.22, 0.65], [0, 0, 0], edgeMat);
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        addTube([
          [Math.cos(a) * 0.32, -0.05, Math.sin(a) * 0.32 + 0.56],
          [Math.cos(a + 0.2) * 0.7, -0.2, Math.sin(a + 0.2) * 0.7],
          [Math.cos(a + 0.44) * 1.02, 0.04, Math.sin(a + 0.44) * 1.02],
          [Math.cos(a + 0.72) * 0.92, 0.18, Math.sin(a + 0.72) * 0.92],
        ], 0.05, accentMat, 18);
      }
      break;
    case "shardcluster":
    case "crystalcluster":
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        const size = shape === "shardcluster" ? 0.32 : 0.39;
        add(new THREE.OctahedronGeometry(size, 0), accentMat,
          [Math.cos(a) * 0.76, Math.sin(a * 2) * 0.32, Math.sin(a) * 0.76],
          [a * 0.35, -a, a * 0.2], [0.44, 1.18, 0.48]);
      }
      break;
    case "halo":
      addRing(1.08, 0.065, [0, 0, 0], [0.85, 0.3, 0.25], accentMat);
      addRing(0.92, 0.036, [0, 0, 0], [0.18, 1.02, 0.55], glowMat);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        add(new THREE.OctahedronGeometry(0.32, 0), accentMat,
          [Math.cos(a) * 1.27, Math.sin(a * 1.7) * 0.15, Math.sin(a) * 1.27],
          [0.2, -a, 0.15], [0.38, 1.28, 0.2]);
      }
      break;
    case "comet":
      add(new THREE.SphereGeometry(0.44, 16, 12), glowMat, [0, 0, -0.96], [0, 0, 0], [0.62, 0.62, 2.1]);
      addSpike(0.24, 0.72, [0, 0.06, -1.16], [Math.PI / 2, 0, 0], accentMat);
      addRing(0.56, 0.035, [0, 0, 0], [0.5, 0.2, -0.4], glowMat);
      break;
    case "mite":
      for (let i = 0; i < 6; i++) {
        const side = i < 3 ? -1 : 1, row = i % 3;
        add(new THREE.CylinderGeometry(0.035, 0.055, 0.48, 6), accentMat,
          [side * (0.55 + row * 0.07), 0.02 - row * 0.14, 0.05], [0.2, 0, side * (0.65 + row * 0.18)]);
      }
      addSpike(0.09, 0.32, [-0.18, 0.5, 0.24], [-0.35, 0, -0.4]);
      addSpike(0.09, 0.32, [0.18, 0.5, 0.24], [-0.35, 0, 0.4]);
      break;
    case "knife":
      add(new THREE.OctahedronGeometry(0.38, 0), new THREE.MeshPhysicalMaterial({ color: "#F2F7FF", metalness: 0.96, roughness: 0.13, clearcoat: 1 }),
        [0.28, 0.04, 0.72], [0.2, -0.2, 0.1], [0.22, 0.34, 1.55]);
      add(new THREE.CylinderGeometry(0.055, 0.07, 0.42, 8), darkMat, [0.28, -0.13, 0.36], [0.3, 0, 0]);
      add(new THREE.TorusGeometry(0.12, 0.025, 5, 18), accentMat, [0.28, -0.13, 0.44]);
      break;
    case "magma":
      add(new THREE.SphereGeometry(0.48, 22, 18), new THREE.MeshBasicMaterial({
        color: accent, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false,
      }), [0, 0, 0.18]);
      for (let i = 0; i < 7; i++) {
        const a = i * Math.PI * 2 / 7;
        addTube([
          [Math.cos(a) * 0.42, Math.sin(a) * 0.28, 0.68],
          [Math.cos(a + 0.06) * 0.63, Math.sin(a + 0.06) * 0.52, 0.61],
          [Math.cos(a - 0.08) * 0.82, Math.sin(a - 0.08) * 0.78, 0.25],
        ], 0.018, glowMat, 12);
      }
      break;
    case "lance":
      addSpike(0.34, 0.58, [0, 0.78, 0], [0, 0, 0], accentMat);
      addRing(0.53, 0.035, [0, 0.35, 0], [0, 0, 0], glowMat);
      addRing(0.55, 0.035, [0, -0.16, 0], [0, 0, 0], glowMat);
      break;
    case "serpent":
      addTube([[-0.82,-0.15,-0.22],[-0.86,0.44,0.12],[-0.36,0.77,0.54],[0.35,0.68,0.72],[0.83,0.22,0.42],[0.68,-0.35,0.05]], 0.055, accentMat, 44);
      for (let i = 0; i < 7; i++) addRing(0.45 + i * 0.052, 0.014, [0,0,-0.1], [0.3 + i * .18, i * .22, .15], glowMat);
      break;
    case "sprout":
      add(new THREE.CylinderGeometry(0.07, 0.11, 0.54, 8), edgeMat, [0, 0.73, 0]);
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        addSpike(0.18, 0.62, [Math.cos(a)*0.34,0.94+(i%2)*0.12,Math.sin(a)*0.34],
          [Math.sin(a)*0.8,0,-Math.cos(a)*0.85], accentMat);
      }
      break;
    case "hive":
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7;addSpike(.13,.32,[Math.cos(a)*.73,.53+(i%2)*.12,Math.sin(a)*.73],[Math.sin(a)*.8,0,-Math.cos(a)*.8],accentMat);}
      for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;add(new THREE.SphereGeometry(.085,8,7),glowMat,[Math.cos(a)*1.03,Math.sin(a)*.35,Math.sin(a)*1.03]);}
      break;
    case "webbed": {
      const lines: THREE.Vector3[]=[];
      for(let i=0;i<12;i++){const a=i*Math.PI/6;lines.push(new THREE.Vector3(0,0,.83));lines.push(new THREE.Vector3(Math.cos(a)*.84,Math.sin(a)*.84,.3));}
      for(const rr of [.24,.46,.67])for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2;lines.push(new THREE.Vector3(Math.cos(a)*rr,Math.sin(a)*rr,.47));lines.push(new THREE.Vector3(Math.cos(b)*rr,Math.sin(b)*rr,.47));}
      const web=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines),new THREE.LineBasicMaterial({color:accent,transparent:true,opacity:.82}));web.userData.ballPart="web-skin";group.add(web);break;
    }
    case "reliquary":
      add(new THREE.BoxGeometry(.08,1.24,.12),accentMat,[-.47,0,.39]);add(new THREE.BoxGeometry(.08,1.24,.12),accentMat,[.47,0,.39]);
      add(new THREE.BoxGeometry(1.02,.07,.12),accentMat,[0,.52,.39]);addSpike(.18,.42,[0,.78,0]);addRing(.63,.025,[0,0,-.02],[.3,.2,.1],glowMat);break;
    case "mandolin":
      add(new THREE.BoxGeometry(.18,.82,.13),edgeMat,[0,.56,.31]);add(new THREE.BoxGeometry(.36,.13,.14),accentMat,[0,.98,.31]);
      for(let i=0;i<4;i++){const x=-.075+i*.05;add(new THREE.CylinderGeometry(.008,.008,1.38,5),new THREE.MeshBasicMaterial({color:"#DDF4FF"}),[x,.18,.38]);}
      add(new THREE.BoxGeometry(.5,.035,.06),accentMat,[0,-.35,.43]);break;
    case "monolith":
      for(let i=0;i<4;i++)add(new THREE.BoxGeometry(1.02,.018,.02),accentMat,[0,-.42+i*.27,.38]);
      addRing(.54,.025,[0,0,-.01],[Math.PI/2,0,0],glowMat);break;
    case "book":
      add(new THREE.BoxGeometry(.13,.98,.66),accentMat,[-.56,0,0]);
      add(new THREE.BoxGeometry(1.05,.88,.035),new THREE.MeshStandardMaterial({color:"#EED7B7",roughness:.76}),[.04,0,.335]);
      for(let i=0;i<5;i++)add(new THREE.BoxGeometry(.82,.012,.018),glowMat,[.08,-.32+i*.15,.36]);break;
    case "windblade":
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3;add(new THREE.TetrahedronGeometry(.62,0),accentMat,[Math.cos(a)*.7,Math.sin(a)*.7,0],[.15+a*.15,0,-a],[.6,.45,.25]);}
      addRing(.49,.024,[0,0,0],[.3,.4,0],glowMat);break;
    case "shell":
      for(let i=0;i<7;i++){const a=Math.PI*(.08+i*.12);add(new THREE.TorusGeometry(.55+i*.025,.022,5,30,Math.PI*.86),accentMat,[0,-.2+i*.06,0],[a,.1,-.3]);}
      break;
    case "abacus":
      for(let row=0;row<3;row++){const y=.36-row*.36;add(new THREE.CylinderGeometry(.025,.025,1.3,7),accentMat,[0,y,0],[0,0,Math.PI/2]);for(let bead=0;bead<2;bead++){const x=-.28+row*.21+bead*.46;add(new THREE.SphereGeometry(.105,10,8),bead?glowMat:accentMat,[x,y,.11]);}}
      break;
    case "void":
      addRing(1.02,.052,[0,0,0],[.72,.18,.15],accentMat);addRing(.82,.027,[0,0,0],[.18,1.02,.56],glowMat);
      add(new THREE.SphereGeometry(.37,22,16),glowMat,[0,0,.05]);
      for(let i=0;i<3;i++)addSpike(.15,.42,[Math.cos(i*2.094)*.6,.8,Math.sin(i*2.094)*.6],[0,0,-.5],accentMat);
      break;
    case "kettle":
      add(new THREE.TorusGeometry(.35,.075,8,26,Math.PI*1.6),accentMat,[-.66,.1,-.03],[0,0,Math.PI/2]);
      addSpike(.21,.56,[.76,.14,0],[0,0,-Math.PI/2],accentMat);add(new THREE.CylinderGeometry(.36,.42,.12,12),accentMat,[0,.65,0]);addRing(.22,.04,[0,.72,0],[0,0,0],glowMat);break;
    case "crown":
      addRing(.86,.035,[0,.18,0],[.34,.1,0],accentMat);
      for(let i=0;i<7;i++){const a=Math.PI*2*i/7;addSpike(.12,.42+(i%2)*.16,[Math.cos(a)*.58,.69+(i%2)*.06,Math.sin(a)*.58],[Math.sin(a)*.3,0,-Math.cos(a)*.3],accentMat);}
      break;
    case "atlas":
      addRing(.72,.026,[0,0,.19],[0,0,0],accentMat);addRing(.52,.018,[0,0,.2],[0,0,0],glowMat);
      for(let i=0;i<5;i++)add(new THREE.BoxGeometry(1.2,.012,.012),glowMat,[0,-.42+i*.21,.15]);break;
    case "plum":
      add(new THREE.CylinderGeometry(.035,.055,.3,7),edgeMat,[.08,1.02,0],[.1,0,-.25]);
      add(new THREE.ConeGeometry(.15,.3,5),accentMat,[.22,1.08,0],[.15,0,-1],[1,.55,.5]);addRing(.73,.025,[0,0,0],[.56,.22,.1],glowMat);break;
    case "orchid":
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add(new THREE.SphereGeometry(.35,16,10),new THREE.MeshPhysicalMaterial({color:accent,roughness:.28,metalness:.48,clearcoat:.82,emissive:accent,emissiveIntensity:.12}),[Math.cos(a)*.43,Math.sin(a)*.43,0],[0,0,a],[.68,1.16,.3]);}
      add(new THREE.SphereGeometry(.18,14,10),glowMat,[0,0,.37]);break;
    case "mirror":
      addRing(.78,.045,[0,0,.06],[0,0,0],accentMat);
      for(let i=0;i<4;i++){const a=i*Math.PI/2;add(new THREE.OctahedronGeometry(.28,0),new THREE.MeshPhysicalMaterial({color:"#ECFFFC",metalness:.86,roughness:.12,clearcoat:1,emissive:accent,emissiveIntensity:.14}),[Math.cos(a)*.5,Math.sin(a)*.5,.52],[0,0,a],[.68,.68,.17]);}
      break;
    case "moth": {
      const wingMat=new THREE.MeshPhysicalMaterial({color:accent,transparent:true,opacity:.44,side:THREE.DoubleSide,metalness:.24,roughness:.24,emissive:accent,emissiveIntensity:.16,depthWrite:false});
      add(new THREE.SphereGeometry(.56,16,12),wingMat,[-.55,.03,-.05],[0,0,-.28],[1.25,.72,.12]);add(new THREE.SphereGeometry(.56,16,12),wingMat,[.55,.03,-.05],[0,0,.28],[1.25,.72,.12]);
      addTube([[-.12,.42,.04],[-.26,.7,.03],[-.38,.75,.03]],.018,accentMat,10);addTube([[.12,.42,.04],[.26,.7,.03],[.38,.75,.03]],.018,accentMat,10);addRing(.36,.018,[0,0,.12],[.1,0,0],glowMat);break;
    }
    case "sonar":
      for(let i=0;i<4;i++)addRing(.25+i*.19,.028,[0,0,.21],[0,0,0],i%2?glowMat:accentMat);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;add(new THREE.BoxGeometry(.018,.22,.022),glowMat,[Math.cos(a)*.55,Math.sin(a)*.55,.23],[0,0,a]);}
      break;
    case "cathedral":
      for(let i=0;i<3;i++){const x=-.43+i*.43;addSpike(i===1?.21:.16,i===1?.78:.58,[x,.88+(i===1?.15:0),0],[0,0,0],accentMat);}
      add(new THREE.BoxGeometry(.12,1.03,.18),accentMat,[-.5,0,.39]);add(new THREE.BoxGeometry(.12,1.03,.18),accentMat,[.5,0,.39]);
      add(new THREE.BoxGeometry(.96,.08,.16),accentMat,[0,.44,.4]);add(new THREE.TorusGeometry(.24,.04,7,22,Math.PI),glowMat,[0,.05,.4]);
      for(let i=0;i<3;i++)add(new THREE.BoxGeometry(.06,.19,.02),glowMat,[-.24+i*.24,-.26,.4]);break;
    case "ringed":
      addRing(1.14,.06,[0,0,0],[.65,.25,.4],accentMat);addRing(.9,.035,[0,0,0],[.15,.85,.2],glowMat);break;
    case "horned":
      for(let i=0;i<3;i++)addSpike(.15,.5,[-.48+i*.48,.78,.04],[0,0,-.4+i*.4],accentMat);break;
    case "spiky":
      for(let i=0;i<8;i++){const a=i*Math.PI/4;addSpike(.12,.34,[Math.cos(a)*.75,Math.sin(a)*.54,Math.sin(a)*.75],[Math.sin(a)*.8,0,-Math.cos(a)*.8],accentMat);}break;
    default:
      break;
  }

  const faceShapes = new Set(["shield","leech","shardcluster","halo","comet","mite","magma","serpent","sprout","hive","webbed","plum","orchid","sphere","spiky","faceted","ringed","horned"]);
  if (faceShapes.has(shape)) {
    const eyeMat = new THREE.MeshStandardMaterial({ color: "#151923", roughness: 0.25, metalness: 0.05 });
    add(new THREE.SphereGeometry(0.105, 10, 8), eyeMat, [-0.25, 0.16, 0.76]);
    add(new THREE.SphereGeometry(0.105, 10, 8), eyeMat, [0.25, 0.16, 0.76]);
    const eyeGlow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.75 });
    if (def.visual.face === "robot" || def.visual.face === "focus") {
      add(new THREE.BoxGeometry(0.18, 0.1, 0.04), eyeGlow, [-0.25, 0.16, 0.83]);
      add(new THREE.BoxGeometry(0.18, 0.1, 0.04), eyeGlow, [0.25, 0.16, 0.83]);
    }
    const mouth = def.visual.face === "angry" ? new THREE.BoxGeometry(0.32, 0.055, 0.05)
      : def.visual.face === "sleepy" ? new THREE.BoxGeometry(0.25, 0.025, 0.04)
      : new THREE.BoxGeometry(0.29, 0.07, 0.045);
    add(mouth, darkMat, [0, -0.22, 0.8], [0, 0, def.visual.face === "angry" ? 0.08 : 0]);
  }

  if (shape === "die") {
    const pipMaterial = new THREE.MeshBasicMaterial({ color: "#18202D" });
    const pipGeo = new THREE.SphereGeometry(0.065, 8, 7);
    const pips: Array<[number,number,number]> = [
      [-0.24,0.24,0.705],[0.24,-0.24,0.705],[-0.24,-0.24,0.705],[0.24,0.24,0.705],[0,0,0.705],
      [-0.25,0.705,-0.25],[0.25,0.705,0.25],[0,0.705,0],[-0.25,-0.705,0.25],[0.25,-0.705,-0.25],
    ];
    for(const p of pips) add(pipGeo,pipMaterial,p);
  }

  const particleMode = def.visual.particles;
  if (particleMode && particleMode !== "none") {
    const count = particleMode === "leaves" ? 4 : particleMode === "smoke" ? 5 : 6;
    const particleColor = particleMode === "snow" ? "#effaff"
      : particleMode === "leaves" ? "#8df0b4"
      : particleMode === "embers" ? "#ffb45f"
      : particleMode === "bubbles" ? "#b8f5ff"
      : particleMode === "stars" ? "#ffffff"
      : accent;
    for (let i = 0; i < count; i++) {
      const geometry = particleMode === "leaves"
        ? new THREE.ConeGeometry(0.085, 0.24, 4)
        : particleMode === "smoke" || particleMode === "bubbles"
          ? new THREE.SphereGeometry(particleMode === "smoke" ? 0.12 : 0.075, 10, 8)
          : new THREE.OctahedronGeometry(particleMode === "embers" ? 0.065 : 0.075, 0);
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: particleColor, transparent: true,
        opacity: particleMode === "smoke" ? 0.22 : particleMode === "bubbles" ? 0.48 : 0.82,
        blending: particleMode === "smoke" || particleMode === "bubbles" ? THREE.NormalBlending : THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particle = new THREE.Mesh(geometry, particleMaterial);
      particle.userData.ballPart = "aura-particle";
      particle.userData.auraIndex = i;
      particle.userData.auraCount = count;
      particle.userData.auraRadius = 1.15 + (i % 2) * 0.18;
      particle.userData.auraSpeed = particleMode === "smoke" ? 0.8 : particleMode === "leaves" ? 1.25 : 1.9;
      particle.position.set(Math.cos(i / count * Math.PI * 2) * 1.14, Math.sin(i * 1.7) * 0.34, Math.sin(i / count * Math.PI * 2) * 1.14);
      group.add(particle);
    }
  }

  const trailLength = Math.max(0, Math.min(1.5, def.visual.trail.length));
  if (trailLength >= 0.65) {
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: def.visual.trail.color || accent, transparent: true, opacity: 0.24,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const trailRing = new THREE.Mesh(new THREE.TorusGeometry(0.98 + trailLength * 0.15, 0.022 + trailLength * 0.012, 5, 36), trailMaterial);
    trailRing.userData.ballPart = "trail-orbit";
    trailRing.rotation.set(0.65, 0.25, 0.9);
    trailRing.scale.set(1.08, 0.78, 1);
    group.add(trailRing);
  }

  group.userData.defId = def.id;
  group.userData.signature = shape;
  group.userData.visualIdentity = { shape, pattern: def.visual.pattern, baseColor: base, accentColor: accent };
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
  private environmentAssetRecords = new Map<string, {
    root: THREE.Group;
    mixer: THREE.AnimationMixer | null;
    animationRoot: THREE.Object3D | null;
    zone: "lobby" | "arena";
    spinSpeed: number;
  }>();
  private environmentAssetLoaded = new Set<string>();
  private environmentAssetFailed = new Set<string>();
  private environmentAssetLoadingIds = new Set<string>();
  private environmentAssetPackCheck: Promise<boolean> | null = null;
  private environmentAssetPackAvailable: boolean | null = null;
  private environmentAssetQueueRunning = false;
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
    this.syncEnvironmentAssetsForQuality();
  }

  private hasEnvironmentAssetPack(): Promise<boolean> {
    if (!this.environmentAssetPackCheck) {
      // One tiny HEAD probe avoids firing a wall of 404 requests when a deployment
      // has not received the optional GLB pack yet.
      this.environmentAssetPackCheck = fetch(getEnvironmentAssetUrl("Spawn_Beacon_Platform.glb"), {
        method: "HEAD",
        cache: "force-cache",
      }).then((response) => {
        this.environmentAssetPackAvailable = response.ok;
        return response.ok;
      }).catch(() => {
        this.environmentAssetPackAvailable = false;
        return false;
      });
    }
    return this.environmentAssetPackCheck;
  }

  private syncEnvironmentAssetsForQuality(): void {
    if (this.destroyed || this.environmentAssetQueueRunning) return;
    this.environmentAssetQueueRunning = true;

    void (async () => {
      try {
        if (!(await this.hasEnvironmentAssetPack()) || this.destroyed) return;

        // Keep loading serial: mobile browsers should decode one textured GLB at a
        // time instead of competing for memory with the rest of the initial scene.
        while (!this.destroyed) {
          const next = getEnvironmentAssetsForQuality(this.quality).find(
            (asset) => !this.environmentAssetLoaded.has(asset.id)
              && !this.environmentAssetFailed.has(asset.id)
              && !this.environmentAssetLoadingIds.has(asset.id),
          );
          if (!next) break;
          await this.loadEnvironmentAsset(next);
        }
      } finally {
        this.environmentAssetQueueRunning = false;
        if (!this.destroyed && this.environmentAssetPackAvailable === true && getEnvironmentAssetsForQuality(this.quality).some(
          (asset) => !this.environmentAssetLoaded.has(asset.id)
            && !this.environmentAssetFailed.has(asset.id),
        )) {
          queueMicrotask(() => this.syncEnvironmentAssetsForQuality());
        }
      }
    })();
  }

  private async loadEnvironmentAsset(definition: EnvironmentAssetDefinition): Promise<void> {
    const url = getEnvironmentAssetUrl(definition.file);
    this.environmentAssetLoadingIds.add(definition.id);

    try {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(url);
      if (this.destroyed) {
        const geometries = new Set<THREE.BufferGeometry>();
        const materials = new Set<THREE.Material>();
        const textures = new Set<THREE.Texture>();
        gltf.scene.traverse((node) => {
          const mesh = node as THREE.Object3D & {
            geometry?: THREE.BufferGeometry;
            material?: THREE.Material | THREE.Material[];
          };
          if (mesh.geometry instanceof THREE.BufferGeometry) geometries.add(mesh.geometry);
          const nodeMaterials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
          for (const material of nodeMaterials) {
            materials.add(material);
            for (const value of Object.values(material)) {
              if (value instanceof THREE.Texture) textures.add(value);
            }
          }
        });
        for (const texture of textures) texture.dispose();
        for (const material of materials) material.dispose();
        for (const geometry of geometries) geometry.dispose();
        return;
      }

      const model = gltf.scene;
      model.name = `mvm-environment-model:${definition.id}`;
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const dimensions = bounds.getSize(new THREE.Vector3());
      const sourceExtent = Math.max(dimensions.x, dimensions.y, dimensions.z);
      if (!Number.isFinite(sourceExtent) || sourceExtent < 0.01) {
        throw new Error(`GLB has no measurable geometry: ${definition.file}`);
      }

      // Every source is normalized by its actual bounds, rather than trusting an
      // assumed unit scale. This also handles the untouched meshopt BOPPO source.
      const scale = definition.targetExtent / sourceExtent;
      const center = bounds.getCenter(new THREE.Vector3());
      const fit = new THREE.Group();
      fit.name = `mvm-environment-fit:${definition.id}`;
      fit.scale.setScalar(scale);
      fit.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      fit.add(model);

      const root = new THREE.Group();
      root.name = `mvm-environment:${definition.id}`;
      root.position.set(...definition.position);
      root.rotation.y = definition.rotationY;
      root.add(fit);

      model.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = this.quality === "high";
          node.receiveShadow = this.quality === "high";
          node.frustumCulled = true;
        }
      });

      const zone = definition.zone === "lobby" ? this.lobby : this.arena;
      zone.add(root);

      // Large scenery pieces use a subtle parent spin instead of a scaled hover
      // clip. Small objects can safely play their authored 4-second showcase loop.
      const clip = gltf.animations.find((candidate) => candidate.name === "Idle_Showcase_Loop");
      let mixer: THREE.AnimationMixer | null = null;
      let animationRoot: THREE.Object3D | null = null;
      const canPlayShowcase = definition.motion === "showcase" && Boolean(clip) && scale <= 1.55;
      if (canPlayShowcase && clip) {
        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
        animationRoot = model;
      }

      this.environmentAssetRecords.set(definition.id, {
        root,
        mixer,
        animationRoot,
        zone: definition.zone,
        spinSpeed: definition.motion === "spin" || (definition.motion === "showcase" && !canPlayShowcase)
          ? definition.spinSpeed ?? 0.025
          : 0,
      });
      this.environmentAssetLoaded.add(definition.id);
      console.info("[Ball Arena] MVM environment asset ready.", { id: definition.id, zone: definition.zone, quality: this.quality });
    } catch (error) {
      this.environmentAssetFailed.add(definition.id);
      console.warn("[Ball Arena] Optional MVM environment asset could not load.", { id: definition.id, url, error });
    } finally {
      this.environmentAssetLoadingIds.delete(definition.id);
    }
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
    for (const asset of this.environmentAssetRecords.values()) {
      asset.root.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = high;
          node.receiveShadow = high;
        }
      });
    }
    this.syncEnvironmentAssetsForQuality();
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
    // Environment motion is presentation-only: it never enters deterministic combat
    // state and runs only for assets belonging to the currently visible scene.
    for (const asset of this.environmentAssetRecords.values()) {
      if (asset.zone !== draw.mode) continue;
      if (!draw.reduceMotion && asset.mixer) asset.mixer.update(Math.min(dt, 0.05));
      else if (!draw.reduceMotion && asset.spinSpeed) asset.root.rotation.y += dt * asset.spinSpeed;
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
    for (const asset of this.environmentAssetRecords.values()) {
      asset.mixer?.stopAllAction();
      if (asset.mixer && asset.animationRoot) asset.mixer.uncacheRoot(asset.animationRoot);
    }
    this.environmentAssetRecords.clear();
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
    const sharedMicroTextures = new Set<THREE.Texture>(microSurfaceTextures.values());
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
