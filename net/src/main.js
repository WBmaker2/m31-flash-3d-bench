// 게임 진행과 화면 연결. 접기 계산은 common/parts/net3d.js 에 있고,
// 여기서는 상태를 들고 조작과 판정을 화면에 연결한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createNetView } from "./netView.js";
import { createHud } from "./hud.js";
import { createControls } from "./controls.js";
import { LEVELS, evaluateLevel, levelIndexById, levelOptions } from "./levels.js";
import { NETS } from "../../common/parts/net3d.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";
import { showEndingScreen } from "../../common/ending.js";

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const views = createViews(stage);
const view = createNetView(stage.scene);
const badge = createInvariantBadge({ bottom: "120px" });

const progress = createProgress("net", { levels: LEVELS });

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  options: [],
  picked: null,
  phase: "play",
  resultShown: false,
  invariantProblems: [],
  invariantTimer: 0,
};

const hud = createHud({
  onLevels: () => openLevels(),
});

function refresh() {
  view.setTarget(state.level.target);
  view.setOptions({ cells: NETS[state.level.net], options: state.options });
  view.highlight(state.picked);
  hud.setStats({
    option: state.picked === null ? 0 : state.picked + 1,
    result: state.picked === null ? "아직 안 골랐어요" : state.resultText,
  });
}

function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.options = levelOptions(state.level);
  state.picked = null;
  state.resultText = "-";
  state.phase = "play";
  state.resultShown = false;

  stage.setFocus({ x: 0, y: 0.2, z: 0, radius: 1.9 });
  stage.resetView();
  hud.setLevel(state.level);
  hud.setMessage("어느 전개도가 이 상자가 될까요? 하나를 눌러 보세요.");
  refresh();
}

function pick(index) {
  if (index === null || index === undefined) return;
  if (state.picked === index) return;
  state.picked = index;
  const result = evaluateLevel(state.level, index);
  state.resultText = result.cleared ? "정답이에요!" : "아쉬워요";
  state.phase = "play";
  state.resultShown = false;
  refresh();
  hud.setMessage(result.cleared ? "정답이에요! 상자가 똑같이 접혀요." : "이건 아니에요. 다른 전개도를 눌러 보세요.", result.cleared ? "info" : "bad");
  if (result.cleared) {
    state.resultShown = true;
    state.phase = "scored";
    progress.record(state.level.id, { stars: result.stars, score: result.score });
    if (state.levelIndex + 1 >= LEVELS.length) {
      showEndingScreen({
        progress,
        levels: LEVELS,
        title: "마지막 상자까지 맞췄어요!",
        rows: [
          ["마지막 단계", state.level.label],
          ["고른 보기", `${index + 1}번`],
        ],
        onFirst: () => gotoLevel(0),
        onLevels: openLevels,
      });
      return;
    }
    showResult({
      kicker: "정답",
      title: state.level.label,
      stars: result.stars,
      score: result.score,
      rows: [["고른 보기", `${index + 1}번`]],
      detail: "이 전개도를 접으면 목표 상자와 똑같아져요.",
      actions: resultOptions(),
    }).then((action) => {
      if (action === "next") gotoLevel(state.levelIndex + 1);
      if (action === "first") gotoLevel(0);
      if (action === "retry") loadLevel(state.levelIndex);
      if (action === "levels") openLevels();
    });
  }
}

function resultOptions() {
  // 마지막 단계는 엔딩 화면으로 넘어가므로 여기서는 항상 다음 단계가 있다.
  return [
    { id: "next", label: "다음 단계", primary: true, pulse: true },
    { id: "retry", label: "다시 보기" },
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
  targets: () => view.optionGroups.flatMap((group) => group.children.filter((child) => child.userData?.option !== undefined)),
  onPick: (index) => pick(index),
  actions: {
    pick: (index) => pick(index),
  },
});

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  state.invariantProblems = checkInvariants({
    options: state.options,
    cells: NETS[state.level.net],
    target: state.level.target,
    picked: state.picked,
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

/** 자동 검사용. 정답을 고른다. */
function solve() {
  pick(0);
  return true;
}

window.__gameApi = {
  getState: () => {
    const result = evaluateLevel(state.level, state.picked ?? 0);
    return {
      level: state.level.id,
      phase: state.phase,
      picked: state.picked,
      cleared: state.picked === null ? false : result.cleared,
      stars: state.picked === null ? 0 : result.stars,
    };
  },
  getInvariants: () => state.invariantProblems,
  getScreenPositions: () => {
    const entries = [];
    const projected = view.cube.getWorldPosition(new THREE.Vector3()).project(stage.camera);
    entries.push({
      id: "cube",
      x: projected.x,
      y: projected.y,
      visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
    });
    view.optionGroups.forEach((group, index) => {
      const position = group.children.find((child) => child.userData?.option !== undefined);
      if (!position) return;
      const point = position.getWorldPosition(new THREE.Vector3()).project(stage.camera);
      entries.push({
        id: `option-${index}`,
        x: point.x,
        y: point.y,
        visible: Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && point.z <= 1,
      });
    });
    return entries;
  },
  setView: (name) => views.setView(name),
  setChrome: () => {},
  solve,
  loadLevel,
  levelIndex: () => state.levelIndex,
};
