// 게임 진행과 화면 연결. 조각 규칙은 sdf.js·mesh.js·levels.js 에 있고,
// 여기서는 상태를 들고 조작과 채점을 화면에 연결한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createSculptView, restingHeight } from "./sculptView.js";
import { createHud } from "./hud.js";
import { createControls } from "./controls.js";
import {
  LEVELS,
  evaluateSculpt,
  levelIndexById,
  levelPar,
  scoreForSculpt,
} from "./levels.js";
import { BOUNDS, KIND_LABELS, makeSdf, silhouetteIou } from "./sdf.js";
import { DEFAULT_RESOLUTION, PREVIEW_RESOLUTION, extractSurface } from "./mesh.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";
import { showEndingScreen } from "../../common/ending.js";

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const views = createViews(stage);
const view = createSculptView(stage.scene);
const badge = createInvariantBadge({ bottom: "150px" });

const progress = createProgress("sculpt", { levels: LEVELS });

const SCORE_DELAY = 0.15;
const DRAG_RESOLUTION = 40;
const IDLE_RESOLUTION = 80;

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  elements: [],
  selectedIndex: -1,
  kind: "sphere",
  op: "union",
  iou: 0,
  volumeRatio: 0,
  score: 0,
  phase: "play",
  ghostVisible: true,
  undoStack: [],
  nextId: 1,
  targetVolume: 0,
  resultVolume: 0,
  resultVertices: 0,
  ghostVertices: 0,
  meshDirty: true,
  scoreDirty: true,
  scoreTimer: 0,
  dragging: false,
  invariantProblems: [],
  invariantTimer: 0,
};

const hud = createHud({
  onKind: (kind) => setKind(kind),
  onOp: (op) => setOp(op),
  onScore: () => finishLevel(),
  onClear: () => clearParts(),
  onDelete: () => deleteSelected(),
  onLevels: () => openLevels(),
});

function defaultParams(kind) {
  switch (kind) {
    case "box":
      return { hx: 0.42, hy: 0.42, hz: 0.42 };
    case "torus":
      return { R: 0.6, r: 0.24 };
    case "capsule":
      return { r: 0.3, h: 0.62 };
    default:
      return { r: 0.5 };
  }
}

function makeElement(kind, op, x, z) {
  const params = defaultParams(kind);
  const element = {
    id: state.nextId++,
    kind,
    op,
    position: { x, y: 0, z },
    rotationY: 0,
    params,
  };
  element.position.y = restingHeight(element);
  return element;
}

function pushUndo() {
  state.undoStack.push(state.elements.map((element) => ({
    ...element,
    position: { ...element.position },
    params: { ...element.params },
  })));
  if (state.undoStack.length > 40) state.undoStack.shift();
}

function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.elements = [];
  state.selectedIndex = -1;
  state.undoStack = [];
  state.phase = "play";
  state.iou = 0;
  state.volumeRatio = 0;
  state.score = 0;
  state.resultVolume = 0;
  state.resultVertices = 0;
  state.ghostVertices = 0;
  state.meshDirty = true;
  state.scoreDirty = true;

  const targetSurface = extractSurface(makeSdf(state.level.target.elements), {
    resolution: DEFAULT_RESOLUTION,
  });
  view.setGhost(targetSurface);
  state.ghostVertices = targetSurface.positions.length / 3;
  state.targetVolume = targetSurface.volume;

  stage.resetView();

  hud.setLevel(state.level);
  hud.setMessage("팔레트에서 기본형을 고르고 작업대를 눌러 놓으세요.");
  refreshHud();
}

function refreshHud() {
  hud.setTool({
    kind: state.kind,
    op: state.op,
    selected: state.selectedIndex,
    partCount: state.elements.length,
    maxParts: state.level.maxParts,
  });
  hud.setStats({
    iou: state.iou,
    target: levelPar(state.level),
    volumeRatio: state.volumeRatio,
    partCount: state.elements.length,
    maxParts: state.level.maxParts,
  });
}

function setKind(kind) {
  state.kind = kind;
  refreshHud();
}

function setOp(op) {
  state.op = op;
  refreshHud();
}

function markDirty() {
  state.meshDirty = true;
  state.scoreDirty = true;
  state.scoreTimer = 0;
  // 다시 고치는 순간 채점 결과는 무효가 된다.
  if (state.phase === "scored") state.phase = "play";
}

function rebuildMesh(resolution) {
  if (state.elements.length === 0) {
    const empty = {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      indices: new Uint32Array(0),
      volume: 0,
      triangles: 0,
    };
    view.setResult(empty);
    state.resultVolume = 0;
    state.resultVertices = 0;
  } else {
    const surface = extractSurface(makeSdf(state.elements), { resolution });
    view.setResult(surface);
    state.resultVolume = surface.volume;
    state.resultVertices = surface.positions.length / 3;
  }
  view.setParts(state.elements, state.selectedIndex);
}

