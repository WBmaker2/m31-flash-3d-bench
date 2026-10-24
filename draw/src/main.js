// 게임 진행과 화면 연결. 그림 비교는 common/parts/draw3d.js 에 있고,
// 여기서는 상태를 들고 조작과 판정을 화면에 연결한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createDrawView } from "./drawView.js";
import { createHud } from "./hud.js";
import { createControls } from "./controls.js";
import { COLORS, LEVELS, evaluateLevel, levelColors, levelIndexById } from "./levels.js";
import { cellKey, parsePicture } from "../../common/parts/draw3d.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";
import { showEndingScreen } from "../../common/ending.js";

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const views = createViews(stage);
const view = createDrawView(stage.scene);
const badge = createInvariantBadge({ bottom: "120px" });

const progress = createProgress("draw", { levels: LEVELS });

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  placement: new Map(),
  selected: "R",
  phase: "play",
  resultShown: false,
  invariantProblems: [],
  invariantTimer: 0,
};

const hud = createHud({
  onColor: (key) => selectColor(key),
  onClear: () => clearBoard(),
  onLevels: () => openLevels(),
});

function selectColor(key) {
  state.selected = key;
  hud.setSelectedColor(key);
}

function result() {
  return evaluateLevel(state.level, state.placement);
}

function refresh() {
  view.setCubes(state.placement);
  const value = result();
  hud.setStats({
    rate: value.rate,
    matched: value.matched,
    total: value.total,
    extra: value.extra,
  });
}

function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.placement = new Map();
  state.phase = "play";
  state.resultShown = false;

  const picture = parsePicture(state.level.rows);
  view.setSize({ width: picture.width, height: picture.height });
  view.setCubes(state.placement);
  stage.setFocus({ x: 0, y: 0.1, z: 0, radius: Math.max(picture.width, picture.height) * 0.17 });
  stage.resetView();

  const colors = levelColors(state.level);
  state.selected = colors[0]?.key ?? "R";
  hud.setLevel(state.level);
  hud.setTarget(state.level.rows, Object.fromEntries(colors.map((entry) => [entry.key, entry.css])));
  hud.setPalette(
    colors.map((entry) => ({ key: entry.key, css: entry.css })),
    state.selected,
  );
  hud.setMessage("칸을 눌러 큐브를 놓고, 목표 그림을 따라 칠해 보세요.");
  refresh();
}

function clearBoard() {
  state.placement = new Map();
  state.phase = "play";
  state.resultShown = false;
  refresh();
  hud.setMessage("판을 비웠습니다.");
}

function place(col, row) {
  const key = cellKey(col, row);
  if (state.placement.has(key)) {
    state.placement.delete(key);
  } else {
    state.placement.set(key, state.selected);
  }
  state.phase = "play";
  state.resultShown = false;
  refresh();
  checkMission();
}

function pickAt(x, z) {
  const size = parsePicture(state.level.rows);
  const col = Math.round(x / view.cell + (size.width - 1) / 2);
  const row = Math.round(z / view.cell + (size.height - 1) / 2);
  if (col < 0 || row < 0 || col >= size.width || row >= size.height) return;
  place(col, row);
}

/** 마지막 단계를 완성했다면 엔딩 화면으로 넘어간다. 넘어갔으면 true. */
function showEndingIfLast(value) {
  if (!value.cleared) return false;
  if (state.levelIndex + 1 < LEVELS.length) return false;
  showEndingScreen({
    progress,
    levels: LEVELS,
    title: "마지막 그림까지 완성했어요!",
    rows: [
      ["마지막 단계", state.level.label],
      ["일치율", `${Math.round(value.rate * 100)}%`],
      ["잘못 놓은 칸", `${value.extra} 개`],
    ],
    onFirst: () => gotoLevel(0),
    onLevels: openLevels,
  });
  return true;
}

function finishLevel() {
  const value = result();
  state.phase = "scored";
  state.resultShown = true;
  progress.record(state.level.id, { stars: value.stars, score: value.score });
  if (showEndingIfLast(value)) return;
  showResult({
    kicker: value.cleared ? "그림 완성" : "아직 덜 완성됐어요",
    title: state.level.label,
    stars: value.stars,
    score: value.score,
    rows: [
      ["일치율", `${Math.round(value.rate * 100)}%`],
      ["맞은 칸", `${value.matched} / ${value.total}`],
      ["잘못 놓은 칸", `${value.extra} 개`],
    ],
    detail: value.cleared
      ? value.extra === 0
        ? "목표 그림과 똑같아요!"
        : "완성했어요! 잘못 놓은 칸을 지우면 3성이에요."
      : "목표 그림을 보며 색을 맞춰 보세요.",
    actions: resultOptions(),
  }).then((action) => {
    if (action === "next") gotoLevel(state.levelIndex + 1);
    if (action === "first") gotoLevel(0);
    if (action === "retry") clearBoard();
    if (action === "levels") openLevels();
  });
}

