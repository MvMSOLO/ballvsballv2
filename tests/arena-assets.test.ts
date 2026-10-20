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

  it("keeps tiered loading bounded for lower-end devices", () => {
    expect(getEnvironmentAssetsForQuality("low")).toHaveLength(4);
    expect(getEnvironmentAssetsForQuality("medium")).toHaveLength(10);
    expect(getEnvironmentAssetsForQuality("high")).toHaveLength(18);
  });

  it("places both lobby landmarks and arena scenery in the scene plan", () => {
    expect(MVM_ENVIRONMENT_ASSETS.some((asset) => asset.zone === "lobby")).toBe(true);
    expect(MVM_ENVIRONMENT_ASSETS.some((asset) => asset.zone === "arena")).toBe(true);
    expect(MVM_ENVIRONMENT_ASSETS.every((asset) => asset.targetExtent > 0)).toBe(true);
  });

  it("serves each asset from the public arena directory", () => {
    expect(getEnvironmentAssetUrl("Rift_Gate_Arch.glb")).toBe("/assets/arena/Rift_Gate_Arch.glb");
  });
});
