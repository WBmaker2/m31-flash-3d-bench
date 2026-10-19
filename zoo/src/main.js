import * as THREE from "three";
import { createStage, createPicker } from "./stage.js";
import { createWorld } from "./world.js";
import { SPECIES, SPECIES_ORDER } from "./species.js";
import { buildAnimal, updateAnimal, disposeAnimal } from "./animals.js";
import { checkInvariants } from "./invariants.js";
import { FIND_LEVELS, POSE_LABEL, createDex, createFinder } from "./dex.js";
import { loadState, saveState } from "../../common/storage.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showPanel, showResult, showToast } from "../../common/overlay.js";

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const pick = createPicker(canvas, stage.camera);
createWorld(stage.scene);

const animals = [];
let currentSpecies = "cat";
let walking = false;
let nextId = 1;

const dex = createDex();
for (const key of loadState("zoo", "dex", [])) {
  const [species, pose] = String(key).split(":");
  dex.register(species, pose);
}
const findProgress = createProgress("zoo", { levels: FIND_LEVELS.map((level) => ({ id: level.id })) });
let findMode = null;

const findPanel = document.getElementById("find-panel");
const findTarget = document.getElementById("find-target");
const findTimer = document.getElementById("find-timer");
const findScore = document.getElementById("find-score");

const statSpecies = document.getElementById("stat-species");
const statCount = document.getElementById("stat-count");
const statMotion = document.getElementById("stat-motion");
const speciesGroup = document.getElementById("species-group");
const btnWalk = document.getElementById("btn-walk");

function refreshStatus() {
  statSpecies.textContent = SPECIES[currentSpecies].label;
  statCount.textContent = String(animals.length);
  statMotion.textContent = walking ? "걷는 중" : "가만히";
}

function setSpecies(speciesId) {
  currentSpecies = speciesId;
  for (const button of speciesGroup.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.species === speciesId));
  }
  refreshStatus();
}

function addAnimal(speciesId = currentSpecies) {
  const animal = buildAnimal(speciesId);
  const index = animals.length;
  animal.id = nextId;
  nextId += 1;
  const cameraAzimuth = Math.atan2(stage.camera.position.z, stage.camera.position.x);
  animal.angle = cameraAzimuth - Math.PI / 2 + index * 2.399963;
  animal.orbitRadius = 1.9 + Math.sqrt(index) * 0.88;
  animal.orbitSpeed = 0.26 + (index % 4) * 0.06;
  animal.walking = walking;
  animal.proxy.userData.animalId = animal.id;
  stage.scene.add(animal.group);
  animals.push(animal);
  refreshStatus();
  return animal;
}

function removeAll() {
  for (const animal of animals) {
    stage.scene.remove(animal.group);
    disposeAnimal(animal);
  }
  animals.length = 0;
  refreshStatus();
}

for (const speciesId of SPECIES_ORDER) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.species = speciesId;
  button.textContent = SPECIES[speciesId].label;
  button.setAttribute("aria-pressed", String(speciesId === currentSpecies));
  button.addEventListener("click", () => {
    setSpecies(speciesId);
    const existing = animals.find((animal) => animal.speciesId === speciesId);
    if (existing) focusAnimal(existing);
    else addAnimal(speciesId);
  });
  speciesGroup.append(button);
}

document.getElementById("btn-add").addEventListener("click", () => {
  addAnimal(currentSpecies);
});

btnWalk.addEventListener("click", () => {
  walking = !walking;
  btnWalk.setAttribute("aria-pressed", String(walking));
  btnWalk.textContent = walking ? "멈추기" : "모두 걷기";
  for (const animal of animals) animal.walking = walking;
  refreshStatus();
});

document.getElementById("btn-reset").addEventListener("click", () => {
  removeAll();
  addAnimal(currentSpecies);
});

function focusAnimal(animal) {
  const target = new THREE.Vector3();
  animal.group.getWorldPosition(target);
  stage.controls.target.lerp(target, 0.6);
}

let pointerDownAt = null;

