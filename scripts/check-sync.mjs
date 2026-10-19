import { readFile, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CHECKS_FILE = path.join(ROOT, "docs", "checks.json");
const LANDING_FILE = path.join(ROOT, "index.html");

const problems = [];

async function committedChecks() {
  try {
    const { stdout } = await run("git", ["show", `HEAD:${path.relative(ROOT, CHECKS_FILE)}`], { cwd: ROOT });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

async function committedLanding() {
  try {
    const { stdout } = await run("git", ["show", `HEAD:${path.relative(ROOT, LANDING_FILE)}`], { cwd: ROOT });
    return stdout;
  } catch {
    return null;
  }
}

function comparable(checks) {
  if (!checks) return null;
  const copy = { ...checks };
  delete copy.generatedAt;
  return JSON.stringify(copy);
}

function landingValues(html) {
  const values = {};
  const pattern = /data-check="([^"]+)"\s+data-value="(-?\d+)"/g;
  let match = pattern.exec(html);
  while (match) {
    values[match[1]] = Number(match[2]);
    match = pattern.exec(html);
  }
  return values;
}

const before = await committedChecks();
const landingBefore = await committedLanding();

await rm(path.join(ROOT, "docs", "cards"), { recursive: true, force: true });
await run("node", [path.join(HERE, "card-shots.mjs")], { cwd: ROOT, maxBuffer: 1024 * 1024 * 64 });

const after = JSON.parse(await readFile(CHECKS_FILE, "utf8"));

if (comparable(before) !== comparable(after)) {
  problems.push(
    "검사 수치가 저장소 값과 다릅니다. npm run qa:cards 결과와 docs/checks.json 을 확인하세요.",
  );
}

const landing = await readFile(LANDING_FILE, "utf8");
if (landingBefore && landingBefore !== landing) {
  const beforeValues = landingValues(landingBefore);
  const afterValues = landingValues(landing);
  for (const [key, value] of Object.entries(afterValues)) {
    if (beforeValues[key] !== undefined && beforeValues[key] !== value) {
      problems.push(`랜딩 표시값 ${key} 가 ${beforeValues[key]} → ${value} 로 바뀌었습니다.`);
    }
  }
  if (Object.keys(problems).length === 0) {
    const added = landing.length - landingBefore.length;
    if (added !== 0) problems.push(`랜딩 파일이 ${added} 글자 변경됐습니다. 내용 변경 사유를 확인하세요.`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log(
  `동기화 확인 완료 — 게임 ${after.totals.games} · 테스트 ${after.totals.tests} · 화면 ${after.totals.views}장`,
);
