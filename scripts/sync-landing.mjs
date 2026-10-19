import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CHECKS_FILE = path.join(ROOT, "docs", "checks.json");
const LANDING_FILE = path.join(ROOT, "index.html");

const checks = JSON.parse(await readFile(CHECKS_FILE, "utf8"));
const landing = await readFile(LANDING_FILE, "utf8");

const UNITS = { tests: "개", viewDiffPercent: "%", consoleErrors: "건", invariantViolations: "건" };

function lookup(dotted) {
  return dotted.split(".").reduce((node, part) => (node === undefined || node === null ? undefined : node[part]), checks);
}

const pattern = /(<dd\s+data-check="([^"]+)"\s+data-value=")(-?\d+)(">)([^<]*)(<\/dd>)/g;

let updated = 0;
const problems = [];
const next = landing.replace(pattern, (match, head, key, oldValue, mid, oldText, tail) => {
  const actual = lookup(key);
  if (actual === undefined) {
    problems.push(`${key} 를 checks.json 에서 찾을 수 없습니다.`);
    return match;
  }
  const unit = key.split(".").pop();
  const text = `${actual}${UNITS[unit] ?? ""}`;
  if (oldValue !== String(actual) || oldText !== text) updated += 1;
  return `${head}${actual}${mid}${text}${tail}`;
});

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

await writeFile(LANDING_FILE, next);
console.log(`랜딩 수치 동기화: ${updated}곳 갱신 (게임 ${checks.totals.games} · 테스트 ${checks.totals.tests})`);