function recomputeScore(resolution) {
  if (state.elements.length === 0) {
    state.iou = 0;
    state.volumeRatio = 0;
    state.score = 0;
    refreshHud();
    return;
  }
  const player = makeSdf(state.elements);
  const target = makeSdf(state.level.target.elements);
  state.iou = silhouetteIou(player, target, { resolution });
  state.volumeRatio = state.targetVolume > 0 ? state.resultVolume / state.targetVolume : 0;
  state.score = scoreForSculpt({ iou: state.iou, volumeRatio: state.volumeRatio });
  refreshHud();
}

function clearParts() {
  if (state.elements.length === 0) return;
  pushUndo();
  state.elements = [];
  state.selectedIndex = -1;
  markDirty();
  hud.setMessage("부품을 모두 지웠습니다.");
}

function deleteSelected() {
  if (state.selectedIndex < 0) return;
  pushUndo();
  state.elements.splice(state.selectedIndex, 1);
  state.selectedIndex = -1;
  markDirty();
}

function undo() {
  const snapshot = state.undoStack.pop();
  if (!snapshot) return;
  state.elements = snapshot;
  state.selectedIndex = -1;
  markDirty();
  hud.setMessage("한 걸음 되돌렸습니다.");
}

function scaleSelected(factor) {
  const element = state.elements[state.selectedIndex];
  if (!element) return;
  pushUndo();
  const params = element.params;
  if (element.kind === "sphere") params.r = Math.min(1.2, Math.max(0.12, params.r * factor));
  if (element.kind === "box") {
    params.hx = Math.min(1.2, Math.max(0.12, params.hx * factor));
    params.hy = Math.min(1.2, Math.max(0.12, params.hy * factor));
    params.hz = Math.min(1.2, Math.max(0.12, params.hz * factor));
  }
  if (element.kind === "torus") {
    params.R = Math.min(1.3, Math.max(0.2, params.R * factor));
    params.r = Math.min(0.6, Math.max(0.08, params.r * factor));
  }
  if (element.kind === "capsule") {
    params.r = Math.min(0.9, Math.max(0.1, params.r * factor));
    params.h = Math.min(1.4, Math.max(0.1, params.h * factor));
  }
  element.position.y = restingHeight(element);
  markDirty();
}

function rotateSelected(delta) {
  const element = state.elements[state.selectedIndex];
  if (!element) return;
  pushUndo();
  element.rotationY = (element.rotationY + delta) % (Math.PI * 2);
  markDirty();
}

function finishLevel() {
  // 채점해도 작업을 버리지 않는다. 다시 고쳐서 다시 채점할 수 있다.
  state.phase = "scored";
  recomputeScore(IDLE_RESOLUTION);
  const result = evaluateSculpt(
    { iou: state.iou, volumeRatio: state.volumeRatio },
    state.level,
  );
  const par = levelPar(state.level);
  progress.record(state.level.id, { stars: result.stars, score: state.score });

  const hasNext = state.levelIndex + 1 < LEVELS.length;

  if (result.cleared && !hasNext) {
    showEndingScreen({
      progress,
      levels: LEVELS,
      title: "마지막 조각까지 완성했어요!",
      rows: [
        ["마지막 단계", state.level.label],
        ["실루엣 일치도", `${state.iou.toFixed(3)}`],
        ["사용한 부품", `${state.elements.length} 개`],
      ],
      onFirst: () => gotoLevel(0),
      onLevels: openLevels,
    });
    refreshHud();
    return;
  }

  const actions = [
    { id: "next", label: "다음 단계", primary: true, pulse: true },
    { id: "retry", label: "다시 만들기" },
    { id: "levels", label: "레벨 선택" },
  ];

  showResult({
    kicker: result.cleared ? "조각 완성" : "아직 다듬어야 해요",
    title: state.level.label,
    stars: result.stars,
    score: state.score,
    rows: [
      ["실루엣 일치도", `${state.iou.toFixed(3)} (목표 ${par.toFixed(2)})`],
      ["부피", `${Math.round(state.volumeRatio * 100)}% (목표 100%)`],
      ["사용한 부품", `${state.elements.length} / ${state.level.maxParts}`],
    ],
    detail: result.cleared
      ? "고스트와 형태가 닮았습니다. 다음 단계로 넘어가세요."
      : "일치도를 올리려면 크기와 위치를 조금씩 바꿔 보세요.",
    actions,
  }).then((action) => {
    if (action === "next") gotoLevel(state.levelIndex + 1);
    if (action === "first") gotoLevel(0);
    if (action === "retry") clearParts();
    if (action === "levels") openLevels();
  });
  refreshHud();
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
      const index = levelIndexById(result.levelId);
      loadLevel(index);
    }
  });
}

