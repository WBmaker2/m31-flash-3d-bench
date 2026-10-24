import * as THREE from "three";
import { createStage, createPicker } from "./stage.js";
import { COLS, ROWS, PATH_POINTS, cellToWorld, createBoard, inBounds, isPathCell, worldToCell } from "./grid.js";
import { TOWER_ORDER, TOWER_TYPES, createTower, updateTower } from "./towers.js";
import { ENEMY_TYPES, createEnemy, disposeEnemy, updateEnemy, updateHealthBar } from "./enemies.js";
import { DIFFICULTIES, buildSpawnQueue, scoreFor, starsFor, wavesFor } from "./waves.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";
import { showEndingScreen } from "../../common/ending.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge, createViewController } from "../../common/ui-kit.js";

const difficultyProgress = createProgress("defense", { levels: DIFFICULTIES.map((entry) => ({ id: entry.id })) });
let difficulty = DIFFICULTIES[1];
let kills = 0;
let wavesCleared = 0;
const BOARD_Y = 0.06;

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const pick = createPicker(canvas, stage.camera);
createBoard(stage.scene);

const towers = [];
const enemies = [];
const projectiles = [];

let gold = difficulty.gold;
let lives = difficulty.lives;
let waveIndex = 0;
let waveActive = false;
let waveTimer = 0;
let spawnQueue = [];
let placing = null;
let selectedTower = null;
let speed = 1;
let finished = false;

const statGold = document.getElementById("stat-gold");
const statLives = document.getElementById("stat-lives");
const statWave = document.getElementById("stat-wave");
const statDifficulty = document.getElementById("stat-difficulty");
const statEnemies = document.getElementById("stat-enemies");
const towerRow = document.getElementById("tower-row");
const btnWave = document.getElementById("btn-wave");
const btnSpeed = document.getElementById("btn-speed");
const infoPanel = document.getElementById("info");
const infoText = document.getElementById("info-text");
const btnSell = document.getElementById("btn-sell");
const toastElement = document.getElementById("toast");

let toastTimer = null;
function toast(message, isBad = false) {
  toastElement.textContent = message;
  toastElement.classList.toggle("bad", isBad);
  toastElement.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove("show"), 2200);
}

function refreshStats() {
  statGold.textContent = String(gold);
  statLives.textContent = String(lives);
  statWave.textContent = `${waveIndex} / ${difficulty.waves}`;
  statEnemies.textContent = String(enemies.length);
}

function refreshWaveButton() {
  statDifficulty.textContent = difficulty.label;
  statWave.textContent = `${waveIndex} / ${difficulty.waves}`;
  if (finished) {
    btnWave.textContent = "종료";
    btnWave.disabled = true;
    btnWave.classList.remove("btn-pulse");
    return;
  }
  if (waveActive) {
    btnWave.textContent = "전투 중";
    btnWave.disabled = true;
    btnWave.classList.remove("btn-pulse");
    return;
  }
  btnWave.textContent = "다음 웨이브";
  btnWave.disabled = false;
  btnWave.classList.add("btn-pulse");
}

function refreshInfo() {
  if (!selectedTower) {
    infoPanel.classList.remove("show");
    return;
  }
  const spec = TOWER_TYPES[selectedTower.type];
  infoPanel.classList.add("show");
  infoText.innerHTML = `<strong>${spec.label} 타워</strong> · 사거리 ${spec.range} · 피해 ${spec.damage}`;
}

function towerAt(cell) {
  return towers.find((tower) => tower.cell.cx === cell.cx && tower.cell.cz === cell.cz) ?? null;
}

function setPlacing(typeId) {
  placing = placing === typeId ? null : typeId;
  for (const button of towerRow.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.tower === placing));
  }
  if (placing) {
    selectedTower = null;
    refreshInfo();
    toast(`${TOWER_TYPES[placing].label} 타워를 선택했습니다. 보드의 빈 셀을 누르세요.`);
  }
}

for (const typeId of TOWER_ORDER) {
  const spec = TOWER_TYPES[typeId];
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tower-button";
  button.dataset.tower = typeId;
  button.setAttribute("aria-pressed", "false");
  const name = document.createElement("span");
  name.className = "name";
  const swatch = document.createElement("span");
  swatch.className = "swatch";
  swatch.style.background = spec.css;
  name.append(swatch, document.createTextNode(spec.label));
  const cost = document.createElement("span");
  cost.className = "cost";
  cost.textContent = `${spec.cost} 골드`;
  button.append(name, cost);
  button.addEventListener("click", () => setPlacing(typeId));
  towerRow.append(button);
}

