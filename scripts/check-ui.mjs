import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GAMES, GAME_IDS } from "./games.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const TOUCH_GAMES = new Set(["cloud", "maze", "flock"]);
const problems = [];

async function read(relative) {
  try {
    return await readFile(path.join(ROOT, relative), "utf8");
  } catch {
    problems.push(`${relative} 파일을 읽을 수 없습니다.`);
    return "";
  }
}

const landing = await read("index.html");
const readme = await read("README.md");
const pkg = JSON.parse(await read("package.json") || "{}");
const checks = JSON.parse(await read("docs/checks.json") || "{}");
const styles = await read("common/styles.css");
const steps = await read("scripts/steps.mjs");

if (!styles.includes('@import url("../vendor/fonts/fonts.css")')) {
  problems.push("common/styles.css 가 vendor/fonts/fonts.css 를 불러오지 않습니다.");
}

const landingGames = [...landing.matchAll(/<article class="card" data-frames data-game="([^"]+)"/g)].map(
  (match) => match[1],
);
if (landingGames.length !== GAMES.length) {
  problems.push(`랜딩 카드가 ${landingGames.length}개입니다. ${GAMES.length}개를 기대했습니다.`);
}
for (const game of GAMES) {
  if (!landingGames.includes(game.id)) problems.push(`랜딩에 ${game.id} 카드가 없습니다.`);
}

const playHrefs = [...landing.matchAll(/class="play"[^>]*data-href="([^"]+)"/g)].map((match) => match[1]);
for (const game of GAMES) {
  if (!playHrefs.includes(`${game.id}/index.html`)) {
    problems.push(`랜딩 PLAY 버튼에 ${game.id}/index.html 이 없습니다.`);
  }
}

if (landing.includes("minimax-m31-test")) problems.push("index.html 에 옛 경로 minimax-m31-test 가 남아 있습니다.");
if (landing.includes("여덟 개의")) problems.push("index.html 에 옛 게임 수 표현 '여덟 개의'가 남아 있습니다.");
if (readme.includes("9개 게임")) problems.push("README.md 에 옛 게임 수 표현 '9개 게임'이 남아 있습니다.");
if (readme.includes("공유 런타임 의존성은 없습니다")) problems.push("README.md 에 현재 구조와 다른 '공유 런타임 없음' 문구가 남아 있습니다.");
if (!landing.includes('id="progress-grid"')) problems.push("index.html 에 진행 대시보드(progress-grid)가 없습니다.");
if (!String(pkg.description ?? "").includes("18종")) problems.push("package.json description 이 18종 기준이 아닙니다.");

if (checks?.totals?.games !== GAMES.length) {
  problems.push(`docs/checks.json totals.games=${checks?.totals?.games} 이 게임 수 ${GAMES.length} 와 다릅니다.`);
}
if (!landing.includes(`data-check="totals.games" data-value="${GAMES.length}"`)) {
  problems.push(`랜딩의 totals.games 표시값이 ${GAMES.length} 가 아닙니다.`);
}

for (const game of GAMES) {
  const html = await read(`${game.id}/index.html`);
  const main = await read(`${game.id}/src/main.js`);
  if (!html) continue;

  if (!html.includes('lang="ko"')) problems.push(`${game.id}: html lang="ko" 가 없습니다.`);
  if (!html.includes('name="viewport"')) problems.push(`${game.id}: viewport meta 가 없습니다.`);
  if (!html.includes("<title>")) problems.push(`${game.id}: title 이 없습니다.`);
  if (!html.includes("<h1")) problems.push(`${game.id}: h1 이 없습니다.`);
  if (!html.includes('role="img"')) problems.push(`${game.id}: canvas role="img" 가 없습니다.`);
  if (!html.includes('href="../common/styles.css"')) {
    problems.push(`${game.id}: common/styles.css 를 불러오지 않습니다.`);
  }
  if (!/<a class="back-link" href="\.\.\/index\.html" target="_top">/.test(html)) {
    problems.push(`${game.id}: back-link 에 target="_top" 이 없습니다.`);
  }
  if (TOUCH_GAMES.has(game.id) && !html.includes('id="touch-pad"')) {
    problems.push(`${game.id}: 터치 조작 영역 id="touch-pad" 가 없습니다.`);
  }
  if (main.includes("common/overlay.js") && !html.includes('href="../common/styles.css"')) {
    problems.push(`${game.id}: 공용 오버레이를 쓰지만 공용 스타일이 없습니다.`);
  }
  if (!new RegExp(`^  ${game.id}: async`, "m").test(steps)) {
    problems.push(`scripts/steps.mjs 에 ${game.id} STEPS 가 없습니다.`);
  }
}

for (const [relative, text] of [
  ["index.html", landing],
  ["README.md", readme],
  ["package.json", JSON.stringify(pkg)],
  ["scripts/steps.mjs", steps],
]) {
  if (text.includes("\uFFFD")) problems.push(`${relative} 에 깨진 문자(U+FFFD)가 있습니다.`);
}

if (problems.length > 0) {
  console.error(`UI 계약 검사 실패 ${problems.length}건`);
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log(`UI 계약 검사 통과 — 게임 ${GAMES.length}종 · 터치 조작 ${[...TOUCH_GAMES].join(", ")}`);
