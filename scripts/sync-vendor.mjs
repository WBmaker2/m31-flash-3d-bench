import { mkdir, copyFile, readFile, writeFile, rm, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const THREE_DIR = path.join(ROOT, "node_modules", "three");
const VENDOR = path.join(ROOT, "vendor");

const ADDON_ENTRIES = ["controls/OrbitControls.js"];
const BUILD_ENTRY = "three.module.js";

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function copyTree(sourceRoot, targetRoot, relative, seen) {
  const key = `${sourceRoot}:${relative}`;
  if (seen.has(key)) return;
  seen.add(key);

  const source = path.join(sourceRoot, relative);
  const target = path.join(targetRoot, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);

  const code = await readFile(source, "utf8");
  const pattern = /from\s+["'](\.[^"']+)["']/g;
  let match = pattern.exec(code);
  while (match) {
    const dependency = path.posix.join(path.posix.dirname(relative), match[1]);
    await copyTree(sourceRoot, targetRoot, dependency, seen);
    match = pattern.exec(code);
  }
}

if (!(await exists(THREE_DIR))) {
  console.error("node_modules/three 가 없습니다. 먼저 npm install 을 실행하세요.");
  process.exit(1);
}

await rm(VENDOR, { recursive: true, force: true });
await mkdir(path.join(VENDOR, "addons"), { recursive: true });

const seen = new Set();
await copyTree(path.join(THREE_DIR, "build"), VENDOR, BUILD_ENTRY, seen);
for (const entry of ADDON_ENTRIES) {
  await copyTree(path.join(THREE_DIR, "examples", "jsm"), path.join(VENDOR, "addons"), entry, seen);
}

const files = [];
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) await walk(full);
    else files.push(path.relative(VENDOR, full));
  }
}
await walk(VENDOR);

const manifest = {
  version: JSON.parse(await readFile(path.join(THREE_DIR, "package.json"), "utf8")).version,
  files: files.sort(),
};
await writeFile(path.join(VENDOR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`vendor 갱신 완료 — three ${manifest.version}, 파일 ${files.length}개`);
for (const file of manifest.files) console.log(`  ${file}`);
