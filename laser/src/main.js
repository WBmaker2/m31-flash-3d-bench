// 게임 진행과 화면 연결. 반사 계산은 common/parts/optic3d.js 에 있고,
// 여기서는 상태를 들고 조작과 판정을 화면에 연결한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createLaserView } from "./laserView.js";
import { createHud } from "./hud.js";
import { createControls } from "./controls.js";
import {
  LEVELS,
  evaluateLevel,
  levelIndexById,
  levelPar,
  mirrorMap,
  traceLevel,
} from "./levels.js";
import { ORIENTATIONS, key, solveAll } from "../../common/parts/optic3d.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";
import { showEndingScreen } from "../../common/ending.js";

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const views = createViews(stage);
const view = createLaserView(stage.scene);
const badge = createInvariantBadge({ bottom: "120px" });

const progress = createProgress("laser", { levels: LEVELS });

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  orientations: new Map(),
  trace: null,
  phase: "play",
  resultShown: false,
  invariantProblems: [],
  invariantTimer: 0,
};

const hud = createHud({
  onReset: () => resetMirrors(),
  onLevels: () => openLevels(),
});

function refresh() {
  state.trace = traceLevel(state.level, state.orientations);
  view.setMirrors(state.orientations);
  view.setBeam(state.trace.path);
  const value = evaluateLevel(state.level, state.orientations);
  hud.setStats({
    reflections: state.trace.reflections,
    mirrors: state.level.mirrors.length,
    flipped: value.flipped,
    par: levelPar(state.level),
  });
  if (state.trace.reached) {
    hud.setMessage("빛이 목표에 닿았어요! 채점해 보세요.");
  } else if (state.trace.escaped) {
    hud.setMessage("빛이 밖으로 나가 버렸어요.", "bad");
  } else {
    hud.setMessage("빛이 빙글빙글 돌고 있어요.");
  }
}

function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.orientations = mirrorMap(state.level);
  state.phase = "play";
  state.resultShown = false;

  view.setLevel(state.level);
  stage.setFocus({ x: 0, y: 0.05, z: 0, radius: state.level.size * 0.3 });
  stage.resetView();

  hud.setLevel(state.level);
  refresh();
}

function resetMirrors() {
  state.orientations = mirrorMap(state.level);
  state.phase = "play";
  state.resultShown = false;
  refresh();
  hud.setMessage("거울을 처음 상태로 되돌렸습니다.");
}

function toggleMirror(cell) {
  if (!cell) return;
  const current = state.orientations.get(cell);
  if (!current) return;
  const index = ORIENTATIONS.indexOf(current);
  state.orientations.set(cell, ORIENTATIONS[(index + 1) % ORIENTATIONS.length]);
  state.phase = "play";
  state.resultShown = false;
  refresh();
}

function finishLevel() {
  const value = evaluateLevel(state.level, state.orientations);
  state.phase = "scored";
  state.resultShown = true;
  progress.record(state.level.id, { stars: value.stars, score: value.score });
  if (value.cleared && state.levelIndex + 1 >= LEVELS.length) {
    showEndingScreen({
      progress,
      levels: LEVELS,
      title: "마지막 반사까지 맞혔어요!",
      rows: [
        ["마지막 단계", state.level.label],
        ["빛이 꺾인 횟수", `${value.reflections} 번`],
        ["바꾼 거울", `${value.flipped} 개`],
      ],
      onFirst: () => gotoLevel(0),
      onLevels: openLevels,
    });
    return;
  }
  showResult({
    kicker: value.cleared ? "빛 도착" : "아직 못 닿았어요",
    title: state.level.label,
    stars: value.stars,
    score: value.score,
    rows: [
      ["빛이 꺾인 횟수", `${value.reflections} 번`],
      ["바꾼 거울", `${value.flipped} 개 (최소 ${value.par} 개)`],
    ],
    detail: value.cleared
      ? value.flipped <= value.par
        ? "가장 적은 거울을 움직여 맞췄어요!"
        : "빛이 닿았어요! 거울을 덜 움직이면 3성이에요."
      : "빛이 목표에 닿도록 거울 방향을 바꿔 보세요.",
    actions: resultOptions(),
  }).then((action) => {
    if (action === "next") gotoLevel(state.levelIndex + 1);
    if (action === "first") gotoLevel(0);
    if (action === "retry") resetMirrors();
    if (action === "levels") openLevels();
  });
}

function resultOptions() {
  // 마지막 단계는 엔딩 화면으로 넘어가므로 여기서는 항상 다음 단계가 있다.
  return [
    { id: "next", label: "다음 단계", primary: true, pulse: true },
    { id: "retry", label: "다시 하기" },
    { id: "levels", label: "레벨 선택" },
  ];
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
  targets: () => [...view.mirrors.values()],
  onPick: (data) => toggleMirror(key(data.col, data.row)),
  actions: {
    check: () => finishLevel(),
    reset: () => resetMirrors(),
    toggleMirror: () => {
      const first = state.level.mirrors[0];
      if (first) toggleMirror(key(first.col, first.row));
    },
  },
});

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  state.invariantProblems = checkInvariants({
    path: state.trace?.path ?? [],
    mirrors: view.mirrors,
    orientations: state.orientations,
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

/** 자동 검사용. 해답대로 거울을 놓는다. */
function solve() {
  const initial = mirrorMap(state.level);
  const found = solveAll({
    start: { col: state.level.emitter.col, row: state.level.emitter.row },
    direction: state.level.emitter.direction,
    mirrors: initial,
    size: state.level.size,
    target: state.level.target,
  });
  if (found.length > 0) {
    let best = found[0];
    let bestFlips = Infinity;
    for (const candidate of found) {
      let flips = 0;
      for (const [cell, orientation] of candidate) {
        if (initial.get(cell) !== orientation) flips += 1;
      }
      if (flips < bestFlips) {
        bestFlips = flips;
        best = candidate;
      }
    }
    state.orientations = best;
  }
  state.phase = "play";
  state.resultShown = false;
  refresh();
  finishLevel();
  return true;
}

window.__gameApi = {
  getState: () => {
    const value = evaluateLevel(state.level, state.orientations);
    return {
      level: state.level.id,
      phase: state.phase,
      reflections: state.trace?.reflections ?? 0,
      flipped: value.flipped,
      par: value.par,
      cleared: value.cleared,
      stars: value.stars,
    };
  },
  getInvariants: () => state.invariantProblems,
  getScreenPositions: () => {
    const entries = [];
    for (const [cell, mesh] of view.mirrors) {
      const projected = mesh.getWorldPosition(new THREE.Vector3()).project(stage.camera);
      entries.push({
        id: `mirror-${cell}`,
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
