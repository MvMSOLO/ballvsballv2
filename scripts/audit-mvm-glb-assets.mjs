#!/usr/bin/env node
import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(root, "public/assets/arena");
const registryPath = path.join(root, "src/render/arena-assets.ts");
const outputPath = path.join(root, "docs/3d/asset-inventory.md");

function inspectGlb(buffer, filename) {
  if (buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "glTF") throw new Error(filename + ": invalid GLB header.");
  const jsonLength = buffer.readUInt32LE(12);
  if (buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length || buffer.readUInt32LE(16) !== 0x4e4f534a) {
    throw new Error(filename + ": invalid GLB v2 structure.");
  }
  const json = JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).trimEnd());
  let bin = Buffer.alloc(0);
  let offset = 20 + jsonLength;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (offset + length > buffer.length) throw new Error(filename + ": invalid chunk length.");
    if (type === 0x004e4942) bin = buffer.subarray(offset, offset + length);
    offset += length;
  }
  const views = json.bufferViews ?? [];
  const accessors = json.accessors ?? [];
  const positions = [];
  let primitives = 0;
  let uv0 = 0;
  for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives ?? []) {
    primitives++;
    if (primitive.attributes?.TEXCOORD_0 !== undefined) uv0++;
    const index = primitive.attributes?.POSITION;
    if (Number.isInteger(index) && accessors[index]) positions.push(accessors[index]);
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const accessor of positions) if (Array.isArray(accessor.min) && Array.isArray(accessor.max)) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], accessor.min[axis]);
      max[axis] = Math.max(max[axis], accessor.max[axis]);
    }
  }
  const bounds = min.every(Number.isFinite) && max.every(Number.isFinite)
    ? { min, max, dimensions: min.map((value, axis) => max[axis] - value) } : null;
  const images = (json.images ?? []).map((image, index) => {
    let size = 0, width = null, height = null, source = "unknown", name = image.name ?? image.uri ?? ("image-" + (index + 1));
    if (image.bufferView !== undefined && views[image.bufferView]) {
      const view = views[image.bufferView];
      const data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
      size = view.byteLength;
      source = "embedded";
      if (data.length >= 24 && data.toString("ascii", 1, 4) === "PNG") { width = data.readUInt32BE(16); height = data.readUInt32BE(20); }
    } else if (typeof image.uri === "string") {
      source = image.uri.startsWith("data:") ? "data-uri" : "external";
      const match = image.uri.match(/^data:[^,]*;base64,(.+)$/);
      if (match) size = Buffer.from(match[1], "base64").length;
      if (image.uri.startsWith("data:image/png;base64,")) {
        const data = Buffer.from(image.uri.split(",")[1], "base64");
        if (data.length >= 24 && data.toString("ascii", 1, 4) === "PNG") { width = data.readUInt32BE(16); height = data.readUInt32BE(20); }
      }
    }
    return { name, size, width, height, source };
  });
  const materials = (json.materials ?? []).map((material) => ({
    name: material.name ?? "(unnamed)",
    baseColor: material.pbrMetallicRoughness?.baseColorTexture?.index ?? null,
    metalRough: material.pbrMetallicRoughness?.metallicRoughnessTexture?.index ?? null,
    normal: material.normalTexture?.index ?? null,
    occlusion: material.occlusionTexture?.index ?? null,
    emissive: material.emissiveTexture?.index ?? null,
    roughness: material.pbrMetallicRoughness?.roughnessFactor ?? 1,
    metalness: material.pbrMetallicRoughness?.metallicFactor ?? 1,
    alpha: material.alphaMode ?? "OPAQUE",
  }));
  return {
    bytes: buffer.length, nodes: (json.nodes ?? []).length, meshes: (json.meshes ?? []).length,
    primitives, uv0, accessors: accessors.length, materials, textures: (json.textures ?? []).length,
    images, bounds, decodedPngBytes: images.reduce((sum, image) => sum + (image.width && image.height ? image.width * image.height * 4 : 0), 0),
    animations: (json.animations ?? []).map((animation) => animation.name ?? "(unnamed)"),
    roots: (json.scenes?.[json.scene ?? 0]?.nodes ?? []).map((index) => {
      const node = json.nodes?.[index];
      return node ? { name: node.name ?? ("node-" + index), t: node.translation ?? [0,0,0], r: node.rotation ?? [0,0,0,1], s: node.scale ?? [1,1,1] } : { name: "node-" + index };
    }),
  };
}

function parseRegistry(source) {
  const entries = [];
  for (const match of source.matchAll(/\{\n    id: "([^"]+)",([\s\S]*?)\n  \},/g)) {
    const block = match[2];
    const field = (key) => block.match(new RegExp("\\b" + key + ": \"([^\"]+)\""))?.[1] ?? "not documented";
    entries.push({
      id: match[1], file: field("file"), name: field("displayName"), zone: field("zone"),
      feature: field("feature"), purpose: field("purpose"),
      extent: Number(block.match(/\btargetExtent: ([\d.]+)/)?.[1]),
      position: block.match(/\bposition: \[([^\]]+)\]/)?.[1] ?? "unknown",
    });
  }
  return entries;
}