// ── 입력 연결 ──────────────────────────────────────────────────
function selectPart(index) {
  state.selectedIndex = index;
  state.dragging = true;
  pushUndo();
  refreshHud();
}

function movePart(index, point) {
  const element = state.elements[index];
  if (!element) return;
  element.position.x = Math.max(-BOUNDS, Math.min(BOUNDS, point.x));
  element.position.z = Math.max(-BOUNDS, Math.min(BOUNDS, point.z));
  element.position.y = restingHeight(element);
  markDirty();
}

function addPart(x, z) {
  if (state.elements.length >= state.level.maxParts) {
    showToast(`이 레벨은 부품 ${state.level.maxParts} 개까지 쓸 수 있습니다.`, "bad");
    return;
  }
  pushUndo();
  state.elements.push(makeElement(state.kind, state.op, x, z));
  state.selectedIndex = state.elements.length - 1;
  markDirty();
  hud.setMessage(`${KIND_LABELS[state.kind]} 부품을 놓았습니다. 크기와 위치를 다듬어 보세요.`);
}

createControls({
  canvas,
  camera: stage.camera,
  orbit: stage.controls,
  pickTargets: () => view.partGroup.children,
  onSelect: selectPart,
  onAdd: addPart,
  onMove: movePart,
  onDragEnd: () => {
    state.dragging = false;
    state.meshDirty = true;
  },
  actions: {
    setKind,
    setOp,
    rotate: rotateSelected,
    scale: scaleSelected,
    remove: deleteSelected,
    undo,
    reset: () => loadLevel(state.levelIndex),
    toggleGhost: () => {
      state.ghostVisible = !state.ghostVisible;
      view.setGhostVisible(state.ghostVisible);
      hud.setMessage(state.ghostVisible ? "목표 고스트를 켰습니다." : "목표 고스트를 숨겼습니다.");
    },
    score: finishLevel,
  },
});

// ── 루프 ─────────────────────────────────────────────────────
function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  state.invariantProblems = checkInvariants({
    elements: state.elements,
    maxParts: state.level.maxParts,
    resultVolume: state.resultVolume,
    resultVertices: state.elements.length === 0 ? 1 : state.resultVertices,
    ghostVertices: state.ghostVertices,
    iou: state.iou,
    volumeRatio: state.volumeRatio,
  });
  badge.show(state.invariantProblems);
  if (state.invariantProblems.length > 0) {
    console.error(`[불변식 위반] ${state.invariantProblems.map((problem) => problem.message).join(" | ")}`);
  }
}

stage.start((delta) => {
  if (state.meshDirty) {
    state.meshDirty = false;
    rebuildMesh(state.dragging ? PREVIEW_RESOLUTION : DEFAULT_RESOLUTION);
  }
  if (state.scoreDirty) {
    state.scoreTimer += delta;
    if (state.scoreTimer >= SCORE_DELAY) {
      state.scoreDirty = false;
      state.scoreTimer = 0;
      recomputeScore(state.dragging ? DRAG_RESOLUTION : IDLE_RESOLUTION);
    }
  }
  updateInvariants(delta);
});

loadLevel(0);

/** 자동 검사용. 기준 해법을 부품으로 놓는다. */
function solve() {
  state.elements = state.level.reference.elements.map((element) => ({
    ...element,
    id: state.nextId++,
    position: { ...element.position },
    params: { ...element.params },
  }));
  state.selectedIndex = -1;
  state.undoStack = [];
  markDirty();
  state.meshDirty = true;
  hud.setMessage("기준 해법으로 조각했습니다. 채점해 보세요.");
  return true;
}

window.__gameApi = {
  getState: () => ({
    level: state.level.id,
    phase: state.phase,
    iou: Number(state.iou.toFixed(3)),
    target: Number(levelPar(state.level).toFixed(3)),
    volumeRatio: Number(state.volumeRatio.toFixed(3)),
    parts: state.elements.length,
    maxParts: state.level.maxParts,
    score: state.score,
    scored: state.phase === "scored",
  }),
  getInvariants: () => state.invariantProblems,
  getScreenPositions: () => {
    const entries = [];
    const push = (id, point) => {
      const projected = point.clone().project(stage.camera);
      entries.push({
        id,
        x: projected.x,
        y: projected.y,
        visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
      });
    };
    state.elements.forEach((element, index) => {
      push(`part-${index}`, new THREE.Vector3(element.position.x, element.position.y, element.position.z));
    });
    return entries;
  },
  setView: (name) => views.setView(name),
  // 이 게임에는 텍스트 라벨이 없다. 카드 촬영에서 숨길 것이 없다.
  setChrome: () => {},
  solve,
  loadLevel,
  levelIndex: () => state.levelIndex,
};