function startWave() {
  if (waveActive || waveIndex >= difficulty.waves || finished) return;
  const wave = wavesFor(difficulty)[waveIndex];
  const scale = (1 + waveIndex * 0.18) * difficulty.hpScale;
  spawnQueue = buildSpawnQueue(wave).map((event) => ({ ...event, scale }));
  waveTimer = 0;
  waveActive = true;
  toast(`웨이브 ${waveIndex + 1} 시작!`);
  refreshWaveButton();
}

function spawnEnemy(typeId, scale = 1) {
  const enemy = createEnemy(typeId, scale);
  const start = PATH_POINTS[0];
  enemy.group.position.set(start.x, 0, start.z);
  stage.scene.add(enemy.group);
  enemies.push(enemy);
}

function removeEnemy(enemy) {
  const index = enemies.indexOf(enemy);
  if (index !== -1) enemies.splice(index, 1);
  stage.scene.remove(enemy.group);
  disposeEnemy(enemy);
}

function damageEnemy(enemy, amount) {
  if (!enemy.alive) return;
  enemy.hp -= amount;
  if (enemy.hp <= 0) {
    enemy.alive = false;
    gold += enemy.reward;
    kills += 1;
    removeEnemy(enemy);
  }
}

function fire(tower, target) {
  const spec = TOWER_TYPES[tower.type];
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 8),
    new THREE.MeshBasicMaterial({ color: spec.color }),
  );
  mesh.position.copy(tower.tip.getWorldPosition(new THREE.Vector3()));
  stage.scene.add(mesh);
  projectiles.push({
    mesh,
    target,
    lastPos: target.group.position.clone(),
    speed: 10,
    damage: spec.damage,
    splash: spec.splash ?? 0,
  });
}

function applyProjectileDamage(projectile, point) {
  if (projectile.splash > 0) {
    for (const enemy of [...enemies]) {
      if (!enemy.alive) continue;
      const distance = enemy.group.position.distanceTo(point);
      if (distance > projectile.splash) continue;
      const falloff = 1 - 0.4 * (distance / projectile.splash);
      damageEnemy(enemy, projectile.damage * falloff);
    }
    return;
  }
  if (projectile.target.alive) damageEnemy(projectile.target, projectile.damage);
}

function updateProjectiles(delta) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = projectiles[i];
    if (projectile.target.alive) projectile.lastPos.copy(projectile.target.group.position);
    const direction = projectile.lastPos.clone().sub(projectile.mesh.position);
    const distance = direction.length();
    const step = projectile.speed * delta;
    if (distance <= step + 0.22) {
      applyProjectileDamage(projectile, projectile.lastPos);
      stage.scene.remove(projectile.mesh);
      projectile.mesh.geometry.dispose();
      projectile.mesh.material.dispose();
      projectiles.splice(i, 1);
      continue;
    }
    projectile.mesh.position.addScaledVector(direction.divideScalar(distance), step);
  }
}

function endWave() {
  waveActive = false;
  waveIndex += 1;
  wavesCleared += 1;
  if (waveIndex >= difficulty.waves) {
    finished = true;
    finishGame(true);
    return;
  }
  toast(`웨이브 ${waveIndex} 방어 성공!`);
  refreshWaveButton();
}

