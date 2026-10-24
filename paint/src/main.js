// 게임 진행과 화면 연결. 복셀 계산은 common/parts/paint3d.js 에 있고,
// 여기서는 상태를 들고 조작과 판정을 화면에 연결한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createPaintView } from "./paintView.js";
import { createHud } from "./hud.js";
import { createControls } from "./controls.js";
import { COLORS, LEVELS, buildLevel, evaluatePaint, levelIndexById } from "./levels.js";
import { findPart } from "./objects.js";
import { applyColor, floodFill, matchRate } from "../../common/parts/paint3d.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";
import { showEndingScreen } from "../../common/ending.js";

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const views = createViews(stage);
const view = createPaintView(stage.scene);
const badge = createInvariantBadge({ bottom: "150px" });

const progress = createProgress("paint", { levels: LEVELS });

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  built: null,
  colors: new Map(),
  clicks: 0,
  selected: "빨강",
  phase: "play",
  resultShown: false,
  invariantProblems: [],
  invariantTimer: 0,
};

function hexCss(value) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

const hud = createHud({
  onColor: (name) => selectColor(name),
  onScore: () => finishLevel(),
  onClear: () => resetColors(),
  onLevels: () => openLevels(),
  onHint: () => toggleHint(),
});

function selectColor(name) {
  state.selected = name;
  hud.setSelectedColor(name);
}

function rate() {
  if (!state.built) return 0;
  return matchRate({
    current: state.colors,
    target: state.built.target,
    surface: state.built.surface,
  });
}

function refreshHud() {
  hud.setStats({
    rate: rate(),
    clicks: state.clicks,
    par: state.built?.par ?? 0,
  });
}

function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.built = buildLevel(state.level);
  state.colors = new Map(state.built.initial);
  state.clicks = 0;
  state.phase = "play";
  state.resultShown = false;
  state.selected = state.level.palette[0];

  view.setVoxels(state.built.surface, state.built);
  stage.setFocus({ x: 0, y: view.height / 2, z: 0, radius: view.scale * 0.95 });
  stage.resetView();

  const rows = state.level.parts.map((partId) => {
    const found = findPart(partId);
    const name = state.level.target[partId];
    return {
      label: found?.part.label ?? partId,
      name,
      css: hexCss(COLORS[name] ?? 0xb9c0c8),
    };
  });

  hud.setLevel(state.level);
  hud.setTarget(rows);
  hud.setPalette(
    state.level.palette.map((name) => ({ name, css: hexCss(COLORS[name] ?? 0xb9c0c8) })),
    state.selected,
  );
  hud.setMessage("색을 고르고 인형을 눌러 칠하세요. 같은 나무 조각이 한 번에 칠해져요.");
  refreshHud();
}

function paint(key) {
  if (!key || !state.built) return;
  const region = floodFill({
    startKey: key,
    colors: state.colors,
    adjacency: state.built.adjacency,
  });
  if (region.length === 0) return;
  const result = applyColor(state.colors, region, COLORS[state.selected]);
  if (result.changed === 0) {
    showToast("이미 그 색이에요.");
    return;
  }
  state.colors = result.colors;
  state.clicks += 1;
  state.phase = "play";
  state.resultShown = false;
  view.setColors(state.colors);
  refreshHud();
  checkMission();
}

function resetColors() {
  if (!state.built) return;
  state.colors = new Map(state.built.initial);
  state.clicks = 0;
  state.phase = "play";
  state.resultShown = false;
  view.setColors(state.colors);
  refreshHud();
  hud.setMessage("처음 상태로 되돌렸습니다.");
}

function toggleHint() {
  const visible = !view.ghost.visible;
  view.setGhostVisible(visible);
  hud.setMessage(visible ? "목표 색을 겹쳐 보입니다." : "목표 색을 숨겼습니다.");
}

function resultOptions() {
  // 마지막 단계는 엔딩 화면으로 넘어가므로 여기서는 항상 다음 단계가 있다.
  return [
    { id: "next", label: "다음 단계", primary: true, pulse: true },
    { id: "retry", label: "다시 칠하기" },
    { id: "levels", label: "레벨 선택" },
  ];
}

