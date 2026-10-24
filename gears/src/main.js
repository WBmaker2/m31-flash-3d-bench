// 게임 진행과 화면 연결. 기어 계산은 common/parts/gear3d.js 에 있고,
// 여기서는 상태를 들고 조작과 판정을 화면에 연결한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createGearsView } from "./gearsView.js";
import { createHud } from "./hud.js";
import { createControls } from "./controls.js";
import {
  LEVELS,
  buildNodes,
  canPlace,
  evaluateMission,
  levelIndexById,
  missionText,
} from "./levels.js";
import { INPUT_REV_PER_SEC, gearAngles, phaseOffsets, propagateRotation } from "../../common/parts/gear3d.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const views = createViews(stage);
const view = createGearsView(stage.scene);
const badge = createInvariantBadge({ bottom: "150px" });

const progress = createProgress("gears", { levels: LEVELS });

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  assignment: [],
  selectedTeeth: 8,
  elapsed: 0,
  phase: "play",
  resultShown: false,
  nodes: [],
  graph: new Map(),
  offsets: new Map(),
  ratio: new Map(),
  omega: new Map(),
  conflicts: [],
  angles: new Map(),
  previousAngles: null,
  invariantProblems: [],
  invariantTimer: 0,
};

const hud = createHud({
  onSize: (teeth) => selectSize(teeth),
  onScore: () => finishLevel(),
  onClear: () => clearGears(),
  onLevels: () => openLevels(),
});

function selectSize(teeth) {
  state.selectedTeeth = teeth;
  hud.setSelectedSize(teeth);
}

function rebuild() {
  state.nodes = buildNodes(state.level, state.assignment);
  const { ratio, omega, graph, conflicts } = propagateRotation({
    nodes: state.nodes,
    inputId: state.level.crank.slot,
    inputOmega: INPUT_REV_PER_SEC,
  });
  state.ratio = ratio;
  state.omega = omega;
  state.graph = graph;
  state.conflicts = conflicts;
  state.offsets = phaseOffsets(state.nodes, graph, state.level.crank.slot);
  state.previousAngles = null;
  view.setAssignment(state.level, state.assignment);
  view.setConflict(conflicts.length > 0);
  updateAngles();
  refreshHud();
}

function updateAngles() {
  state.angles = gearAngles(state.ratio, INPUT_REV_PER_SEC, state.elapsed, state.offsets);
  view.updateAngles(state.angles);
}

function missionResult() {
  return evaluateMission(state.level, state.assignment);
}

function refreshHud() {
  const result = missionResult();
  hud.setStats({
    speed: result.speed,
    target: state.level.mission.revPerSec,
    direction: result.direction,
    directionOk: result.directionOk,
    used: result.used,
    par: state.level.par,
  });
  view.setMissionHighlight(result.cleared);
}

function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.assignment = [];
  state.elapsed = 0;
  state.phase = "play";
  state.resultShown = false;
  state.selectedTeeth = state.level.palette[0];

  view.setLevel(state.level);
  stage.setFocus(view.bounds);
  stage.resetView();

  hud.setLevel(state.level);
  hud.setPalette(state.level.palette, state.selectedTeeth);
  hud.setMessage(missionText(state.level));
  rebuild();
}

function place(slotId) {
  if (slotId === state.level.crank.slot) {
    showToast("크랭크 톱니바퀴는 고정되어 있어요.", "bad");
    return;
  }
  if (state.assignment.some((item) => item.slot === slotId)) {
    remove(slotId);
    return;
  }
  if (!canPlace(state.level, state.assignment, slotId, state.selectedTeeth)) {
    showToast("그 크기론 저 칸에 들어가지 않아요.", "bad");
    return;
  }
  state.assignment = [...state.assignment, { slot: slotId, teeth: state.selectedTeeth }];
  state.phase = "play";
  state.resultShown = false;
  rebuild();
  hud.setMessage(`${state.selectedTeeth}톱니 톱니바퀴를 끼웠습니다.`);
  checkMission();
}

function remove(slotId) {
  const before = state.assignment.length;
  state.assignment = state.assignment.filter((item) => item.slot !== slotId);
  if (state.assignment.length === before) return;
  state.phase = "play";
  state.resultShown = false;
  rebuild();
  hud.setMessage("톱니바퀴를 뺐습니다.");
}

