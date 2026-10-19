import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Cpu, Download, Layers3, LoaderCircle, ShieldCheck } from "lucide-react";

const BRAND_ASSET = "/brand/ball-arena-wordmark.svg";
const AVATAR_ASSET = "/assets/avatars/MVM_BOPPO_v5.glb";
type BootTask = "brand" | "fonts" | "avatar" | "engine" | "preview";
const BOOT_PROGRESS_WEIGHT: Record<BootTask, number> = { brand: 0.08, fonts: 0.12, avatar: 0.46, engine: 0.24, preview: 0.1 };

async function readAsset(
  url: string,
  signal: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal, cache: "default" });
  if (!response.ok) throw new Error("Asset request failed: " + response.status);

  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress?.(1);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    received += value.byteLength;
    if (total > 0) onProgress?.(Math.min(1, received / total));
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress?.(1);
  return bytes.buffer;
}

export function ArenaEntryExperience() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(3);
  const [assetsSettled, setAssetsSettled] = useState(false);
  const [modelBuffer, setModelBuffer] = useState<ArrayBuffer | null>(null);
  const [previewSettled, setPreviewSettled] = useState(false);
  const [previewAvailable, setPreviewAvailable] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const exitTimer = useRef<number | null>(null);
  const progressTasks = useRef<Record<BootTask, number>>({ brand: 0, fonts: 0, avatar: 0, engine: 0, preview: 0 });

  const reportProgress = useCallback((task: BootTask, fraction: number) => {
    progressTasks.current[task] = Math.max(
      progressTasks.current[task],
      Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0)),
    );
    const total = (Object.keys(BOOT_PROGRESS_WEIGHT) as BootTask[])
      .reduce((sum, key) => sum + BOOT_PROGRESS_WEIGHT[key] * progressTasks.current[key], 0);
    setProgress((current) => Math.max(current, Math.min(99, Math.round(3 + 97 * total))));
  }, []);

  const onPreviewReady = useCallback((available: boolean) => {
    setPreviewAvailable(available);
    setPreviewSettled(true);
    if (!available) setFallbackMode(true);
    reportProgress("preview", 1);
  }, [reportProgress]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    const brandTask = (async () => {
      try {
        const response = await fetch(BRAND_ASSET, { signal: controller.signal, cache: "default" });
        if (!response.ok) throw new Error("Brand asset unavailable");
        await response.arrayBuffer();
      } catch {
        if (active) setFallbackMode(true);
      } finally {
        if (active) reportProgress("brand", 1);
      }
    })();

    const fontTask = (async () => {
      try {
        await Promise.all([
          document.fonts.load('700 64px "Chakra Petch"'),
          document.fonts.load('500 16px "Inter"'),
          document.fonts.load('600 12px "IBM Plex Mono"'),
        ]);
      } catch {
        if (active) setFallbackMode(true);
      } finally {
        if (active) reportProgress("fonts", 1);
      }
    })();

    const avatarTask = (async () => {
      try {
        const buffer = await readAsset(AVATAR_ASSET, controller.signal, (fraction) => {
          if (active) reportProgress("avatar", fraction);
        });
        if (active) {
          setModelBuffer(buffer);
          reportProgress("avatar", 1);
        }
      } catch {
        if (active) {
          setFallbackMode(true);
          setPreviewSettled(true);
          reportProgress("avatar", 1);
          reportProgress("preview", 1);
        }
      }
    })();

    const engineTask = (async () => {
      try {
        await Promise.all([
          import("three"),
          import("three/examples/jsm/loaders/GLTFLoader.js"),
        ]);
      } catch {
        if (active) setFallbackMode(true);
      } finally {
        if (active) reportProgress("engine", 1);
      }
    })();

    void Promise.allSettled([brandTask, fontTask, avatarTask, engineTask]).then(() => {
      if (active) setAssetsSettled(true);
    });

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    };
  }, [reportProgress]);

  useEffect(() => {
    if (!assetsSettled || !previewSettled) return;
    const readyTimer = window.setTimeout(() => {
      setProgress(100);
    }, 220);
    return () => window.clearTimeout(readyTimer);
  }, [assetsSettled, previewSettled, advance]);

  const ready = assetsSettled && previewSettled && progress >= 100;

  const enterArena = () => {
    if (!ready || leaving) return;
    setLeaving(true);
    exitTimer.current = window.setTimeout(() => setVisible(false), 460);
  };

  if (!visible) return null;

  const stage = ready
    ? fallbackMode ? "READY · SAFE VISUAL MODE" : "ALL SYSTEMS SYNCHRONIZED"
    : progress < 18 ? "INITIALIZING CORE SYSTEMS"
      : progress < 30 ? "SYNCHRONIZING INTERFACE"
        : progress < 91 ? "STREAMING AVATAR PACKAGE"
          : "CALIBRATING 3D PREVIEW";

  return (
    <section
      className={"ba-entry" + (leaving ? " ba-entry--leaving" : "")}
      aria-label="Ball Arena startup"
      aria-busy={!ready}
    >
      <div className="ba-entry-noise" aria-hidden="true" />
      <div className="ba-entry-grid" aria-hidden="true" />
      <div className="ba-entry-sweep" aria-hidden="true" />

      <div className="ba-entry-frame">
        <header className="ba-entry-header">
          <a className="ba-entry-brand" href="/" aria-label="Ball Arena home">
            <img src={BRAND_ASSET} alt="BALL ARENA — Physics Duel League" />
          </a>
          <div className="ba-entry-system">
            <span className="ba-entry-system-dot" />
            <span>ARENA OS <i> / </i> v2.6</span>
          </div>
        </header>

        <main className="ba-entry-main">
          <section className="ba-entry-copy">
            <div className="ba-entry-kicker"><span>01</span> PHYSICS DUEL LEAGUE <span className="ba-entry-kicker-line" /></div>
            <h1>ENTER THE<br /><em>ARENA.</em></h1>
            <p className="ba-entry-description">Precision meets impact. Choose your fighter, master the physics, and make every collision count.</p>

            <div className="ba-entry-specs" aria-label="Arena systems">
              <div><span className="ba-entry-spec-icon"><Cpu size={15} /></span><span><b>PHYSICS CORE</b><small>REAL-TIME SIMULATION</small></span></div>
              <div><span className="ba-entry-spec-icon"><Layers3 size={15} /></span><span><b>AVATAR SYSTEM</b><small>{previewAvailable ? "3D ASSET READY" : "ADAPTIVE PREVIEW"}</small></span></div>
            </div>
          </section>

          <section className="ba-entry-showcase" aria-label="3D avatar preview">
            <div className="ba-entry-showcase-top"><span>FIG. 001</span><span>CHARACTER / MVM BOPPO</span></div>
            <div className="ba-entry-orbit ba-entry-orbit--outer" aria-hidden="true" />
            <div className="ba-entry-orbit ba-entry-orbit--inner" aria-hidden="true" />
            <div className="ba-entry-crosshair ba-entry-crosshair--top" aria-hidden="true" />
            <div className="ba-entry-crosshair ba-entry-crosshair--bottom" aria-hidden="true" />
            {modelBuffer ? (
              <AvatarPreview buffer={modelBuffer} onReady={onPreviewReady} />
            ) : (
              <div className="ba-entry-avatar-fallback" aria-hidden="true"><span>MVM</span><i /></div>
            )}
            <div className="ba-entry-showcase-bottom">
              <span><i /> LIVE RENDER PIPELINE</span>
              <span>GLB / WEBGL</span>
            </div>
            <div className="ba-entry-coordinate" aria-hidden="true">35° 41′ N<br />139° 41′ E</div>
          </section>
        </main>

        <footer className="ba-entry-footer">
          <div className="ba-entry-load">
            <div className="ba-entry-load-heading">
              <span className="ba-entry-load-status">{ready ? <Check size={13} /> : <LoaderCircle size={13} className="ba-entry-spinner" />} {stage}</span>
              <span className="ba-entry-percent">{String(progress).padStart(2, "0")}<small>%</small></span>
            </div>
            <div className="ba-entry-progress" role="progressbar" aria-label="Startup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <span style={{ transform: "scaleX(" + progress / 100 + ")" }} />
            </div>
            <div className="ba-entry-load-meta">
              <span><Download size={12} /> CORE ASSETS</span>
              <span><ShieldCheck size={12} /> {fallbackMode ? "FALLBACK ENABLED" : ready ? "INTEGRITY CHECKED" : "CHECKING INTEGRITY"}</span>
            </div>
          </div>

          <button className="ba-entry-enter" type="button" onClick={enterArena} disabled={!ready}>
            <span>{ready ? "ENTER ARENA" : "PREPARING ARENA"}</span>
            <span className="ba-entry-enter-icon">{ready ? <ArrowUpRight size={19} /> : <LoaderCircle size={17} className="ba-entry-spinner" />}</span>
          </button>
        </footer>
        <div className="ba-entry-bottomline"><span>BALL ARENA <i>©</i> 2026</span><span>BUILT FOR THE NEXT ROUND</span><span>SECURE LOCAL BOOT <b>●</b></span></div>
      </div>
    </section>
  );
}

