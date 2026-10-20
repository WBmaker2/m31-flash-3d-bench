// 게임 진행과 화면 연결. 무리 규칙은 flock.js 에 있고, 여기서는 상태를 들고 화면에 반영한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createFlockView } from "./flockView.js";
import { createHud } from "./hud.js";
import { ARENA, GATE_LIGHT_RADIUS, LEVELS, buildGates, evaluateFlock, scoreForFlock, startRegion } from "./levels.js";
import { FLOCK, flockMetrics, scatterFlock, stepFlock } from "./flock.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";

const LIGHT_SPEED_MPS = 12;
const LIGHT_HEIGHT = 3;
const SPREAD_SMOOTHING = 0.12;

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const views = createViews(stage, () => flockMetrics(state.birds).centroid);
const view = createFlockView(stage.scene);
const badge = createInvariantBadge({ bottom: "120px" });

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  birds: [],
  gates: [],
  activeIndex: 0,
  light: { x: 0, y: LIGHT_HEIGHT, z: 0 },
  lightDirection: { x: 0, z: 0 },
  spread: 0,
  timeLeft: 0,
  phase: "play",
  attempts: 0,
  solveQueue: [],
  solveIndex: 0,
  solving: false,
  following: true,
  lastCentroid: { x: 0, y: 0, z: 0 },
  invariantProblems: [],
  invariantTimer: 0,
};

const hud = createHud({
  onRetry: () => loadLevel(state.levelIndex),
  onLevels: openLevels,
});

function clampToArena(value, limit) {
  return Math.max(-limit, Math.min(limit, value));
}

function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.birds = scatterFlock(state.level.birds, state.level.seed, FLOCK, startRegion(state.level));
  state.gates = buildGates(state.level);
  state.activeIndex = 0;
  state.timeLeft = state.level.timeLimit;
  state.phase = "play";
  state.attempts = 0;
  state.solveQueue = [];
  state.solveIndex = 0;
  state.solving = false;
  state.following = true;
  // 불빛도 첫 링 뒤에서 출발한다. 앞쪽에서 시작하면 아무것도 안 해도 링이 통과된다.
  const first = state.gates[0];
  state.light = {
    x: clampToArena(first.center.x - first.normal.x * 8, ARENA.halfX - 1),
    y: LIGHT_HEIGHT,
    z: clampToArena(first.center.z - first.normal.z * 8, ARENA.halfZ - 1),
  };
  state.lightDirection = { x: 0, z: 0 };
  state.spread = flockMetrics(state.birds).spread;
  state.lastCentroid = flockMetrics(state.birds).centroid;

  view.setCount(state.birds.length);
  view.setGates(state.gates, state.activeIndex);

  // 카메라는 무리 가까이 붙어 있어야 새가 보인다.
  const start = flockMetrics(state.birds).centroid;
  stage.controls.target.set(start.x, 2, start.z);
  stage.camera.position.set(start.x + 16, 16, start.z + 22);
  stage.controls.update();
  hud.setLevel(state.level);
  hud.setMessage("WASD로 불빛을 움직여 새 떼를 첫 링으로 몰아주세요.");
  refreshStatus();
}

function refreshStatus() {
  hud.setStatus({
    gatesPassed: state.activeIndex,
    gatesTotal: state.gates.length,
    timeLeft: state.timeLeft,
    spread: state.spread,
    scatterLimit: state.level.scatterLimit,
    birds: state.birds.length,
  });
}

function moveLight(delta) {
  if (state.solving) {
    const target = state.solveQueue[state.solveIndex];
    if (!target) {
      state.solving = false;
      return;
    }
    const dx = target.x - state.light.x;
    const dz = target.z - state.light.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 1.6) {
      // 링에 도착했어도 떼가 모일 때까지 기다린다.
      if (state.activeIndex > state.solveIndex) {
        state.solveIndex += 1;
      } else {
        state.lightDirection = { x: 0, z: 0 };
        return;
      }
    } else {
      state.lightDirection.x = dx / distance;
      state.lightDirection.z = dz / distance;
    }
  }

  const magnitude = Math.hypot(state.lightDirection.x, state.lightDirection.z);
  if (magnitude < 1e-6) return;
  const step = LIGHT_SPEED_MPS * delta;
  state.light.x = clampToArena(state.light.x + (state.lightDirection.x / magnitude) * step, ARENA.halfX - 1);
  state.light.z = clampToArena(state.light.z + (state.lightDirection.z / magnitude) * step, ARENA.halfZ - 1);
}

/**
 * 링 통과 판정. "이벤트"(어떤 새가 선을 넘었다)가 아니라
 * "상태"(플레이어가 링에 불빛을 두고 무리가 링에 모였다)로 본다.
 * boids 무리는 목표 주위를 맴돌기 때문에 선을 넘는 순간은 안정적이지 않다.
 */
function checkGates(centroid) {
  const gate = state.gates[state.activeIndex];
  if (!gate) return false;

  const lightDistance = Math.hypot(state.light.x - gate.center.x, state.light.z - gate.center.z);
  const flockDistance = Math.hypot(
    centroid.x - gate.center.x,
    centroid.y - gate.center.y,
    centroid.z - gate.center.z,
  );
  if (lightDistance > GATE_LIGHT_RADIUS) return false;
  if (flockDistance > gate.radius) return false;

  state.activeIndex += 1;
  view.setGates(state.gates, state.activeIndex);
  if (state.activeIndex >= state.gates.length) {
    showToast("모든 링을 통과했습니다!", "info");
  } else {
    showToast(`링 ${state.activeIndex} 통과 · 다음 링으로 이동`);
  }
  return true;
}