canvas.addEventListener("pointerdown", (event) => {
  pointerDownAt = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (!pointerDownAt) return;
  const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
  pointerDownAt = null;
  if (moved > 5) return;

  const proxies = animals.map((animal) => animal.proxy);
  const hits = pick(event.clientX, event.clientY, proxies);
  if (hits.length === 0) return;
  const id = hits[0].object.userData.animalId;
  const animal = animals.find((entry) => entry.id === id);
  if (!animal) return;
  animal.hopTimer = animal.hopDuration;
  setSpecies(animal.speciesId);
  registerDex(animal);
  if (findMode) answerFind(animal.speciesId);
});

function registerDex(animal) {
  const pose = animal.walking ? "walk" : "idle";
  if (dex.register(animal.speciesId, pose)) {
    saveState("zoo", "dex", dex.entries().filter((entry) => entry.found).map((entry) => `${entry.species}:${entry.pose}`));
    toastMessage(`도감 등록: ${SPECIES[animal.speciesId].label} (${POSE_LABEL[pose]})`);
  }
}

function toastMessage(message) {
  showToast(message, "info");
}

function openDex() {
  const panel = document.createElement("div");
  panel.className = "m31-panel";
  const kicker = document.createElement("p");
  kicker.className = "m31-kicker";
  kicker.textContent = "도감";
  const title = document.createElement("h2");
  title.className = "m31-title";
  title.textContent = `${dex.count()} / ${dex.total()} 채집`;
  const grid = document.createElement("div");
  grid.className = "dex-grid";
  for (const entry of dex.entries()) {
    const cell = document.createElement("div");
    cell.className = entry.found ? "dex-cell is-found" : "dex-cell";
    const name = document.createElement("span");
    name.className = "dex-name";
    name.textContent = SPECIES[entry.species].label;
    const pose = document.createElement("span");
    pose.className = "dex-pose";
    pose.textContent = entry.found ? POSE_LABEL[entry.pose] : "미등록";
    cell.append(name, pose);
    grid.append(cell);
  }
  panel.append(kicker, title, grid);
  showPanel(panel);
}

function openFindLevels() {
  showLevelSelect({
    title: "찾기 게임",
    levels: FIND_LEVELS.map((level) => ({
      id: level.id,
      label: `${level.label} · ${level.rounds}마리 · ${level.timeLimit}초`,
      stars: findProgress.levelState(level.id)?.stars ?? 0,
      unlocked: findProgress.isUnlocked(level.id),
    })),
  }).then((result) => {
    if (!result || !result.levelId) return;
    const level = FIND_LEVELS.find((entry) => entry.id === result.levelId);
    if (level) startFind(level);
  });
}

function ensureSpecies(speciesId) {
  if (animals.some((animal) => animal.speciesId === speciesId)) return;
  const animal = addAnimal(speciesId);
  animal.walking = true;
}

function startFind(level) {
  findMode = { level, finder: createFinder(level), timeLeft: level.timeLimit };
  ensureSpecies(findMode.finder.current);
  walking = true;
  btnWalk.setAttribute("aria-pressed", "true");
  btnWalk.textContent = "멈추기";
  for (const animal of animals) animal.walking = true;
  findPanel.hidden = false;
  refreshFindPanel();
}

function endFind() {
  const mode = findMode;
  findMode = null;
  findPanel.hidden = true;
  if (!mode) return;
  const level = mode.level;
  const bonus = mode.finder.timeBonus(mode.timeLeft);
  const score = mode.finder.score + bonus;
  const stars = mode.finder.streak >= level.rounds ? 3 : mode.finder.streak >= Math.ceil(level.rounds / 2) ? 2 : 1;
  findProgress.record(level.id, { stars, score, timeMs: (level.timeLimit - mode.timeLeft) * 1000 });
  showResult({
    kicker: "찾기 게임",
    title: level.label,
    stars,
    score,
    bestScore: findProgress.levelState(level.id)?.bestScore ?? score,
    rows: [
      ["찾은 수", `${mode.finder.index} / ${level.rounds}마리`],
      ["남은 시간 보너스", `+${bonus}`],
    ],
    actions: [
      { id: "retry", label: "다시 하기", primary: true },
      { id: "levels", label: "레벨 선택" },
    ],
  }).then((action) => {
    if (action === "retry") startFind(level);
    if (action === "levels") openFindLevels();
  });
}