function showResultPanel(result) {
  if (result.cleared && state.levelIndex + 1 >= LEVELS.length) {
    showEndingScreen({
      progress,
      levels: LEVELS,
      title: "마지막 그림까지 완성했어요!",
      rows: [
        ["마지막 단계", state.level.label],
        ["색 일치율", `${Math.round(result.rate * 100)}%`],
        ["칠한 횟수", `${result.clicks} 번`],
      ],
      onFirst: () => gotoLevel(0),
      onLevels: openLevels,
    });
    return;
  }
  showResult({
    kicker: result.cleared ? "완성" : "아직 남았어요",
    title: state.level.label,
    stars: result.stars,
    score: result.score,
    rows: [
      ["색 일치율", `${Math.round(result.rate * 100)}%`],
      ["칠한 횟수", `${result.clicks} 번 (최소 ${result.par} 번)`],
    ],
    detail: result.cleared
      ? result.clicks <= result.par
        ? "목표 그림과 똑같이 칠했어요. 다음 단계로 넘어가세요."
        : "완성했어요. 칠한 횟수를 줄이면 3성이 됩니다."
      : "목표 그림의 색을 하나씩 맞춰 보세요.",
    actions: resultOptions(),
  }).then((action) => {
    if (action === "next") gotoLevel(state.levelIndex + 1);
    if (action === "first") gotoLevel(0);
    if (action === "retry") resetColors();
    if (action === "levels") openLevels();
  });
}

function finishLevel() {
  const result = evaluatePaint(state.level, state.built, state.colors, state.clicks);
  state.phase = "scored";
  state.resultShown = true;
  progress.record(state.level.id, { stars: result.stars, score: result.score });
  showResultPanel(result);
}

function checkMission() {
  if (state.resultShown) return;
  const result = evaluatePaint(state.level, state.built, state.colors, state.clicks);
  if (!result.cleared) return;
  state.resultShown = true;
  state.phase = "scored";
  progress.record(state.level.id, { stars: result.stars, score: result.score });
  showResultPanel(result);
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
    if (result && result.levelId) {
      loadLevel(levelIndexById(result.levelId));
    }
  });
}

createControls({
  canvas,
  camera: stage.camera,
  targets: () => (view.mesh ? [view.mesh] : []),
  onPick: (instanceId) => paint(view.keyAt(instanceId)),
  actions: {
    score: () => finishLevel(),
    reset: () => resetColors(),
    hint: () => toggleHint(),
    pickIndex: (index) => {
      const name = state.level.palette[index];
      if (name) selectColor(name);
    },
  },
});

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  state.invariantProblems = checkInvariants({
    built: state.built,
    colors: state.colors,
    surfaceCount: state.built?.surface.size ?? 0,
    rate: rate(),
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

/** 자동 검사용. 목표 색으로 전부 칠한다. */
function solve() {
  const built = state.built;
  let colors = new Map(built.initial);
  let clicks = 0;
  for (const partId of state.level.parts) {
    const keys = [...built.surface.keys()].filter((key) => built.surface.get(key).partId === partId);
    if (keys.every((key) => built.initial.get(key) === built.target.get(key))) continue;
    const visited = new Set();
    for (const key of keys) {
      if (visited.has(key)) continue;
      const region = floodFill({ startKey: key, colors, adjacency: built.adjacency });
      for (const entry of region) visited.add(entry);
      const result = applyColor(colors, region, built.target.get(key));
      colors = result.colors;
      clicks += 1;
    }
  }
  state.colors = colors;
  state.clicks = clicks;
  state.phase = "play";
  state.resultShown = false;
  view.setColors(state.colors);
  refreshHud();
  hud.setMessage("목표 그림대로 칠했습니다.");
  checkMission();
  return true;
}

window.__gameApi = {
  getState: () => ({
    level: state.level.id,
    phase: state.phase,
    rate: Number(rate().toFixed(3)),
    clicks: state.clicks,
    par: state.built?.par ?? 0,
    cleared: rate() >= 0.999,
  }),
  getInvariants: () => state.invariantProblems,
  getScreenPositions: () => {
    const entries = [];
    if (!state.built) return entries;
    for (const [key, voxel] of state.built.surface) {
      const position = view.positionOf(key);
      if (!position) continue;
      const projected = position.clone().project(stage.camera);
      entries.push({
        id: `voxel-${voxel.partId}-${key}`,
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