const mib = (bytes) => (bytes / 1048576).toFixed(2) + " MiB";
async function main() {
  const registry = parseRegistry(await readFile(registryPath, "utf8"));
  if (registry.length !== 18 || new Set(registry.map((item) => item.file)).size !== 18) {
    throw new Error("Expected 18 unique GLB registry entries; found " + registry.length + ".");
  }
  const filenames = new Set(await readdir(assetsDir));
  const rows = [];
  for (const item of registry) {
    if (!filenames.has(item.file)) throw new Error("Missing registered GLB: " + item.file);
    const filePath = path.join(assetsDir, item.file);
    const [buffer, info] = await Promise.all([readFile(filePath), stat(filePath)]);
    const data = inspectGlb(buffer, item.file);
    const missing = data.images.filter((image) => image.source === "external" && !filenames.has(path.basename(image.name)));
    if (missing.length) throw new Error(item.file + " references missing external images: " + missing.map((image) => image.name).join(", "));
    rows.push({ ...item, fileBytes: info.size, ...data });
  }
  const lines = [
    "# MVM 18-asset GLB inventory",
    "",
    "Generated from checked-out GLB bytes and the runtime registry. Registered assets: " + rows.length + "/18; total GLB size: " + mib(rows.reduce((sum, row) => sum + row.fileBytes, 0)) + ".",
    "",
    "> POSITION accessor bounds are source mesh-space bounds and do not include every node transform. The renderer separately measures transformed THREE.Box3 bounds and normalizes each model to its configured target extent. Decoded-memory estimates cover only images with readable PNG dimensions; GPU mipmaps and non-PNG textures are not included.",
    "",
  ];
  for (const row of rows) {
    const bounds = row.bounds ? "min [" + row.bounds.min.map((v) => v.toFixed(4)).join(", ") + "], max [" + row.bounds.max.map((v) => v.toFixed(4)).join(", ") + "], dimensions [" + row.bounds.dimensions.map((v) => v.toFixed(4)).join(", ") + "]" : "POSITION bounds absent";
    const images = row.images.length ? row.images.map((im) => im.name + " (" + im.source + ", " + (im.size ? mib(im.size) : "size unknown") + (im.width && im.height ? ", " + im.width + "x" + im.height : "") + ")").join("; ") : "none";
    const mats = row.materials.length ? row.materials.map((m) => m.name + " [baseColor=" + m.baseColor + ", metalRough=" + m.metalRough + ", normal=" + m.normal + ", AO=" + m.occlusion + ", emissive=" + m.emissive + ", roughness=" + m.roughness + ", metalness=" + m.metalness + ", alpha=" + m.alpha + "]").join("; ") : "none";
    lines.push(
      "## " + row.name + " (" + row.file + ")",
      "",
      "- Registry ID / zone: " + row.id + " / " + row.zone + ".",
      "- Purpose: " + row.feature + ". " + row.purpose,
      "- Runtime path: /assets/arena/" + row.file + "; target extent " + row.extent + "; position [" + row.position + "].",
      "- Size: " + mib(row.fileBytes) + "; nodes " + row.nodes + "; meshes " + row.meshes + "; primitives " + row.primitives + "; accessors " + row.accessors + "; materials " + row.materials.length + "; textures " + row.textures + "; UV0 primitives " + row.uv0 + "/" + row.primitives + ".",
      "- Accessor-space bounds: " + bounds + ".",
      "- Animation clips: " + (row.animations.length ? row.animations.join(", ") : "none embedded") + ".",
      "- Images: " + images + ".",
      "- Estimated decoded PNG memory: " + (row.decodedPngBytes ? mib(row.decodedPngBytes) : "unknown from image headers") + ".",
      "- Root transforms: " + (row.roots.map((node) => node.name + " t=[" + node.t.join(",") + "] r=[" + node.r.join(",") + "] s=[" + node.s.join(",") + "]").join("; ") || "none listed") + ".",
      "- Source PBR slots: " + mats + ".",
      "- Runtime PBR treatment: per-asset tint, roughness, metalness, environment reflection and optional emissive factors from src/render/arena-assets.ts; source texture maps are retained.",
      "",
    );
  }
  await writeFile(outputPath, lines.join("\n") + "\n");
  console.log("Audited " + rows.length + "/18 GLBs; wrote docs/3d/asset-inventory.md; total " + mib(rows.reduce((sum, row) => sum + row.fileBytes, 0)) + ".");
}
main().catch((error) => { console.error("[MVM GLB audit]", error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
