import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MVM_ENVIRONMENT_ASSETS } from "@/render/arena-assets";

export const Route = createFileRoute("/mvm-model-lab")({ component: MvmModelLab });

type ModelFacts = {
  dimensions: string;
  meshCount: number;
  materialCount: number;
  textureCount: number;
  animations: string[];
  vertexCount: number;
};

type ViewerRuntime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  clock: THREE.Clock;
  model: THREE.Object3D | null;
  mixer: THREE.AnimationMixer | null;
  resizeObserver: ResizeObserver;
};

function disposeModel(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    const mesh = node as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (mesh.geometry instanceof THREE.BufferGeometry) geometries.add(mesh.geometry);
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of list) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function MvmModelLab() {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ViewerRuntime | null>(null);
  const requestRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRotate, setAutoRotate] = useState(true);
  const rotateRef = useRef(autoRotate);
  rotateRef.current = autoRotate;
  const [facts, setFacts] = useState<ModelFacts | null>(null);
  const asset = MVM_ENVIRONMENT_ASSETS[activeIndex] ?? MVM_ENVIRONMENT_ASSETS[0];

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;
    let disposed = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#080b14");
    scene.fog = new THREE.Fog("#080b14", 34, 95);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 240);
    camera.position.set(8, 6, 9);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "Interactive full-size 3D model preview");
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    scene.add(new THREE.HemisphereLight("#d5eaff", "#12101f", 1.15));
    const key = new THREE.DirectionalLight("#fff0d6", 2.4);
    key.position.set(8, 12, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#9272ff", 2.0);
    rim.position.set(-10, 7, -8);
    scene.add(rim);
    const fill = new THREE.DirectionalLight("#45d8f3", 0.85);
    fill.position.set(-3, 4, 10);
    scene.add(fill);

    const stage = new THREE.Mesh(
      new THREE.CircleGeometry(8, 64),
      new THREE.MeshStandardMaterial({ color: "#101827", roughness: 0.3, metalness: 0.72 }),
    );
    stage.rotation.x = -Math.PI / 2;
    stage.position.y = -0.035;
    scene.add(stage);
    const stageRing = new THREE.Mesh(
      new THREE.RingGeometry(6.2, 6.24, 96),
      new THREE.MeshBasicMaterial({ color: "#4bdcf5", transparent: true, opacity: 0.55 }),
    );
    stageRing.rotation.x = -Math.PI / 2;
    stageRing.position.y = -0.02;
    scene.add(stageRing);
    const grid = new THREE.GridHelper(18, 36, "#3b4765", "#202a40");
    grid.position.y = -0.025;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.26;
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.25;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 80;
    const clock = new THREE.Clock();
    const resizeObserver = new ResizeObserver(() => {
      if (disposed) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(host);
    resizeObserverRefit(renderer, camera, host);

    runtimeRef.current = { scene, camera, renderer, controls, clock, model: null, mixer: null, resizeObserver };
    const animate = () => {
      if (disposed) return;
      frame = window.requestAnimationFrame(animate);
      controls.autoRotate = rotateRef.current;
      controls.update();
      const delta = Math.min(0.05, clock.getDelta());
      runtimeRef.current?.mixer?.update(delta);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      const runtime = runtimeRef.current;
      if (runtime?.mixer) runtime.mixer.stopAllAction();
      if (runtime?.model) {
        scene.remove(runtime.model);
        disposeModel(runtime.model);
      }
      runtimeRef.current = null;
      stage.geometry.dispose();
      (stage.material as THREE.Material).dispose();
      stageRing.geometry.dispose();
      (stageRing.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const requestId = ++requestRef.current;
    let cancelled = false;
    setLoading(true);
    setError("");
    setFacts(null);
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.loadAsync(`/assets/arena/${asset.file}`).then((gltf) => {
      if (cancelled || requestId !== requestRef.current) {
        disposeModel(gltf.scene);
        return;
      }
      if (runtime.model) {
        runtime.scene.remove(runtime.model);
        runtime.mixer?.stopAllAction();
        runtime.mixer = null;
        disposeModel(runtime.model);
        runtime.model = null;
      }

      const model = gltf.scene;
      model.name = `inspect:${asset.id}`;
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const sourceExtent = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(sourceExtent) || sourceExtent < 0.01) throw new Error("Model has no measurable geometry.");

      const fit = new THREE.Group();
      fit.name = `model-fit:${asset.id}`;
      const scale = 5.0 / sourceExtent;
      fit.scale.setScalar(scale);
      fit.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      fit.add(model);
      runtime.scene.add(fit);
      runtime.model = fit;

      const distance = Math.max(8.5, Math.min(24, asset.targetExtent * 1.35 + 5));
      runtime.camera.position.set(distance * 0.88, distance * 0.62, distance * 1.02);
      runtime.camera.near = Math.max(0.025, distance / 600);
      runtime.camera.far = 240;
      runtime.camera.updateProjectionMatrix();
      runtime.controls.target.set(0, Math.min(2.7, asset.targetExtent * 0.31), 0);
      runtime.controls.minDistance = Math.max(2.2, asset.targetExtent * 0.3);
      runtime.controls.maxDistance = Math.max(24, asset.targetExtent * 4.3);
      runtime.controls.update();

      const materialSet = new Set<THREE.Material>();
      const textureSet = new Set<THREE.Texture>();
      let meshCount = 0;
      let vertexCount = 0;
      model.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        meshCount += 1;
        vertexCount += node.geometry.getAttribute("position")?.count ?? 0;
        const list = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of list) {
          materialSet.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textureSet.add(value);
        }
      });
      const animations = gltf.animations.map((clip) => clip.name || "Unnamed clip");
      const presentationClip = gltf.animations.find((clip) => clip.name === "Idle_Showcase_Loop") ?? gltf.animations[0];
      if (presentationClip) {
        runtime.mixer = new THREE.AnimationMixer(model);
        runtime.mixer.clipAction(presentationClip).setLoop(THREE.LoopRepeat, Infinity).play();
      }
      setFacts({
        dimensions: `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`,
        meshCount,
        materialCount: materialSet.size,
        textureCount: textureSet.size,
        animations,
        vertexCount,
      });
      setLoading(false);
    }).catch((loadError: unknown) => {
      if (cancelled || requestId !== requestRef.current) return;
      setLoading(false);
      setError(loadError instanceof Error ? loadError.message : "The model could not be loaded.");
    });

    return () => {
      cancelled = true;
    };
  }, [activeIndex, asset.file, asset.id, asset.targetExtent]);

  const goTo = (index: number) => {
    setActiveIndex((index + MVM_ENVIRONMENT_ASSETS.length) % MVM_ENVIRONMENT_ASSETS.length);
  };

  return (
    <main className="mvm-lab">
      <style>{`
        .mvm-lab{min-height:100vh;background:#070a12;color:#edf4ff;font-family:Inter,ui-sans-serif,system-ui,sans-serif;padding:24px;box-sizing:border-box}
        .mvm-lab *{box-sizing:border-box}
        .mvm-lab button{font:inherit;color:inherit;cursor:pointer}
        .mvm-lab .lab-header{display:flex;justify-content:space-between;gap:18px;align-items:center;max-width:1440px;margin:0 auto 20px}
        .mvm-lab .eyebrow{font-size:11px;letter-spacing:.2em;color:#72dbf4;font-weight:800}
        .mvm-lab h1{font-size:clamp(24px,4vw,40px);line-height:1.02;letter-spacing:-.045em;margin:8px 0}
        .mvm-lab .subhead{color:#91a1b7;font-size:13px;line-height:1.65;max-width:720px;margin:0}
        .mvm-lab .header-actions{display:flex;gap:8px;flex-wrap:wrap}
        .mvm-lab .action{border:1px solid #29364b;background:#101827;border-radius:8px;padding:10px 14px;font-weight:800;font-size:12px;letter-spacing:.035em}
        .mvm-lab .action.primary{background:#173244;border-color:#2a7c98;color:#a6f0ff}
        .mvm-lab .lab-layout{max-width:1440px;display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,.8fr);gap:16px;margin:0 auto}
        .mvm-lab .viewport{height:min(61vh,620px);min-height:360px;position:relative;overflow:hidden;border:1px solid #27344a;border-radius:12px;background:#080b14}
        .mvm-lab .viewer-tag{position:absolute;z-index:2;left:16px;top:16px;padding:7px 10px;border:1px solid #344258;background:#0a111dcc;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:.14em;color:#a6f0ff}
        .mvm-lab .loading-state{position:absolute;inset:0;z-index:3;display:grid;place-items:center;background:#070a12a8;color:#d6e8f5;font-size:12px;letter-spacing:.1em;font-weight:800}
        .mvm-lab .details{border:1px solid #27344a;border-radius:12px;background:linear-gradient(145deg,#101725,#090d16);padding:22px;min-width:0}
        .mvm-lab .map-pill{display:inline-flex;border:1px solid #38465f;border-radius:5px;padding:6px 8px;color:#d0bdff;font-size:10px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}
        .mvm-lab h2{font-size:clamp(22px,2.5vw,30px);line-height:1.06;letter-spacing:-.04em;margin:14px 0 12px}
        .mvm-lab .purpose{color:#b9c7d9;font-size:13px;line-height:1.7;margin:0 0 18px}
        .mvm-lab .fact-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}
        .mvm-lab .fact{padding:11px;border:1px solid #27344a;border-radius:7px;background:#0b111d;min-width:0}
        .mvm-lab .fact span{display:block;color:#75869c;font-size:9px;font-weight:900;letter-spacing:.13em;margin-bottom:7px}
        .mvm-lab .fact strong{font-size:14px;word-break:break-word}
        .mvm-lab .fine{color:#72849b;font-size:11px;line-height:1.55}
        .mvm-lab .clips{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
        .mvm-lab .clip{padding:5px 7px;border:1px solid #30435a;border-radius:4px;color:#a7e8f4;font-size:10px}
        .mvm-lab .asset-section{max-width:1440px;margin:22px auto 0}
        .mvm-lab .asset-section-head{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:12px}
        .mvm-lab .asset-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
        .mvm-lab .asset-choice{min-width:0;text-align:left;display:flex;flex-direction:column;gap:6px;padding:12px 10px;background:#0b111c;border:1px solid #202c3e;border-radius:7px;transition:border-color .15s,background .15s}
        .mvm-lab .asset-choice:hover{border-color:#4b98b0}
        .mvm-lab .asset-choice[aria-pressed=true]{background:#122333;border-color:#3aa4c4;box-shadow:inset 0 0 0 1px #3aa4c444}
        .mvm-lab .asset-number{font-size:9px;letter-spacing:.13em;color:#6f849d;font-weight:900}
        .mvm-lab .asset-name{font-size:12px;font-weight:800;line-height:1.35;overflow-wrap:anywhere}
        .mvm-lab .asset-zone{font-size:9px;letter-spacing:.1em;font-weight:900;color:#99a9bd;text-transform:uppercase}
        .mvm-lab .lab-footer{max-width:1440px;margin:18px auto 0;padding-top:14px;border-top:1px solid #202a3c;display:flex;justify-content:space-between;gap:15px;color:#708198;font-size:10px;letter-spacing:.1em}
        @media(max-width:960px){.mvm-lab{padding:16px}.mvm-lab .lab-layout{grid-template-columns:1fr}.mvm-lab .viewport{height:52vh;min-height:320px}.mvm-lab .asset-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.mvm-lab .details{padding:18px}}
        @media(max-width:520px){.mvm-lab{padding:12px}.mvm-lab .lab-header{align-items:flex-start;flex-direction:column}.mvm-lab .header-actions{width:100%}.mvm-lab .action{flex:1}.mvm-lab .viewport{min-height:290px;height:42vh}.mvm-lab .asset-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mvm-lab .lab-footer{flex-direction:column}}
      `}</style>
      <header className="lab-header">
        <div>
          <span className="eyebrow">MVM WORLD KIT / INSPECTION BAY</span>
          <h1>ASSET LAB<span style={{ color: "#4bdcf5" }}>.</span></h1>
          <p className="subhead">Each original GLB loads alone in a full-size interactive viewport. Drag to inspect the geometry, scroll or pinch to zoom, and check the measured bounds, materials and authored animation clips.</p>
        </div>
        <div className="header-actions">
          <button className="action" type="button" onClick={() => setAutoRotate((value) => !value)}>{autoRotate ? "PAUSE ROTATION" : "AUTO ROTATE"}</button>
          <button className="action primary" type="button" onClick={() => window.location.assign("/")}>RETURN TO BALL ARENA ↗</button>
        </div>
      </header>

      <section className="lab-layout">
        <div className="viewport" ref={hostRef}>
          <div className="viewer-tag">LIVE GLB · {String(activeIndex + 1).padStart(2, "0")} / 18</div>
          {(loading || error) && <div className="loading-state">{error ? `LOAD ERROR · ${error}` : "LOADING AUTHORED MODEL…"}</div>}
        </div>
        <aside className="details">
          <span className="map-pill">{asset.feature}</span>
          <h2>{asset.displayName}</h2>
          <p className="purpose">{asset.purpose}</p>
          <div className="fact-grid">
            <div className="fact"><span>MODEL BOUNDS</span><strong>{facts?.dimensions ?? "Measuring…"}</strong></div>
            <div className="fact"><span>TARGET WORLD SIZE</span><strong>{asset.targetExtent.toFixed(1)} units</strong></div>
            <div className="fact"><span>MESH OBJECTS</span><strong>{facts?.meshCount ?? "—"}</strong></div>
            <div className="fact"><span>VERTEX COUNT</span><strong>{facts ? facts.vertexCount.toLocaleString() : "—"}</strong></div>
            <div className="fact"><span>PBR MATERIALS</span><strong>{facts?.materialCount ?? "—"}</strong></div>
            <div className="fact"><span>TEXTURES</span><strong>{facts?.textureCount ?? "—"}</strong></div>
          </div>
          <div className="fine"><strong style={{ color: "#c6d5e8" }}>Asset file</strong><br />/assets/arena/{asset.file}</div>
          <div className="clips">
            {(facts?.animations.length ? facts.animations : loading ? ["Reading GLB clips…"] : ["No animation clips found"]).map((clip) => <span key={clip} className="clip">{clip}</span>)}
          </div>
          <p className="fine" style={{ marginTop: 16 }}>World placement: <strong style={{ color: "#c6d5e8" }}>({asset.position.join(", ")})</strong>. The viewer normalizes only the inspection camera framing; the game uses its own target world size.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button className="action" style={{ flex: 1 }} type="button" onClick={() => goTo(activeIndex - 1)}>← PREVIOUS</button>
            <button className="action primary" style={{ flex: 1 }} type="button" onClick={() => goTo(activeIndex + 1)}>NEXT MODEL →</button>
          </div>
        </aside>
      </section>

      <section className="asset-section">
        <div className="asset-section-head">
          <div><span className="eyebrow">ALL 18 ASSETS</span><h2 style={{ margin: "7px 0 0", fontSize: 20 }}>Select one model to render</h2></div>
          <span className="fine">One GLB at a time · no mini previews</span>
        </div>
        <div className="asset-grid">
          {MVM_ENVIRONMENT_ASSETS.map((entry, index) => (
            <button key={entry.id} className="asset-choice" type="button" aria-pressed={index === activeIndex} onClick={() => goTo(index)}>
              <span className="asset-number">MODEL {String(index + 1).padStart(2, "0")}</span>
              <span className="asset-name">{entry.displayName}</span>
              <span className="asset-zone">{entry.zone === "rift" ? "RIFT EXPANSE" : entry.zone}</span>
            </button>
          ))}
        </div>
      </section>
      <footer className="lab-footer"><span>BALL ARENA · MVM WORLD EXPANSION</span><span>{loading ? "RENDERER LOADING" : error ? "MODEL FAILED TO LOAD" : `MODEL ${activeIndex + 1} READY · DRAG TO ORBIT`}</span></footer>
    </main>
  );
}

function resizeObserverRefit(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, host: HTMLDivElement) {
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
