// 게임 진행과 화면 연결. 선로 계산은 common/parts/rail3d.js 에 있고,
// 여기서는 상태를 들고 조작과 판정을 화면에 연결한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createRailView } from "./railView.js";
import { createHud } from "./hud.js";
import { createControls } from "./controls.js";
import { LEVELS, evaluateLevel, findLevelPath, levelIndexById, levelPar } from "./levels.js";
import { cellKey } from "../../common/parts/rail3d.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";
import { showEndingScreen } from "../../common/ending.js";

const CELL = 0.42;

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const views = createViews(stage);
const view = createRailView(stage.scene);
const badge = createInvariantBadge({ bottom: "120px" });

const progress = createProgress("rail", { levels: LEVELS });

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  placement: [],
  kind: "straight",
  path: null,
  trainProgress: 0,
  running: false,
  phase: "play",
  resultShown: false,
  invariantProblems: [],
  invariantTimer: 0,
};

const hud = createHud({
  onKind: (kind) => selectKind(kind),
  onLevels: () => openLevels(),
});

function selectKind(kind) {
  state.kind = kind;
  hud.setKind(kind);
}

function refresh() {
  view.setPieces(state.placement);
  state.path = findLevelPath(state.level, state.placement);
  const value = evaluateLevel(state.level, state.placement);
  hud.setStats({
    placed: value.placed,
    par: value.par,
    result: state.path ? "길이 열렸어요" : "아직 끊겼어요",
  });
  if (state.path && !state.running) {
    state.running = true;
    state.trainProgress = 0;
    hud.setMessage("기차가 달려요!");
  } else if (!state.path) {
    state.running = false;
    view.setTrain(null, 0);
  }
}

function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.placement = [];
  state.path = null;
  state.trainProgress = 0;
  state.running = false;
  state.phase = "play";
  state.resultShown = false;
  state.kind = "straight";

  view.setLevel(state.level);
  view.setPieces(state.placement);
  view.setTrain(null, 0);
  stage.setFocus({ x: 0, y: 0.05, z: 0, radius: state.level.size * 0.24 });
  stage.resetView();

  hud.setLevel(state.level);
  hud.setKind(state.kind);
  hud.setMessage("빈 칸을 눌러 선로를 놓고 방향을 정해 주세요.");
  refresh();
}

function cellAt(x, z) {
  const offset = (state.level.size - 1) / 2;
  const col = Math.round(x / CELL + offset);
  const row = Math.round(z / CELL + offset);
  if (col < 0 || row < 0 || col >= state.level.size || row >= state.level.size) return null;
  return { col, row };
}

function pick(x, z) {
  const cell = cellAt(x, z);
  if (!cell) return;
  const key = cellKey(cell.col, cell.row);
  const index = state.placement.findIndex((item) => item && cellKey(item.col, item.row) === key);
  const maxOrientation = state.kind === "straight" ? 1 : 3;
  if (index < 0) {
    state.placement.push({ col: cell.col, row: cell.row, kind: state.kind, orientation: 0 });
  } else if (state.placement[index].orientation < maxOrientation) {
    state.placement[index] = {
      ...state.placement[index],
      kind: state.kind,
      orientation: state.placement[index].orientation + 1,
    };
  } else {
    state.placement[index] = null;
  }
  state.phase = "play";
  state.resultShown = false;
  refresh();
}

function resetPieces() {
  state.placement = [];
  state.path = null;
  state.running = false;
  state.trainProgress = 0;
  state.phase = "play";
  state.resultShown = false;
  view.setPieces(state.placement);
  view.setTrain(null, 0);
  refresh();
  hud.setMessage("선로를 모두 뺐습니다.");
}

