import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const BASELINE_DIR = path.join(ROOT, "docs", "baseline");
const GAMES = ["zoo", "molecule", "defense", "shapes", "ballistics", "robot", "maze", "flock", "sculpt", "gears", "paint", "dice", "balance", "cloud", "laser", "net"];
const VIEWPORT = { width: 1280, height: 800 };
const MAX_DIFF_RATIO = Number(process.env.VISUAL_MAX_DIFF ?? 0.05);
const MAX_POSITION_DRIFT = Number(process.env.VISUAL_MAX_DRIFT ?? 0.01);
const UPDATE = process.argv.includes("--update");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".woff2": "font/woff2",
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

function compare(baselineBuffer, currentBuffer) {
  const a = PNG.sync.read(baselineBuffer);
  const b = PNG.sync.read(currentBuffer);
  if (a.width !== b.width || a.height !== b.height) {
    return { ratio: 1, note: `크기 불일치 ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.12 });
  return { ratio: changed / (a.width * a.height), diff };
}

await mkdir(BASELINE_DIR, { recursive: true });
const { server, port } = await serve(ROOT);
const browser = await chromium.launch({ headless: true });
const problems = [];
const results = [];

for (const game of GAMES) {
  const context = await browser.newContext({ viewport: VIEWPORT, locale: "ko-KR", deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`http://127.0.0.1:${port}/${game}/?still=1`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 20000 });
  await page.waitForTimeout(600);

  const current = await page.screenshot();
  const positions = await page.evaluate(() => window.__gameApi?.getScreenPositions?.() ?? []);
  const baselinePath = path.join(BASELINE_DIR, `${game}.png`);
  const baselineJsonPath = path.join(BASELINE_DIR, `${game}.json`);

  if (errors.length > 0) {
    problems.push(`${game}: 콘솔 오류 ${errors.length}건 — ${errors[0]}`);
  }

  if (UPDATE || !existsSync(baselinePath) || !existsSync(baselineJsonPath)) {
    await writeFile(baselinePath, current);
    await writeFile(
      baselineJsonPath,
      `${JSON.stringify({ objects: positions.map((entry) => ({ id: entry.id, x: entry.x, y: entry.y })) }, null, 2)}\n`,
    );
    results.push(`${game}: 기준 새로 저장`);
  } else {
    const baselineJson = JSON.parse(await readFile(baselineJsonPath, "utf8"));
    const before = new Map(baselineJson.objects.map((entry) => [entry.id, entry]));
    let drift = 0;
    for (const entry of positions) {
      const reference = before.get(entry.id);
      if (!reference) continue;
      drift = Math.max(drift, Math.hypot(entry.x - reference.x, entry.y - reference.y));
    }
    if (positions.length !== before.size) {
      problems.push(`${game}: 화면 위 개체 수가 달라졌습니다 (${before.size} → ${positions.length})`);
    }
    if (drift > MAX_POSITION_DRIFT) {
      problems.push(
        `${game}: 개체 위치가 ${drift.toFixed(4)} 만큼 어긋났습니다 (허용 ${MAX_POSITION_DRIFT}). 카메라·배치 변경 여부를 확인하세요.`,
      );
    }
    results.push(`${game}: 위치 차이 ${drift.toFixed(4)}`);
    const baseline = await readFile(baselinePath);
    const { ratio, note } = compare(baseline, current);
    const percent = (ratio * 100).toFixed(3);
    results.push(`${game}: 차이 ${percent}%`);
    if (ratio > MAX_DIFF_RATIO) {
      problems.push(
        `${game}: 기준 화면과 ${percent}% 차이가 납니다 (허용 ${(MAX_DIFF_RATIO * 100).toFixed(1)}%). ${note ?? ""}`.trim(),
      );
    }
  }

  await context.close();
}

await browser.close();
server.close();

console.log(results.join("\n"));

if (problems.length > 0) {
  console.error(`\n화면 회귀 실패 ${problems.length}건`);
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log(`\n화면 회귀 통과 (허용 ${(MAX_DIFF_RATIO * 100).toFixed(1)}%)`);