function finishGame(won) {
  const stars = starsFor({ won, livesLeft: lives, lives: difficulty.lives });
  const score = scoreFor({ kills, livesLeft: lives, lives: difficulty.lives, wavesCleared });
  difficultyProgress.record(difficulty.id, { stars, score, timeMs: 0 });
  const difficultyIndex = DIFFICULTIES.findIndex((entry) => entry.id === difficulty.id);
  const nextDifficulty = difficultyIndex >= 0 ? DIFFICULTIES[difficultyIndex + 1] : null;

  if (won && !nextDifficulty) {
    showEndingScreen({
      progress: difficultyProgress,
      levels: DIFFICULTIES.map((entry) => ({ id: entry.id, label: entry.label })),
      title: "가장 어려운 난이도까지 막았어요!",
      rows: [
        ["마지막 난이도", `${difficulty.label} · ${difficulty.waves}웨이브`],
        ["막은 웨이브", `${wavesCleared} / ${difficulty.waves}`],
        ["처치한 적", `${kills}마리`],
      ],
      onFirst: () => {
        difficulty = DIFFICULTIES[0];
        resetGame();
      },
      onLevels: openDifficulties,
    });
    return;
  }

  // 이 게임의 단계는 "난이도" 다. 승리했을 때 다음 난이도로 이어 갈 수 있게 첫 버튼으로 둔다.
  const actions = won
    ? [
        { id: "next", label: "다음 난이도", primary: true, pulse: true },
        { id: "retry", label: "다시 하기" },
        { id: "levels", label: "난이도 선택" },
      ]
    : [
        { id: "retry", label: "다시 하기", primary: true },
        { id: "levels", label: "난이도 선택" },
      ];
  showResult({
    kicker: won ? "승리" : "패배",
    title: `${difficulty.label} · ${difficulty.waves}웨이브`,
    stars,
    score,
    bestScore: difficultyProgress.levelState(difficulty.id)?.bestScore ?? score,
    rows: [
      ["막은 웨이브", `${wavesCleared} / ${difficulty.waves}`],
      ["처치한 적", `${kills}마리`],
      ["남은 생명", `${lives} / ${difficulty.lives}`],
    ],
    actions,
  }).then((action) => {
    if (action === "next" && nextDifficulty) {
      difficulty = nextDifficulty;
      resetGame();
    }
    if (action === "first") {
      difficulty = DIFFICULTIES[0];
      resetGame();
    }
    if (action === "retry") resetGame();
    if (action === "levels") openDifficulties();
  });
}

function openDifficulties() {
  showLevelSelect({
    title: "난이도 선택",
    levels: DIFFICULTIES.map((entry) => ({
      id: entry.id,
      label: `${entry.label} · ${entry.description}`,
      stars: difficultyProgress.levelState(entry.id)?.stars ?? 0,
      unlocked: true,
    })),
  }).then((result) => {
    if (!result || !result.levelId) return;
    const next = DIFFICULTIES.find((entry) => entry.id === result.levelId);
    if (next) {
      difficulty = next;
      resetGame();
    }
  });
}

function update(delta) {
  if (finished) return;
  const scaled = delta * speed;

  if (waveActive) {
    waveTimer += scaled;
    while (spawnQueue.length > 0 && spawnQueue[0].time <= waveTimer) {
      const event = spawnQueue.shift();
      spawnEnemy(event.type, event.scale);
    }
  }

  for (const enemy of [...enemies]) {
    updateEnemy(enemy, scaled);
    if (enemy.reachedEnd) {
      lives -= 1;
      removeEnemy(enemy);
      if (lives <= 0) {
        finished = true;
        finishGame(false);
        refreshWaveButton();
      }
    }
  }

  for (const tower of towers) {
    updateTower(tower, scaled, enemies, fire);
  }

  updateProjectiles(scaled);

  if (waveActive && spawnQueue.length === 0 && enemies.length === 0) {
    endWave();
  }

  refreshStats();
}

function tryPlace(cell) {
  if (!placing) return;
  const spec = TOWER_TYPES[placing];
  if (!inBounds(cell.cx, cell.cz)) {
    toast("보드 밖입니다.", true);
    return;
  }
  if (isPathCell(cell.cx, cell.cz)) {
    toast("길 위에는 설치할 수 없습니다.", true);
    return;
  }
  if (towerAt(cell)) {
    toast("이미 타워가 있는 칸입니다.", true);
    return;
  }
  if (gold < spec.cost) {
    toast("골드가 부족합니다.", true);
    return;
  }
  gold -= spec.cost;
  const tower = createTower(placing, cell);
  stage.scene.add(tower.group);
  towers.push(tower);
  toast(`${spec.label} 타워를 설치했습니다. (-${spec.cost} 골드)`);
  refreshStats();
}

function selectTower(tower) {
  selectedTower = tower;
  refreshInfo();
}

btnWave.addEventListener("click", startWave);
document.getElementById("btn-difficulty").addEventListener("click", openDifficulties);

btnSpeed.addEventListener("click", () => {
  speed = speed === 1 ? 2 : 1;
  btnSpeed.textContent = `배속 ${speed}×`;
  btnSpeed.setAttribute("aria-pressed", String(speed === 2));
});

btnSell.addEventListener("click", () => {
  if (!selectedTower) return;
  const spec = TOWER_TYPES[selectedTower.type];
  const refund = Math.floor(spec.cost * 0.6);
  gold += refund;
  const index = towers.indexOf(selectedTower);
  if (index !== -1) towers.splice(index, 1);
  stage.scene.remove(selectedTower.group);
  selectedTower = null;
  refreshInfo();
  refreshStats();
  toast(`타워를 판매했습니다. (+${refund} 골드)`);
});

