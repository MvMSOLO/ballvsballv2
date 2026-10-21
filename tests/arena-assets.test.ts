import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getEnvironmentAssetUrl,
  getEnvironmentAssetsForQuality,
  MVM_ENVIRONMENT_ASSETS,
} from "../src/render/arena-assets";

describe("MVM environment asset registry", () => {
  it("contains exactly the 18 supplied models without duplicate paths", () => {
    expect(MVM_ENVIRONMENT_ASSETS).toHaveLength(18);
    expect(new Set(MVM_ENVIRONMENT_ASSETS.map((asset) => asset.file)).size).toBe(18);
    expect(new Set(MVM_ENVIRONMENT_ASSETS.map((asset) => asset.id)).size).toBe(18);
    expect(MVM_ENVIRONMENT_ASSETS.every((asset) => asset.file.endsWith(".glb"))).toBe(true);
    expect(MVM_ENVIRONMENT_ASSETS.every((asset) =>
      /^#[0-9a-f]{6}$/i.test(asset.material.tint)
      && /^#[0-9a-f]{6}$/i.test(asset.material.emissive)
      && asset.material.roughness >= 0 && asset.material.roughness <= 1
      && asset.material.metalness >= 0 && asset.material.metalness <= 1
      && asset.material.emissiveIntensity >= 0 && asset.material.envMapIntensity >= 0
    )).toBe(true);
    expect(new Set(MVM_ENVIRONMENT_ASSETS.map((asset) => asset.material.tint)).size).toBe(18);
  });

  it("keeps tiered loading bounded while retaining the authored expansion entry and centerpiece", () => {
    // Low includes both worlds' minimum landmarks, but not all of the expensive perimeter kit.
    expect(getEnvironmentAssetsForQuality("low")).toHaveLength(6);
    expect(getEnvironmentAssetsForQuality("low").some((asset) => asset.id === "Spawn_Beacon_Platform")).toBe(true);
    expect(getEnvironmentAssetsForQuality("low").some((asset) => asset.id === "Eclipse_Ring_Arena")).toBe(true);
    expect(getEnvironmentAssetsForQuality("medium")).toHaveLength(12);
    expect(getEnvironmentAssetsForQuality("high")).toHaveLength(18);
  });

  it("assigns all models to intentional world zones with a gameplay purpose", () => {
    const lobby = MVM_ENVIRONMENT_ASSETS.filter((asset) => asset.zone === "lobby");
    const arena = MVM_ENVIRONMENT_ASSETS.filter((asset) => asset.zone === "arena");
    const rift = MVM_ENVIRONMENT_ASSETS.filter((asset) => asset.zone === "rift");

    expect(lobby).toHaveLength(6);
    expect(arena).toHaveLength(0);
    expect(rift).toHaveLength(12);
    expect(MVM_ENVIRONMENT_ASSETS.every((asset) => asset.targetExtent >= 3)).toBe(true);
    expect(MVM_ENVIRONMENT_ASSETS.every((asset) => asset.purpose.trim().length > 35)).toBe(true);
    expect(MVM_ENVIRONMENT_ASSETS.every((asset) => asset.feature.trim().length > 3)).toBe(true);
    expect(new Set(MVM_ENVIRONMENT_ASSETS.map((asset) => asset.purpose)).size).toBe(18);
    expect(MVM_ENVIRONMENT_ASSETS.filter((asset) => asset.zone === "rift").every((asset) => asset.feature.startsWith("Rift Expanse"))).toBe(true);
  });

  it("uses the world scale and authored motion only for explicitly designated assets", () => {
    expect(MVM_ENVIRONMENT_ASSETS.find((asset) => asset.id === "Eclipse_Ring_Arena")?.targetExtent).toBeGreaterThanOrEqual(17);
    expect(MVM_ENVIRONMENT_ASSETS.find((asset) => asset.id === "Rift_Rail_Bridge")?.targetExtent).toBeGreaterThanOrEqual(10);
    expect(MVM_ENVIRONMENT_ASSETS.find((asset) => asset.id === "Voidstone_Meteor")?.motion).toBe("spin");
    expect(MVM_ENVIRONMENT_ASSETS.find((asset) => asset.id === "Rift_Gate_Arch")?.motion).toBe("static");
  });

  it("has all 18 real GLB files installed and structurally valid", async () => {
    const results = await Promise.all(MVM_ENVIRONMENT_ASSETS.map(async (asset) => {
      const path = resolve(process.cwd(), "public/assets/arena", asset.file);
      const [fileStat, bytes] = await Promise.all([stat(path), readFile(path)]);
      expect(fileStat.size, asset.file).toBeGreaterThan(20);
      expect(bytes.toString("ascii", 0, 4), asset.file).toBe("glTF");
      expect(bytes.readUInt32LE(4), asset.file).toBe(2);
      expect(bytes.readUInt32LE(8), asset.file).toBe(bytes.length);
      expect(bytes.readUInt32LE(16), asset.file).toBe(0x4e4f534a);

      const jsonChunkLength = bytes.readUInt32LE(12);
      const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonChunkLength)) as {
        asset?: { version?: string };
        scenes?: Array<{ nodes?: number[] }>;
        nodes?: unknown[];
        meshes?: Array<unknown>;
        accessors?: Array<unknown>;
        materials?: Array<unknown>;
      };
      expect(gltf.asset?.version, asset.file).toBe("2.0");
      expect(gltf.nodes?.length ?? 0, asset.file).toBeGreaterThan(0);
      expect(gltf.meshes?.length ?? 0, asset.file).toBeGreaterThan(0);
      expect(gltf.accessors?.length ?? 0, asset.file).toBeGreaterThan(0);
      return { file: asset.file, bytes: bytes.length, nodes: gltf.nodes?.length ?? 0, meshes: gltf.meshes?.length ?? 0 };
    }));
    expect(new Set(results.map((result) => result.file)).size).toBe(18);
  });

  it("uses unique finite placement coordinates so authored props are not accidentally stacked", () => {
    const positionKeys = MVM_ENVIRONMENT_ASSETS.map((asset) => asset.position.join(","));
    expect(new Set(positionKeys).size).toBe(18);
    expect(MVM_ENVIRONMENT_ASSETS.every((asset) => asset.position.length === 3 && asset.position.every(Number.isFinite))).toBe(true);
    expect(MVM_ENVIRONMENT_ASSETS.every((asset) => Number.isFinite(asset.rotationY))).toBe(true);
  });

  it("assigns a distinct authored PBR treatment to every GLB", () => {
    expect(new Set(MVM_ENVIRONMENT_ASSETS.map((asset) =>
      [asset.material.tint, asset.material.roughness, asset.material.metalness, asset.material.emissive].join(":"),
    )).size).toBe(18);
    expect(MVM_ENVIRONMENT_ASSETS.find((asset) => asset.id === "MVM_Boppo_Mascot")?.material.metalness).toBeLessThan(0.1);
    expect(MVM_ENVIRONMENT_ASSETS.find((asset) => asset.id === "Voidstone_Meteor")?.material.roughness).toBeGreaterThan(0.8);
    expect(MVM_ENVIRONMENT_ASSETS.find((asset) => asset.id === "Magma_Reactor_Tower")?.material.emissive).toBe("#a83213");
  });

  it("serves each asset from the public arena directory", () => {
    expect(getEnvironmentAssetUrl("Rift_Gate_Arch.glb")).toBe("/assets/arena/Rift_Gate_Arch.glb");
  });
});
