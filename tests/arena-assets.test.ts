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

  it("serves each asset from the public arena directory", () => {
    expect(getEnvironmentAssetUrl("Rift_Gate_Arch.glb")).toBe("/assets/arena/Rift_Gate_Arch.glb");
  });
});