function resetGame() {
for (const tower of towers) stage.scene.remove(tower.group);
for (const enemy of enemies) {
  stage.scene.remove(enemy.group);
  disposeEnemy(enemy);
}
for (const projectile of projectiles) {
  stage.scene.remove(projectile.mesh);
  projectile.mesh.geometry.dispose();
  projectile.mesh.material.dispose();
}
towers.length = 0;
enemies.length = 0;
projectiles.length = 0;
gold = difficulty.gold;
lives = difficulty.lives;
kills = 0;
wavesCleared = 0;
waveIndex = 0;
waveActive = false;
waveTimer = 0;
spawnQueue = [];
placing = null;
selectedTower = null;
finished = false;
speed = 1;
btnSpeed.textContent = "배속 1×";
btnSpeed.setAttribute("aria-pressed", "false");
for (const button of towerRow.querySelectorAll("button")) {
  button.setAttribute("aria-pressed", "false");
}
refreshInfo();
refreshStats();
refreshWaveButton();
toast("다시 시작했습니다.");
}

document.getElementById("btn-reset").addEventListener("click", resetGame);

let pointerStart = null;

canvas.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (!pointerStart) return;
  const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  pointerStart = null;
  if (moved > 5) return;

  if (placing) {
    const point = pick.pickPlane(event.clientX, event.clientY, BOARD_Y);
    if (!point) return;
    tryPlace(worldToCell(point.x, point.z));
    return;
  }

  const proxies = towers.map((tower) => tower.proxy);
  const hits = pick.pick(event.clientX, event.clientY, proxies);
  if (hits.length > 0) {
    const tower = towers.find((entry) => entry.proxy === hits[0].object);
    if (tower) selectTower(tower);
    return;
  }
  selectedTower = null;
  refreshInfo();
});


const VIEWS = {
  card: { position: [-6.2, 10.2, 10.4], target: [0.4, 0, 0.6] },
  default: { position: [-8.5, 14.5, 13.5], target: [0.4, 0, 0.6] },
  front: { position: [0, 3.4, 15], target: [0, 0.6, 0] },
  side: { position: [15, 3.4, 0], target: [0, 0.6, 0] },
  top: { position: [0, 17, 0.02], target: [0, 0, 0] },
};
const views = createViewController(stage, VIEWS);

function setView(name) {
  const view = VIEWS[name] ?? VIEWS.default;
  stage.camera.position.set(...view.position);
  stage.controls.target.set(...view.target);
  stage.controls.update();
}

const badge = createInvariantBadge();
let invariantProblems = [];
let invariantTimer = 0;

function updateInvariants(delta) {
  invariantTimer += delta;
  if (invariantTimer < 0.5) return;
  invariantTimer = 0;
  invariantProblems = checkInvariants({ towers, enemies, pathPoints: PATH_POINTS });
  badge.show(invariantProblems);
  if (invariantProblems.length > 0) {
    console.error(`[불변식 위반] ${invariantProblems.map((problem) => problem.message).join(" | ")}`);
  }
}

stage.start((delta) => {
  update(delta);
  for (const enemy of enemies) updateHealthBar(enemy, stage.camera);
  updateInvariants(delta);
});

refreshStats();
refreshWaveButton();

window.__gameApi = {
  getState: () => ({
    gold,
    lives,
    wave: waveIndex,
    waveActive,
    towers: towers.map((tower) => ({ type: tower.type, cell: tower.cell })),
    enemies: enemies.map((enemy) => ({
      type: enemy.type,
      hp: Math.round(enemy.hp),
      maxHp: enemy.maxHp,
      progress: Number(enemy.progress.toFixed(2)),
    })),
    projectiles: projectiles.length,
    finished,
  }),
  board: { COLS, ROWS, pathPoints: PATH_POINTS.length, cellToWorld },
  getInvariants: () => invariantProblems,
  getDifficulty: () => ({
    id: difficulty.id,
    label: difficulty.label,
    waves: difficulty.waves,
    kills,
    wavesCleared,
    lives,
  }),
  getScreenPositions: () => {
    const list = [
      ...towers.map((tower) => ({ id: tower.id, position: tower.group.position })),
      ...enemies.map((enemy) => ({ id: enemy.id, position: enemy.group.position })),
    ];
    return list.map((entry) => {
      const projected = entry.position.clone().project(stage.camera);
      return {
        id: entry.id,
        x: projected.x,
        y: projected.y,
        visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
      };
    });
  },
  setView: views.setView,
};