function resultOptions() {
  // 마지막 단계는 엔딩 화면으로 넘어가므로 여기서는 항상 다음 단계가 있다.
  return [
    { id: "next", label: "다음 단계", primary: true, pulse: true },
    { id: "retry", label: "다시 그리기" },
    { id: "levels", label: "레벨 선택" },
  ];
}

function checkMission() {
  if (state.resultShown) return;
  const value = result();
  if (!value.cleared) return;
  state.resultShown = true;
  state.phase = "scored";
  progress.record(state.level.id, { stars: value.stars, score: value.score });
  if (showEndingIfLast(value)) return;
  showResult({
    kicker: "그림 완성",
    title: state.level.label,
    stars: value.stars,
    score: value.score,
    rows: [
      ["일치율", `${Math.round(value.rate * 100)}%`],
      ["잘못 놓은 칸", `${value.extra} 개`],
    ],
    detail: "목표 그림을 완성했어요!",
    actions: resultOptions(),
  }).then((action) => {
    if (action === "next") gotoLevel(state.levelIndex + 1);
    if (action === "first") gotoLevel(0);
    if (action === "retry") clearBoard();
    if (action === "levels") openLevels();
  });
}

function gotoLevel(index) {
  loadLevel(index);
  showToast(`레벨 ${String(state.levelIndex + 1).padStart(2, "0")} · ${state.level.label}`);
}

function openLevels() {
  showLevelSelect({
    title: "레벨 선택",
    levels: LEVELS.map((level, index) => ({
      id: level.id,
      label: `${String(index + 1).padStart(2, "0")} · ${level.label}`,
      stars: progress.levelState(level.id)?.stars ?? 0,
      unlocked: progress.isUnlocked(level.id),
    })),
    footerActions: [{ id: "close", label: "닫기" }],
  }).then((result) => {
    if (result && result.levelId) loadLevel(levelIndexById(result.levelId));
  });
}

createControls({
  canvas,
  camera: stage.camera,
  targets: () => [...view.cubes.children],
  onPick: (col, row, hit) => {
    if (col === null || col === undefined) {
      if (hit) pickAt(hit.x, hit.z);
      return;
    }
    place(col, row);
  },
  actions: {
    clear: () => clearBoard(),
  },
});

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  const value = result();
  state.invariantProblems = checkInvariants({
    placement: state.placement,
    rate: value.rate,
    matched: value.matched,
    total: value.total,
    extra: value.extra,
  });
  badge.show(state.invariantProblems);
  if (state.invariantProblems.length > 0) {
    console.error(
      `[불변식 위반] ${state.invariantProblems.map((problem) => problem.message).join(" | ")}`,
    );
  }
}

stage.start((delta) => {
  updateInvariants(delta);
});

loadLevel(0);

/** 자동 검사용. 목표 그림대로 칠한다. */
function solve() {
  const placement = new Map();
  for (const cell of parsePicture(state.level.rows).cells) {
    placement.set(cellKey(cell.col, cell.row), cell.color);
  }
  state.placement = placement;
  state.phase = "play";
  state.resultShown = false;
  refresh();
  checkMission();
  return true;
}

window.__gameApi = {
  getState: () => {
    const value = result();
    return {
      level: state.level.id,
      phase: state.phase,
      rate: Number(value.rate.toFixed(3)),
      matched: value.matched,
      total: value.total,
      extra: value.extra,
      cleared: value.cleared,
      stars: value.stars,
    };
  },
  getInvariants: () => state.invariantProblems,
  getScreenPositions: () => {
    const entries = [];
    for (const child of view.cubes.children) {
      const projected = child.getWorldPosition(new THREE.Vector3()).project(stage.camera);
      entries.push({
        id: `cube-${child.userData.col}-${child.userData.row}`,
        x: projected.x,
        y: projected.y,
        visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
      });
    }
    return entries;
  },
  setView: (name) => views.setView(name),
  setChrome: () => {},
  solve,
  loadLevel,
  levelIndex: () => state.levelIndex,
};
