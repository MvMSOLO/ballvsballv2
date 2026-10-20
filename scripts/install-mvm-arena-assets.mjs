#!/usr/bin/env node
import { readFile, mkdir, rename, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const archivePath = path.resolve(process.argv[2] ?? "MVM_18_3D_Asset_Pack.zip");
const catalogPath = path.join(repoRoot, "src/render/arena-assets.ts");
const outputDir = path.join(repoRoot, "public/assets/arena");
const stagingDir = path.join(outputDir, ".mvm-pack-staging");

function fail(message) {
  console.error(`[MVM asset installer] ${message}`);
  process.exitCode = 1;
}

function validateGlb(filename, bytes) {
  if (bytes.length < 20) throw new Error(`${filename}: file is too short to contain a GLB JSON chunk.`);
  const magic = bytes.readUInt32LE(0);
  const version = bytes.readUInt32LE(4);
  const declaredLength = bytes.readUInt32LE(8);
  const jsonChunkLength = bytes.readUInt32LE(12);
  const jsonChunkType = bytes.readUInt32LE(16);
  if (magic !== 0x46546c67) throw new Error(`${filename}: invalid GLB magic header.`);
  if (version !== 2) throw new Error(`${filename}: expected GLB version 2, got ${version}.`);
  if (declaredLength !== bytes.length) {
    throw new Error(`${filename}: header says ${declaredLength} bytes but file has ${bytes.length}.`);
  }
  if (jsonChunkType !== 0x4e4f534a || 20 + jsonChunkLength > bytes.length) {
    throw new Error(`${filename}: malformed GLB JSON chunk.`);
  }

  let document;
  try {
    document = JSON.parse(bytes.subarray(20, 20 + jsonChunkLength).toString("utf8").trimEnd());
  } catch {
    throw new Error(`${filename}: GLB JSON chunk is not valid JSON.`);
  }
  if (document.asset?.version !== "2.0") {
    throw new Error(`${filename}: glTF asset.version must be 2.0.`);
  }
  if (!Array.isArray(document.materials) || !document.materials.some((material) => material.pbrMetallicRoughness)) {
    throw new Error(`${filename}: no PBR metallic/roughness material was found.`);
  }
  if (!Array.isArray(document.images) || document.images.length === 0) {
    throw new Error(`${filename}: expected embedded image textures.`);
  }
  if (!Array.isArray(document.animations) || !document.animations.some((animation) => animation.name === "Idle_Showcase_Loop")) {
    throw new Error(`${filename}: expected the authored Idle_Showcase_Loop clip.`);
  }
  return document;
}

async function main() {
  let archiveBytes;
  try {
    archiveBytes = await readFile(archivePath);
  } catch {
    throw new Error(`Cannot read ZIP: ${archivePath}\nPass the path to MVM_18_3D_Asset_Pack.zip as the first argument.`);
  }

  const catalog = await readFile(catalogPath, "utf8");
  const expectedFiles = [...catalog.matchAll(/\bfile:\s*"([^"]+\.glb)"/g)].map((match) => match[1]);
  if (expectedFiles.length !== 18 || new Set(expectedFiles).size !== 18) {
    throw new Error(`The environment catalog must contain exactly 18 unique GLB files; found ${expectedFiles.length} entries.`);
  }

  const archive = await JSZip.loadAsync(archiveBytes);
  const validated = new Map();

  for (const filename of expectedFiles) {
    const suffix = `models/${filename}`;
    const candidates = Object.values(archive.files).filter(
      (entry) => !entry.dir && (entry.name === suffix || entry.name.endsWith(`/${suffix}`)),
    );
    if (candidates.length !== 1) {
      throw new Error(`${filename}: expected exactly one ZIP entry ending in "${suffix}", found ${candidates.length}.`);
    }
    const bytes = await candidates[0].async("nodebuffer");
    validateGlb(filename, bytes);
    validated.set(filename, bytes);
  }

  // Validate the full pack before touching the public assets directory.
  await mkdir(outputDir, { recursive: true });
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  try {
    for (const [filename, bytes] of validated) {
      await writeFile(path.join(stagingDir, filename), bytes);
    }
    for (const filename of expectedFiles) {
      await rename(path.join(stagingDir, filename), path.join(outputDir, filename));
    }
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }

  const totalMiB = [...validated.values()].reduce((sum, bytes) => sum + bytes.length, 0) / (1024 * 1024);
  console.log(`[MVM asset installer] Installed ${validated.size}/18 validated GLB files into public/assets/arena/ (${totalMiB.toFixed(2)} MiB).`);
  console.log("[MVM asset installer] Only the matching GLBs were copied; source archives and standalone texture images were not added.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
