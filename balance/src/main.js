// 게임 진행과 화면 연결. 역학 계산은 common/parts/balance3d.js 에 있고,
// 여기서는 상태를 들고 조작과 판정을 화면에 연결한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createBalanceView } from "./balanceView.js";
import { createHud } from "./hud.js";
import { createControls } from "./controls.js";
import {
  LEVELS,
  evaluateLevel,
  levelGeometry,
  levelIndexById,
  missionText,
} from "./levels.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const views = createViews(stage);
const view = createBalanceView(stage.scene);
const badge = createInvariantBadge({ bottom: "150px" });

const progress = createProgress("balance", { levels: LEVELS });

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  geometry: null,
  placement: [],
  selectedMass: 1,
  phase: "play",
  resultShown: false,
  invariantProblems: [],
  invariantTimer: 0,
};

const hud = createHud({
  onMass: (mass) => selectMass(mass),
  onScore: () => finishLevel(),
  onClear: () => clearWeights(),
  onLevels: () => openLevels(),
});

function selectMass(mass) {
  state.selectedMass = mass;
  hud.setSelectedMass(mass);
}

function result() {
  return evaluateLevel(state.level, state.placement);
}

function refreshHud() {
  const value = result();
  hud.setStats({
    angle: value.angle,
    totalMass: value.totalMass,
    targetMass: state.level.targetMass,
    count: value.used,
    par: state.level.par,
    level: value.level,
  });
}

function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.geometry = levelGeometry(state.level);
  state.placement = [];
  state.phase = "play";
  state.resultShown = false;
  state.selectedMass = state.level.masses[0];

  view.setGeometry(state.geometry);
  view.setWeights(state.placement);
  view.setAngle(0);
  view.setCenter(state.geometry.fulcrumX);

  stage.setFocus({ x: state.geometry.fulcrumX, y: 0.13, z: 0, radius: 0.62 });
  stage.resetView();

  hud.setLevel(state.level);
  hud.setPalette(state.level.masses, state.selectedMass);
  hud.setMessage(missionText(state.level));
  refreshHud();
}

function place(slotId) {
  if (!slotId || !state.geometry) return;
  if (slotId === `s${state.geometry.fulcrumSlot}`) {
    showToast("받침대 위에는 올릴 수 없어요.", "bad");
    return;
  }
  const existing = state.placement.findIndex((item) => item.slot === slotId);
  if (existing >= 0) {
    state.placement = state.placement.filter((item) => item.slot !== slotId);
  } else {
    state.placement = [...state.placement, { slot: slotId, mass: state.selectedMass }];
  }
  state.phase = "play";
  state.resultShown = false;
  applyState();
  hud.setMessage(existing >= 0 ? "추를 뺐습니다." : "추를 올렸습니다.");
}

function clearWeights() {
  if (state.placement.length === 0) return;
  state.placement = [];
  state.phase = "play";
  state.resultShown = false;
  applyState();
  hud.setMessage("추를 모두 뺐습니다.");
}

function applyState() {
  const value = result();
  view.setWeights(state.placement);
  view.setAngle(value.angle);
  view.setCenter(value.center);
  refreshHud();
}

function resultOptions() {
  const hasNext = state.levelIndex + 1 < LEVELS.length;
  return hasNext
    ? [
        { id: "next", label: "다음 단계", primary: true, pulse: true },
        { id: "retry", label: "다시 하기" },
        { id: "levels", label: "레벨 선택" },
      ]
    : [
        { id: "first", label: "처음부터", primary: true, pulse: true },
        { id: "retry", label: "다시 하기" },
        { id: "levels", label: "레벨 선택" },
      ];
}

function showResultPanel(value) {
  showResult({
    kicker: value.cleared ? "균형 완성" : "아직 기울어져 있어요",
    title: state.level.label,
    stars: value.stars,
    score: value.score,
    rows: [
      ["기울기", `${((value.angle * 180) / Math.PI).toFixed(2)}°`],
      ["무게", `${value.totalMass}kg (목표 ${state.level.targetMass}kg)`],
      ["올린 추", `${value.used} 개 (최소 ${value.par} 개)`],
    ],
    detail: value.cleared
      ? value.used <= value.par
        ? "수평이고 무게도 맞아요. 다음 단계로 넘어가세요."
        : "수평이에요! 추를 더 적게 쓰면 3성이 됩니다."
      : "무게중심이 받침대 위에 오도록 추를 옮겨 보세요.",
    actions: resultOptions(),
  }).then((action) => {
    if (action === "next") gotoLevel(state.levelIndex + 1);
    if (action === "first") gotoLevel(0);
    if (action === "retry") clearWeights();
    if (action === "levels") openLevels();
  });
}

function finishLevel() {
  const value = result();
  state.phase = "scored";
  state.resultShown = true;
  progress.record(state.level.id, { stars: value.stars, score: value.score });
  showResultPanel(value);
}

function checkMission() {
  if (state.resultShown) return;
  const value = result();
  if (!value.cleared) return;
  state.resultShown = true;
  state.phase = "scored";
  progress.record(state.level.id, { stars: value.stars, score: value.score });
  showResultPanel(value);
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
  targets: () => [...view.weights.values()],
  onPick: (slotId) => place(slotId),
  actions: {
    score: () => finishLevel(),
    reset: () => clearWeights(),
    pickIndex: (index) => {
      const mass = state.level.masses[index];
      if (mass) selectMass(mass);
    },
  },
});

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  const value = result();
  state.invariantProblems = checkInvariants({
    geometry: state.geometry,
    placement: state.placement,
    viewAngle: view.angle,
    computedAngle: value.angle,
    count: state.placement.length,
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

/** 자동 검사용. 기준 해법으로 놓는다. */
function solve() {
  state.placement = state.level.reference.map((item) => ({ ...item }));
  state.phase = "play";
  state.resultShown = false;
  applyState();
  hud.setMessage("기준 해법으로 올렸습니다.");
  checkMission();
  return true;
}

window.__gameApi = {
  getState: () => {
    const value = result();
    return {
      level: state.level.id,
      phase: state.phase,
      angle: Number(value.angle.toFixed(9)),
      totalMass: value.totalMass,
      targetMass: state.level.targetMass,
      count: value.used,
      par: value.par,
      cleared: value.cleared,
      stars: value.stars,
    };
  },
  getInvariants: () => state.invariantProblems,
  getScreenPositions: () => {
    const entries = [];
    for (const [slotId, mesh] of view.weights) {
      const projected = mesh.getWorldPosition(new THREE.Vector3()).project(stage.camera);
      entries.push({
        id: `weight-${slotId}`,
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