function clearGears() {
  if (state.assignment.length === 0) return;
  state.assignment = [];
  state.phase = "play";
  state.resultShown = false;
  rebuild();
  hud.setMessage("톱니바퀴를 모두 뺐습니다.");
}

function resultOptions(result) {
  const hasNext = state.levelIndex + 1 < LEVELS.length;
  return hasNext
    ? [
        { id: "next", label: "다음 단계", primary: true, pulse: true },
        { id: "retry", label: "다시 배치" },
        { id: "levels", label: "레벨 선택" },
      ]
    : [
        { id: "first", label: "처음부터", primary: true, pulse: true },
        { id: "retry", label: "다시 배치" },
        { id: "levels", label: "레벨 선택" },
      ];
}

function showResultPanel(result) {
  showResult({
    kicker: result.cleared ? "미션 성공" : "아직 멀었어요",
    title: state.level.label,
    stars: result.stars,
    score: result.score,
    rows: [
      ["미션 톱니바퀴", `${result.speed.toFixed(2)} 바퀴/초 (목표 ${state.level.mission.revPerSec})`],
      ["회전 방향", result.direction === "same" ? "크랭크와 같음" : result.direction === "opposite" ? "크랭크와 반대" : "멈춤"],
      ["사용한 톱니바퀴", `${result.used} / ${state.level.par}`],
    ],
    detail: result.cleared
      ? result.used <= state.level.par
        ? "미션에 맞췄고 기어도 아꼈어요. 다음 단계로 넘어가세요."
        : "미션에 맞췄어요. 톱니바퀴를 더 적게 쓰면 3성이 됩니다."
      : "미션 조건을 다시 읽고 톱니바퀴 크기를 바꿔 보세요.",
    actions: resultOptions(result),
  }).then((action) => {
    if (action === "next") gotoLevel(state.levelIndex + 1);
    if (action === "first") gotoLevel(0);
    if (action === "retry") clearGears();
    if (action === "levels") openLevels();
  });
}

function finishLevel() {
  const result = missionResult();
  state.phase = "scored";
  state.resultShown = true;
  progress.record(state.level.id, { stars: result.stars, score: result.score });
  showResultPanel(result);
}

function checkMission() {
  if (state.resultShown) return;
  const result = missionResult();
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
      const index = levelIndexById(result.levelId);
      loadLevel(index);
    }
  });
}

createControls({
  canvas,
  camera: stage.camera,
  orbit: stage.controls,
  gearTargets: () => view.gearObjects(),
  slotTargets: () => view.markerObjects(),
  onPlace: (slotId) => place(slotId),
  onRemove: (slotId) => remove(slotId),
  actions: {
    score: () => finishLevel(),
    reset: () => clearGears(),
    pickIndex: (index) => {
      const teeth = state.level.palette[index];
      if (teeth) selectSize(teeth);
    },
  },
});

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  state.invariantProblems = checkInvariants({
    nodes: state.nodes,
    angles: state.angles,
    previousAngles: state.previousAngles,
    conflicts: state.conflicts,
  });
  badge.show(state.invariantProblems);
  if (state.invariantProblems.length > 0) {
    console.error(
      `[불변식 위반] ${state.invariantProblems.map((problem) => problem.message).join(" | ")}`,
    );
  }
  state.previousAngles = new Map(state.angles);
}

stage.start((delta) => {
  state.elapsed += delta;
  updateAngles();
  updateInvariants(delta);
});

loadLevel(0);

/** 자동 검사용. 기준 해법으로 배치한다. */
function solve() {
  state.assignment = state.level.reference.map((item) => ({ ...item }));
  state.phase = "play";
  state.resultShown = false;
  rebuild();
  hud.setMessage("기준 해법으로 배치했습니다.");
  checkMission();
  return true;
}

window.__gameApi = {
  getState: () => {
    const result = missionResult();
    return {
      level: state.level.id,
      phase: state.phase,
      speed: Number(result.speed.toFixed(3)),
      target: state.level.mission.revPerSec,
      direction: result.direction,
      used: result.used,
      par: state.level.par,
      cleared: result.cleared,
      stars: result.stars,
    };
  },
  getInvariants: () => state.invariantProblems,
  getScreenPositions: () => {
    const entries = [];
    for (const node of state.nodes) {
      const projected = new THREE.Vector3(node.x, 0.02, node.z).project(stage.camera);
      entries.push({
        id: `gear-${node.id}`,
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
