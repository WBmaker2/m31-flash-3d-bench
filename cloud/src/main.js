// 게임 진행과 화면 연결. 물리는 common/parts/platform3d.js 에 있고,
// 여기서는 입력과 판정을 화면에 연결한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createCloudView } from "./cloudView.js";
import { createHud } from "./hud.js";
import { createControls } from "./controls.js";
import { LEVELS, evaluateLevel, levelIndexById } from "./levels.js";
import {
  FIXED_STEP,
  PLAYER_HEIGHT,
  collectCoin,
  createPlayer,
  stepPlayer,
} from "../../common/parts/platform3d.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";
import { showEndingScreen } from "../../common/ending.js";

const FALL_LIMIT = -4;

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const views = createViews(stage);
const view = createCloudView(stage.scene);
const badge = createInvariantBadge({ bottom: "120px" });

const progress = createProgress("cloud", { levels: LEVELS });

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  player: createPlayer(),
  collected: new Set(),
  reached: false,
  phase: "play",
  resultShown: false,
  jumpQueued: false,
  accumulator: 0,
  elapsed: 0,
  invariantProblems: [],
  invariantTimer: 0,
};

const hud = createHud({
  onRestart: () => restart(),
  onLevels: () => openLevels(),
});

const controls = createControls({
  jump: () => {
    state.jumpQueued = true;
  },
  restart: () => restart(),
});

function progressRatio() {
  const span = state.level.goal.x - state.level.start.x;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (state.player.x - state.level.start.x) / span));
}

function refreshHud() {
  hud.setStats({
    coins: state.collected.size,
    total: state.level.coins.length,
    progress: progressRatio(),
  });
}

function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.collected = new Set();
  state.reached = false;
  state.phase = "play";
  state.resultShown = false;
  state.jumpQueued = false;
  state.accumulator = 0;
  state.elapsed = 0;

  state.player = createPlayer(state.level.start);
  state.player.onGround = true;

  view.setLevel(state.level);
  view.setCoins(state.collected);
  view.setPlayer(state.player, false);
  stage.resetView();

  hud.setLevel(state.level);
  hud.setMessage("오른쪽으로 이동하고 Space 로 뛰어 보세요.");
  refreshHud();
}

function restart() {
  state.collected = new Set();
  state.reached = false;
  state.phase = "play";
  state.resultShown = false;
  state.elapsed = 0;
  state.player = createPlayer(state.level.start);
  state.player.onGround = true;
  view.setCoins(state.collected);
  view.setPlayer(state.player, false);
  refreshHud();
  hud.setMessage("처음 위치로 돌아왔어요.");
}

function goalDistance() {
  const dx = state.player.x - state.level.goal.x;
  const dy = state.player.y + PLAYER_HEIGHT / 2 - state.level.goal.y;
  return Math.hypot(dx, dy);
}

function checkGoal() {
  if (state.reached) return;
  if (goalDistance() > 0.75) return;
  state.reached = true;
  state.phase = "scored";
  const value = evaluateLevel(state.level, {
    reached: true,
    coins: state.collected.size,
    totalCoins: state.level.coins.length,
  });
  progress.record(state.level.id, { stars: value.stars, score: value.score });
  if (state.levelIndex + 1 >= LEVELS.length) {
    showEndingScreen({
      progress,
      levels: LEVELS,
      title: "구름 끝에 도착했어요!",
      rows: [
        ["마지막 단계", state.level.label],
        ["마지막 점수", `${value.score}점`],
        ["걸린 시간", `${state.elapsed.toFixed(1)}초`],
      ],
      onFirst: () => gotoLevel(0),
      onLevels: openLevels,
    });
    return;
  }
  showResult({
    kicker: "결승점 도착",
    title: state.level.label,
    stars: value.stars,
    score: value.score,
    rows: [
      ["모은 동전", `${value.coins} / ${value.totalCoins}`],
      ["걸린 시간", `${state.elapsed.toFixed(1)}초`],
    ],
    detail:
      value.stars === 3
        ? "동전도 전부 모셨어요! 다음 단계로 넘어가세요."
        : "결승점 도착! 동전을 다 모으면 3성이에요.",
    actions: resultOptions(),
  }).then((action) => {
    if (action === "next") gotoLevel(state.levelIndex + 1);
    if (action === "first") gotoLevel(0);
    if (action === "retry") restart();
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

function updatePhysics(delta) {
  state.elapsed += delta;
  state.accumulator = Math.min(state.accumulator + delta, 0.2);
  while (state.accumulator >= FIXED_STEP) {
    const result = stepPlayer(state.player, {
      dt: FIXED_STEP,
      input: { move: controls.move, jump: state.jumpQueued },
      platforms: state.level.platforms,
    });
    state.player = result.player;
    state.jumpQueued = false;
    state.accumulator -= FIXED_STEP;
  }

  state.level.coins.forEach((coin, index) => {
    if (state.collected.has(index)) return;
    if (collectCoin(state.player, coin)) {
      state.collected.add(index);
      view.setCoins(state.collected);
      refreshHud();
    }
  });

  if (state.player.y < FALL_LIMIT) {
    restart();
    hud.setMessage("아래로 떨어졌어요. 다시 시도해 보세요.", "bad");
    return;
  }

  view.setPlayer(state.player, Math.abs(state.player.vx) > 0.4);
  stage.updateFollow(state.player.x, state.player.y, state.player.z);
  checkGoal();
}

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  state.invariantProblems = checkInvariants({
    player: state.player,
    platforms: state.level.platforms,
    coins: state.level.coins,
    collected: state.collected,
    goalReached: state.reached,
  });
  badge.show(state.invariantProblems);
  if (state.invariantProblems.length > 0) {
    console.error(
      `[불변식 위반] ${state.invariantProblems.map((problem) => problem.message).join(" | ")}`,
    );
  }
}

stage.start((delta) => {
  if (state.phase === "play") updatePhysics(delta);
  updateInvariants(delta);
});

loadLevel(0);

/** 자동 검사용. 결승점으로 옮긴다. */
function solve() {
  state.player = createPlayer({
    x: state.level.goal.x,
    y: state.level.goal.y - PLAYER_HEIGHT / 2,
    z: state.level.goal.z,
  });
  state.player.onGround = false;
  state.collected = new Set(state.level.coins.map((coin, index) => index));
  view.setCoins(state.collected);
  view.setPlayer(state.player, false);
  stage.updateFollow(state.player.x, state.player.y, state.player.z);
  refreshHud();
  checkGoal();
  return true;
}

window.__gameApi = {
  getState: () => ({
    level: state.level.id,
    phase: state.phase,
    x: Number(state.player.x.toFixed(3)),
    y: Number(state.player.y.toFixed(3)),
    onGround: state.player.onGround,
    coins: state.collected.size,
    totalCoins: state.level.coins.length,
    reached: state.reached,
  }),
  getInvariants: () => state.invariantProblems,
  getScreenPositions: () => {
    const entries = [];
    const position = view.character.position.clone();
    position.y += 0.3;
    const projected = position.project(stage.camera);
    entries.push({
      id: "player",
      x: projected.x,
      y: projected.y,
      visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
    });
    for (const [index, coin] of state.level.coins.entries()) {
      if (state.collected.has(index)) continue;
      const coinProjected = new THREE.Vector3(coin.x, coin.y, coin.z).project(stage.camera);
      entries.push({
        id: `coin-${index}`,
        x: coinProjected.x,
        y: coinProjected.y,
        visible: Math.abs(coinProjected.x) <= 1 && Math.abs(coinProjected.y) <= 1 && coinProjected.z <= 1,
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
