import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { CARD_SETUP } from "./steps.mjs";

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CARD_DIR = path.join(ROOT, "docs", "cards");
const CHECKS_FILE = path.join(ROOT, "docs", "checks.json");

const GAMES = ["zoo", "molecule", "defense", "shapes", "ballistics", "robot", "maze", "flock", "sculpt", "gears", "paint", "dice", "balance", "cloud", "laser", "net", "rail"];
const ANGLES = ["card", "side", "top"];
const VIEWPORT = { width: 1200, height: 750 };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

function serve(dir) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel = `${rel}index.html`;
    const target = path.join(dir, path.normalize(rel));
    if (!target.startsWith(dir)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    try {
      const body = await readFile(target);
      res.writeHead(200, { "content-type": MIME[path.extname(target)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function diffPercent(first, second) {
  const a = PNG.sync.read(await readFile(first));
  const b = PNG.sync.read(await readFile(second));
  if (a.width !== b.width || a.height !== b.height) return 0;
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  return Math.round((changed / (a.width * a.height)) * 100);
}

async function runVitest(game, filter) {
  const output = path.join(ROOT, "node_modules", ".cache", `card-tests-${game}.json`);
  await mkdir(path.dirname(output), { recursive: true });
  await run("npx", ["vitest", "run", filter, "--reporter=json", `--outputFile=${output}`], {
    cwd: ROOT,
    maxBuffer: 1024 * 1024 * 32,
  });
  const report = JSON.parse(await readFile(output, "utf8"));
  return report.numTotalTests ?? 0;
}

async function testCount(game, previous) {
  // 폴더 경로로 좁힌다. 공용 부품(common/parts) 테스트가 게임 수에 중복 집계되지 않게.
  const scoped = game === "common" ? "common" : `${game}/src`;
  for (const filter of [scoped, `minimax-m31-test/${game}`]) {
    try {
      const count = await runVitest(game, filter);
      if (count > 0) return count;
    } catch {
      break;
    }
  }
  return previous ?? null;
}

await mkdir(CARD_DIR, { recursive: true });

let previousChecks = { games: {} };
if (existsSync(CHECKS_FILE)) {
  previousChecks = JSON.parse(await readFile(CHECKS_FILE, "utf8"));
}

const browser = await chromium.launch({ headless: true });
const results = {};

for (const game of GAMES) {
  if (!existsSync(path.join(ROOT, game))) {
    console.error(`알 수 없는 게임: ${game}`);
    process.exit(2);
  }
  const { server, port } = await serve(ROOT);
  const context = await browser.newContext({ viewport: VIEWPORT, locale: "ko-KR" });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(e.message));

  await page.goto(`http://127.0.0.1:${port}/${game}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 20000 });
  await page.waitForTimeout(900);

  if (CARD_SETUP[game]) await CARD_SETUP[game](page);
  await page.waitForTimeout(400);

  await page.evaluate(() => window.__gameApi?.setChrome?.({ labels: false }));
  await page.addStyleTag({
    content: "body > *:not(canvas) { display: none !important; }",
  });
  await page.waitForTimeout(200);

  const files = [];
  for (const angle of ANGLES) {
    await page.evaluate((name) => window.__gameApi.setView(name), angle);
    await page.waitForTimeout(800);
    const file = path.join(CARD_DIR, `${game}-${angle}.png`);
    await page.locator("canvas").first().screenshot({ path: file });
    files.push({ angle, file });
    console.log(`CARD ${file}`);
  }

  const invariants = await page.evaluate(() => window.__gameApi?.getInvariants?.() ?? []);
  const base = files[0].file;
  const diffs = [];
  for (const entry of files.slice(1)) {
    diffs.push(await diffPercent(base, entry.file));
  }

  results[game] = {
    tests: await testCount(game, previousChecks.games?.[game]?.tests),
    consoleErrors: consoleErrors.length,
    invariantViolations: invariants.length,
    viewDiffPercent: Math.max(...diffs),
  };
  if (consoleErrors.length) console.error(`  콘솔 오류: ${consoleErrors.join(" | ")}`);

  await context.close();
  server.close();
}

await browser.close();

const commonTests = await testCount("common", previousChecks.totals?.commonTests ?? 0);

const totals = {
  games: GAMES.length,
  tests: GAMES.reduce((sum, game) => sum + results[game].tests, 0) + commonTests,
  gameTests: GAMES.reduce((sum, game) => sum + results[game].tests, 0),
  commonTests,
  views: GAMES.length * ANGLES.length,
  consoleErrors: GAMES.reduce((sum, game) => sum + results[game].consoleErrors, 0),
  invariantViolations: GAMES.reduce((sum, game) => sum + results[game].invariantViolations, 0),
};

const checks = {
  generatedAt: new Date().toISOString(),
  games: results,
  totals,
};
await writeFile(CHECKS_FILE, `${JSON.stringify(checks, null, 2)}\n`);
console.log(`\nCHECKS ${CHECKS_FILE}`);
await run("node", [path.join(HERE, "sync-landing.mjs")], { cwd: ROOT });
console.log(JSON.stringify(checks, null, 2));