function finishLevel() {
  const value = evaluateLevel(state.level, state.placement);
  state.phase = "scored";
  state.resultShown = true;
  progress.record(state.level.id, { stars: value.stars, score: value.score });
  if (value.cleared && state.levelIndex + 1 >= LEVELS.length) {
    showEndingScreen({
      progress,
      levels: LEVELS,
      title: "마지막 선로까지 완성했어요!",
      rows: [
        ["마지막 단계", state.level.label],
        ["놓은 선로", `${value.placed} 개`],
        ["기차 길", value.path ? `${value.path.length} 칸` : "없음"],
      ],
      onFirst: () => gotoLevel(0),
      onLevels: openLevels,
    });
    return;
  }
  showResult({
    kicker: value.cleared ? "길 완성" : "길이 끊겼어요",
    title: state.level.label,
    stars: value.stars,
    score: value.score,
    rows: [
      ["놓은 선로", `${value.placed} 개 (최소 ${value.par} 개)`],
      ["기차 길", value.path ? `${value.path.length} 칸` : "없음"],
    ],
    detail: value.cleared
      ? value.placed <= value.par
        ? "최소한의 선로로 완성했어요!"
        : "기차가 도착했어요! 선로를 덜 놓으면 3성이에요."
      : "역과 역을 선로로 이어 보세요.",
    actions: resultOptions(),
  }).then((action) => {
    if (action === "next") gotoLevel(state.levelIndex + 1);
    if (action === "first") gotoLevel(0);
    if (action === "retry") resetPieces();
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
  orbit: stage.controls,
  targets: () => [],
  onPick: (x, z) => pick(x, z),
  actions: {
    check: () => finishLevel(),
    reset: () => resetPieces(),
  },
});

function updateTrain(delta) {
  if (!state.running || !state.path) return;
  state.trainProgress = Math.min(1, state.trainProgress + delta * 0.55);
  view.setTrain(state.path, state.trainProgress);
  if (state.trainProgress >= 1) {
    state.running = false;
    if (!state.resultShown) finishLevel();
  }
}

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  state.invariantProblems = checkInvariants({
    placement: state.placement,
    grid: state.placement,
    path: state.path,
    trainProgress: state.trainProgress,
  });
  badge.show(state.invariantProblems);
  if (state.invariantProblems.length > 0) {
    console.error(
      `[불변식 위반] ${state.invariantProblems.map((problem) => problem.message).join(" | ")}`,
    );
  }
}

stage.start((delta) => {
  updateTrain(delta);
  updateInvariants(delta);
});

loadLevel(0);

/** 자동 검사용. 기준 해법으로 선로를 놓는다. */
function solve() {
  const level = state.level;
  const placement = [];
  const offset = (level.size - 1) / 2;
  const route = [];
  // 시작에서 도착까지 직선으로 이어 놓는 최소 해법(세로 우선).
  let { col, row } = level.start;
  route.push({ col, row });
  while (col !== level.goal.col || row !== level.goal.row) {
    if (col !== level.goal.col) col += Math.sign(level.goal.col - col);
    else row += Math.sign(level.goal.row - row);
    route.push({ col, row });
  }
  for (const cell of route) {
    const key = cellKey(cell.col, cell.row);
    if ((level.fixed ?? []).some((piece) => cellKey(piece.col, piece.row) === key)) continue;
    const prev = route[route.indexOf(cell) - 1] ?? route[0];
    const next = route[route.indexOf(cell) + 1];
    let orientation = 0;
    if (next) {
      const dx = next.col - cell.col;
      const dz = next.row - cell.row;
      orientation = dx !== 0 ? 1 : 0;
      if (dx === 0 && dz !== 0) orientation = 0;
    }
    placement.push({ col: cell.col, row: cell.row, kind: "straight", orientation });
  }
  state.placement = placement;
  state.phase = "play";
  state.resultShown = false;
  refresh();
  hud.setMessage("기준 해법으로 선로를 놓았습니다.");
  return true;
}

window.__gameApi = {
  getState: () => {
    const value = evaluateLevel(state.level, state.placement);
    return {
      level: state.level.id,
      phase: state.phase,
      placed: value.placed,
      par: value.par,
      pathLength: state.path?.length ?? 0,
      cleared: value.cleared,
      stars: value.stars,
    };
  },
  getInvariants: () => state.invariantProblems,
  getScreenPositions: () => {
    const entries = [];
    const projected = view.train.position.clone().setY(0.14).project(stage.camera);
    entries.push({
      id: "train",
      x: projected.x,
      y: projected.y,
      visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
    });
    return entries;
  },
  setView: (name) => views.setView(name),
  setChrome: () => {},
  solve,
  loadLevel,
  levelIndex: () => state.levelIndex,
};