function AvatarPreview({ buffer, onReady }: { buffer: ArrayBuffer; onReady: (available: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderable, setRenderable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      onReady(false);
      return;
    }

    let disposed = false;
    let frame = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let scene: import("three").Scene | null = null;
    let camera: import("three").PerspectiveCamera | null = null;
    let avatar: import("three").Object3D | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const resize = () => {
      if (!renderer || !camera || !canvas.parentElement) return;
      const bounds = canvas.parentElement.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds.width));
      const height = Math.max(1, Math.floor(bounds.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const release = () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      if (scene) {
        scene.traverse((object) => {
          const node = object as unknown as {
            isMesh?: boolean;
            geometry?: { dispose?: () => void };
            material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
          };
          if (!node.isMesh) return;
          node.geometry?.dispose?.();
          const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
          materials.forEach((material) => material.dispose?.());
        });
      }
      renderer?.dispose();
    };

    const mount = async () => {
      try {
        const [THREE, { GLTFLoader }] = await Promise.all([
          import("three"),
          import("three/examples/jsm/loaders/GLTFLoader.js"),
        ]);
        if (disposed) return;

        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.setClearColor(0x000000, 0);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
        camera.position.set(0, 0.12, 4.25);
        scene.add(new THREE.HemisphereLight(0xe5f2ff, 0x202536, 2.1));

        const keyLight = new THREE.DirectionalLight(0xffded2, 3.2);
        keyLight.position.set(2.5, 3.5, 4);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0x72d9ff, 2.4);
        rimLight.position.set(-3, 1.5, -2.5);
        scene.add(rimLight);

        resize();
        resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
        if (resizeObserver && canvas.parentElement) resizeObserver.observe(canvas.parentElement);
        else window.addEventListener("resize", resize);

        new GLTFLoader().parse(buffer, "", (gltf) => {
          if (disposed || !scene || !renderer || !camera) return;
          avatar = gltf.scene;
          const bounds = new THREE.Box3().setFromObject(avatar);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const largestDimension = Math.max(size.x, size.y, size.z, 0.001);
          const scale = 2.15 / largestDimension;
          avatar.scale.setScalar(scale);
          avatar.position.sub(center.multiplyScalar(scale));
          scene.add(avatar);
          resize();
          setRenderable(true);

          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
            || document.documentElement.dataset.reduceMotion === "true";
          const startedAt = performance.now();
          const draw = (now: number) => {
            if (disposed || !renderer || !scene || !camera) return;
            if (avatar && !reducedMotion) avatar.rotation.y = 0.32 + (now - startedAt) * 0.00022;
            renderer.render(scene, camera);
            if (!reducedMotion) frame = requestAnimationFrame(draw);
          };
          draw(startedAt);
          onReady(true);
        }, () => {
          if (!disposed) {
            setRenderable(false);
            onReady(false);
          }
        });
      } catch {
        if (!disposed) {
          setRenderable(false);
          onReady(false);
        }
      }
    };

    void mount();
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      release();
    };
  }, [buffer, onReady]);

  return (
    <div className={"ba-entry-avatar-stage" + (renderable ? " ba-entry-avatar-stage--live" : "")}>
      <canvas ref={canvasRef} className="ba-entry-avatar-canvas" aria-hidden="true" />
      {!renderable && <div className="ba-entry-avatar-fallback" aria-hidden="true"><span>MVM</span><i /></div>}
    </div>
  );
}