function answerFind(speciesId) {
  if (!findMode) return;
  const result = findMode.finder.answer(speciesId);
  if (result.correct) {
    findMode.timeLeft = Math.min(findMode.level.timeLimit, findMode.timeLeft + 2);
    if (findMode.finder.finished) {
      endFind();
      return;
    }
    ensureSpecies(findMode.finder.current);
  } else {
    findMode.timeLeft = Math.max(0, findMode.timeLeft - findMode.level.wrongPenalty);
  }
  refreshFindPanel();
}

function refreshFindPanel() {
  if (!findMode) return;
  const target = findMode.finder.current;
  findTarget.textContent = target ? `${SPECIES[target].label}를 찾아보세요` : "완료";
  findTimer.textContent = `${Math.ceil(findMode.timeLeft)}초`;
  findScore.textContent = `점수 ${findMode.finder.score} · 연속 ${findMode.finder.streak} · 남은 목표 ${findMode.finder.queue.length - findMode.finder.index}`;
}

document.getElementById("btn-dex").addEventListener("click", openDex);
document.getElementById("btn-find").addEventListener("click", openFindLevels);

const VIEWS = {
  card: { position: [2.9, 2.05, 4.4], target: [0.2, 0.9, 0.1] },
  default: { position: [6.4, 3.6, 7.8], target: [0, 0.85, 0] },
  front: { position: [0, 2.4, 9.5], target: [0, 0.9, 0] },
  side: { position: [9.5, 2.4, 0], target: [0, 0.9, 0] },
  top: { position: [0, 12, 0.02], target: [0, 0.4, 0] },
};

function setView(name) {
  const view = VIEWS[name] ?? VIEWS.default;
  stage.camera.position.set(...view.position);
  stage.controls.target.set(...view.target);
  stage.controls.update();
}

let invariantBadge = null;
let invariantProblems = [];
let invariantTimer = 0;

function renderInvariantBadge(problems) {
  if (!invariantBadge) {
    invariantBadge = document.createElement("div");
    invariantBadge.style.cssText =
      "position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:6;padding:7px 14px;border-radius:11px;font:600 12.5px/1.45 system-ui,sans-serif;background:#3a1414;color:#ffb0a5;border:1px solid rgba(255,107,92,.65);display:none;pointer-events:none;max-width:72vw";
    document.body.append(invariantBadge);
  }
  if (problems.length === 0) {
    invariantBadge.style.display = "none";
    return;
  }
  invariantBadge.style.display = "block";
  invariantBadge.textContent = `불변식 위반 ${problems.length}건 · ${problems[0].message}`;
}

function updateInvariants(delta) {
  invariantTimer += delta;
  if (invariantTimer < 0.5) return;
  invariantTimer = 0;
  invariantProblems = checkInvariants({ animals });
  renderInvariantBadge(invariantProblems);
  if (invariantProblems.length > 0) {
    console.error(`[불변식 위반] ${invariantProblems.map((problem) => problem.message).join(" | ")}`);
  }
}

stage.start((delta, elapsed) => {
  for (const animal of animals) updateAnimal(animal, delta, elapsed, stage.camera);
  if (findMode) {
    findMode.timeLeft -= delta;
    if (findMode.timeLeft <= 0) {
      endFind();
    } else {
      refreshFindPanel();
    }
  }
  updateInvariants(delta);
});

addAnimal("cat");
addAnimal("panda");
refreshStatus();

window.__gameApi = {
  getState: () => ({
    species: currentSpecies,
    count: animals.length,
    walking,
    speciesList: animals.map((animal) => animal.speciesId),
  }),
  getInvariants: () => invariantProblems,
  getDex: () => ({ count: dex.count(), total: dex.total(), entries: dex.entries() }),
  getFind: () =>
    findMode
      ? {
          level: findMode.level.id,
          target: findMode.finder.current,
          index: findMode.finder.index,
          score: findMode.finder.score,
          timeLeft: Math.ceil(findMode.timeLeft),
        }
      : null,
  setChrome: (options = {}) => {
    if (options.labels === false) {
      for (const animal of animals) animal.label.visible = false;
    }
    if (options.labels === true) {
      for (const animal of animals) animal.label.visible = true;
    }
  },
  getScreenPositions: () =>
    animals.map((animal) => {
      const projected = animal.proxy.getWorldPosition(new THREE.Vector3()).project(stage.camera);
      return {
        id: animal.id,
        x: projected.x,
        y: projected.y,
        visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
      };
    }),
  setView,
};
