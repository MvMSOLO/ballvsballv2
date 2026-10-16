import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routes = path.join(root, "src", "routes");
const parts = [];
for (let i = 0; i < 20; i++) {
  const f = path.join(routes, `_index.part${i}.txt`);
  if (!fs.existsSync(f)) break;
  parts.push(fs.readFileSync(f, "utf8"));
}
if (!parts.length) {
  console.log("assemble-index: no parts found, skip");
  process.exit(0);
}
const out = path.join(routes, "index.tsx");
fs.writeFileSync(out, parts.join(""));
console.log(`assemble-index: wrote ${out} from ${parts.length} parts (${parts.join("").length} bytes)`);