function finishLevel(outcome) {
  if (state.phase === "done") return;
  state.phase = "done";
  const result = evaluateFlock(
    {
      gatesPassed: state.activeIndex,
      gatesTotal: state.gates.length,
      timeLeft: state.timeLeft,
      spread: state.spread,
    },
    state.level,
  );
  const score = scoreForFlock(
    {
      gatesPassed: state.activeIndex,
      timeLeft: state.timeLeft,
      spread: state.spread,
    },
    state.level,
  );
  const hasNext = state.levelIndex + 1 < LEVELS.length;
  const actions = hasNext
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

  showResult({
    kicker: outcome === "won" ? "무리 유도 성공" : "시간 초과",
    title: state.level.label,
    stars: result.stars,
    score,
    rows: [
      ["통과한 링", `${state.activeIndex} / ${state.gates.length}`],
      ["흩어짐", `${state.spread.toFixed(1)} m (허용 ${state.level.scatterLimit} m)`],
      ["남은 시간", `${Math.max(0, Math.ceil(state.timeLeft))}초`],
    ],
    detail:
      outcome === "won"
        ? state.spread <= state.level.scatterLimit
          ? "흩어짐 없이 깔끔하게 몰았습니다."
          : "몰았지만 흩어졌습니다. 불빛을 더 천천히 움직여 보세요."
        : "시간 안에 모든 링을 통과하지 못했습니다.",
    actions,
  }).then((action) => {
    if (action === "next") gotoLevel(state.levelIndex + 1);
    if (action === "first") gotoLevel(0);
    if (action === "retry") gotoLevel(state.levelIndex);
    if (action === "levels") openLevels();
  });
  refreshStatus();
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
      stars: 0,
      unlocked: true,
    })),
    footerActions: [{ id: "close", label: "닫기" }],
  }).then((result) => {
    if (result && result.levelId) {
      const index = LEVELS.findIndex((level) => level.id === result.levelId);
      if (index >= 0) loadLevel(index);
    }
  });
}

/** 자동 검사용. 링을 순서대로 가리키며 불빛을 움직인다. */
function solve() {
  if (state.phase !== "play") return false;
  state.solveQueue = state.gates.map((gate) => ({
    x: gate.center.x + gate.normal.x * 2,
    y: gate.center.y,
    z: gate.center.z + gate.normal.z * 2,
  }));
  state.solveIndex = 0;
  state.solving = true;
  return true;
}

const KEY_DIRECTION = {
  KeyW: { x: 0, z: -1 },
  ArrowUp: { x: 0, z: -1 },
  KeyS: { x: 0, z: 1 },
  ArrowDown: { x: 0, z: 1 },
  KeyA: { x: -1, z: 0 },
  ArrowLeft: { x: -1, z: 0 },
  KeyD: { x: 1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
};

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const direction = KEY_DIRECTION[event.code];
  if (direction) {
    event.preventDefault();
    state.lightDirection = { ...direction };
    state.solving = false;
    return;
  }
  if (event.code === "KeyR") loadLevel(state.levelIndex);
});

function update(delta, elapsed) {
  if (state.phase !== "play") return;

  moveLight(delta);
  state.birds = stepFlock(state.birds, FLOCK, delta, state.light);

  const metrics = flockMetrics(state.birds);
  checkGates(metrics.centroid);
  state.spread = state.spread * (1 - SPREAD_SMOOTHING) + metrics.spread * SPREAD_SMOOTHING;

  state.timeLeft -= delta;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    finishLevel("lost");
    return;
  }
  if (state.activeIndex >= state.gates.length) {
    finishLevel("won");
    return;
  }

  view.update(state.birds, elapsed);
  view.setLight(state.light, elapsed);

  if (state.following) {
    // 플레이어가 돌려 본 각도는 유지한 채 무리 중심만 따라간다.
    const offset = stage.camera.position.clone().sub(stage.controls.target);
    stage.controls.target.set(metrics.centroid.x, 2, metrics.centroid.z);
    stage.camera.position.copy(stage.controls.target).add(offset);
    state.lastCentroid = { ...metrics.centroid };
  }
}

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  state.invariantProblems = checkInvariants({
    birds: state.birds,
    light: state.light,
    gates: state.gates,
    activeIndex: state.activeIndex,
    spread: state.spread,
    timeLeft: state.timeLeft,
    count: state.level.birds,
  });
  badge.show(state.invariantProblems);
  if (state.invariantProblems.length > 0) {
    console.error(`[불변식 위반] ${state.invariantProblems.map((problem) => problem.message).join(" | ")}`);
  }
}

stage.start((delta, elapsed) => {
  update(delta, elapsed);
  updateInvariants(delta);
});

loadLevel(0);

window.__gameApi = {
  getState: () => ({
    level: state.level.id,
    phase: state.phase,
    gatesPassed: state.activeIndex,
    gatesTotal: state.gates.length,
    spread: Number(state.spread.toFixed(2)),
    scatterLimit: state.level.scatterLimit,
    timeLeft: Math.max(0, Math.round(state.timeLeft)),
    birds: state.birds.length,
    finished: state.phase === "done",
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
    push("light", new THREE.Vector3(state.light.x, state.light.y, state.light.z));
    state.gates.forEach((gate, index) => {
      push(`gate-${index}`, new THREE.Vector3(gate.center.x, gate.center.y, gate.center.z));
    });
    const sample = state.birds[0];
    if (sample) push("bird", new THREE.Vector3(sample.position.x, sample.position.y, sample.position.z));
    return entries;
  },
  setView: (name) => {
    state.following = false;
    views.setView(name);
  },
  // 이 게임에는 텍스트 라벨이 없다. 카드 촬영에서 숨길 것이 없다.
  setChrome: () => {},
  solve,
  loadLevel,
  levelIndex: () => state.levelIndex,
};
