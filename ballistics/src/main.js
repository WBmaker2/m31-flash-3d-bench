// 게임 진행과 화면 연결. 규칙은 physics.js · aim.js · session.js 에 있고,
// 여기서는 상태를 들고 화면에 반영한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createLauncher } from "./launcher.js";
import { createWorld } from "./world.js";
import { createHud } from "./hud.js";
import { LEVELS, targetsOf } from "./levels.js";
import { blocksBounds } from "./grid.js";
import {
  GRAVITY_MPS2,
  PROJECTILE_RADIUS_M,
  scoreForShot,
  settleDebris,
  simulateFlight,
  starsForShots,
} from "./physics.js";
import { resolveImpact, resolveOutcome } from "./session.js";
import { launchState, predictTrajectory } from "./aim.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";

const IMPACT_PAUSE_SECONDS = 0.75;
const MAX_DEBRIS = 28;

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const world = createWorld(stage.scene);
const launcher = createLauncher();
stage.scene.add(launcher.group);

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  aim: { ...LEVELS[0].defaultAim },
  shotsUsed: 0,
  hitCount: 0,
  toppleCount: 0,
  phase: "aim",
  time: 0,
  blocks: [],
  entries: [],
  debris: [],
  bursts: [],
  flight: null,
  flightIndex: 0,
  impactTimer: 0,
  finished: false,
  invariantProblems: [],
  invariantTimer: 0,
};

const badge = createInvariantBadge({ bottom: "150px" });
const views = createViews(stage);
window.addEventListener("resize", () => views.apply());

function remainingTargets() {
  return state.blocks.filter((block) => block.kind === "target").length;
}

function liveScore() {
  return state.hitCount * 100 + state.toppleCount * 60;
}

function windText() {
  const { x, z } = state.level.wind;
  if (x === 0 && z === 0) return "없음";
  const parts = [];
  if (x !== 0) parts.push(`${x > 0 ? "→" : "←"} ${Math.abs(x).toFixed(1)} m/s²`);
  if (z !== 0) parts.push(`${z > 0 ? "앞" : "뒤"} ${Math.abs(z).toFixed(1)} m/s²`);
  return parts.join(" · ");
}

function updateStatus() {
  hud.setLevel(state.level);
  hud.setStatus({
    shots: Math.max(0, state.level.shots - state.shotsUsed),
    shotsLimit: state.level.shots,
    targets: remainingTargets(),
    targetTotal: targetsOf(state.level).length,
    score: liveScore(),
    wind: windText(),
    canFire: state.phase === "aim" && !state.finished,
  });
  hud.setAim(state.aim);
}

function boxesAt(baseTime) {
  return (time) => blocksBounds(state.blocks, baseTime + time);
}

function refreshPreview() {
  if (state.phase !== "aim") {
    world.clearPreview();
    return;
  }
  const initial = launchState(state.aim);
  const points = predictTrajectory(initial, {
    dt: 1 / 60,
    gravity: GRAVITY_MPS2,
    wind: state.level.wind,
    drag: state.level.drag,
    boxes: boxesAt(state.time),
  });
  world.setPreview(points);
}

function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.aim = { ...state.level.defaultAim };
  state.shotsUsed = 0;
  state.hitCount = 0;
  state.toppleCount = 0;
  state.phase = "aim";
  state.flight = null;
  state.flightIndex = 0;
  state.finished = false;
  state.blocks = state.level.blocks.map((block) => ({ ...block }));
  for (const piece of state.debris) world.removeDebris(piece);
  state.debris = [];
  for (const burst of state.bursts) world.clearGroup([burst.group]);
  state.bursts = [];
  world.clearTrail();
  state.entries = world.buildBlocks(state.blocks);
  hud.setAim(state.aim);
  launcher.setAim(state.aim.yawDeg, state.aim.pitchDeg);
  world.setProjectile({ x: 0, y: 1.6, z: 0 }, true);
  updateStatus();
  refreshPreview();
}

function applyAim() {
  state.aim = hud.readAim();
  launcher.setAim(state.aim.yawDeg, state.aim.pitchDeg);
  updateStatus();
  refreshPreview();
}

function toppleAround(destroyed, falling) {
  for (const block of falling) {
    const center = { x: block.i * 2, y: block.j * 2 + 1, z: block.k * 2 };
    const push = {
      x: (block.i - destroyed.i) * 0.45,
      y: 0.5,
      z: (block.k - destroyed.k) * 0.45,
    };
    const piece = world.addDebris(block, center, push);
    piece.spin = (block.i % 2 === 0 ? 1 : -1) * 0.9;
    state.debris.push(piece);
    state.toppleCount += 1;
  }

  if (state.debris.length > MAX_DEBRIS) {
    const extra = state.debris.splice(0, state.debris.length - MAX_DEBRIS);
    for (const piece of extra) world.removeDebris(piece);
  }
}

function onImpact(hit) {
  const result = resolveImpact(state.blocks, hit.box.id);
  world.setProjectile(hit.point, true);
  state.bursts.push(world.burst(hit.point));

  if (!result.destroyed) {
    showToast("벽에 부딪혔습니다.", "bad");
    return;
  }

  for (const block of [result.destroyed, ...result.falling]) {
    world.removeBlock(state.entries, block.id);
  }
  state.blocks = result.remaining;
  state.hitCount += 1;
  toppleAround(result.destroyed, result.falling);
  showToast(
    result.falling.length > 0 ? `명중! 상자 ${result.falling.length}개가 무너졌습니다.` : "명중!",
  );
}

function fire() {
  if (state.phase !== "aim" || state.finished) return;
  state.shotsUsed += 1;
  state.phase = "flying";

  const initial = launchState(state.aim);
  const result = simulateFlight(initial, {
    dt: 1 / 60,
    gravity: GRAVITY_MPS2,
    wind: state.level.wind,
    drag: state.level.drag,
    radius: PROJECTILE_RADIUS_M,
    maxSteps: 900,
    boxes: boxesAt(state.time),
  });

  state.flight = result;
  state.flightIndex = 0;
  world.clearPreview();
  world.setTrail(result.points);
  world.setProjectile(result.points[0], true);
  updateStatus();
}

function endShot() {
  state.phase = "impact";
  state.impactTimer = IMPACT_PAUSE_SECONDS;
  updateStatus();
}

function finishLevel(outcome) {
  state.finished = true;
  state.phase = "over";
  const shotsLeft = Math.max(0, state.level.shots - state.shotsUsed);
  const score = liveScore() + (outcome === "won" ? shotsLeft * 50 : 0);
  const stars = outcome === "won" ? starsForShots(state.shotsUsed, state.level.par) : 0;
  const hasNext = state.levelIndex + 1 < LEVELS.length;
  const isLast = !hasNext;

  // 단계를 통과하면 다음 단계로 바로 넘어갈 수 있게 첫 버튼으로 둔다.
  const actions =
    outcome === "won" && hasNext
      ? [
          { id: "next", label: "다음 단계", primary: true, pulse: true },
          { id: "retry", label: "다시 하기" },
          { id: "levels", label: "레벨 선택" },
        ]
      : outcome === "won"
        ? [
            { id: "first", label: "처음부터", primary: true, pulse: true },
            { id: "retry", label: "다시 하기" },
            { id: "levels", label: "레벨 선택" },
          ]
        : [
            { id: "retry", label: "다시 하기", primary: true },
            { id: "levels", label: "레벨 선택" },
          ];

  showResult({
    kicker: outcome === "won" ? (isLast ? "최종 클리어" : "클리어") : "실패",
    title: state.level.label,
    stars,
    score,
    rows: [
      ["사용 샷", `${state.shotsUsed} / ${state.level.shots}`],
      ["남은 표적", `${remainingTargets()}개`],
      ["남은 샷 보너스", `${outcome === "won" ? shotsLeft * 50 : 0}점`],
    ],
    detail:
      outcome === "won"
        ? isLast
          ? "마지막 단계까지 클리어했습니다. 처음부터 다시 도전해도 좋습니다."
          : state.shotsUsed <= state.level.par
            ? "표준 샷 수 이하로 클리어했습니다."
            : "표준보다 샷을 많이 썼습니다. 조준을 다듬어 보세요."
        : "샷이 모두 떨어졌습니다. 각도를 다시 잡아 보세요.",
    actions,
  }).then((action) => {
    if (action === "next") gotoLevel(state.levelIndex + 1);
    if (action === "first") gotoLevel(0);
    if (action === "retry") gotoLevel(state.levelIndex);
    if (action === "levels") openLevels();
  });
  updateStatus();
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

function updateDebris(delta) {
  for (const piece of state.debris) {
    const next = settleDebris(piece, delta);
    piece.position = next.position;
    piece.velocity = next.velocity;
    piece.spin = next.spin;
    piece.mesh.position.set(next.position.x, next.position.y, next.position.z);
    piece.mesh.rotation.x += piece.spin * delta;
    piece.mesh.rotation.z += piece.spin * 0.6 * delta;
  }
}

function updateFlight() {
  const flight = state.flight;
  if (!flight) return;
  state.flightIndex += 1;
  const point = flight.points[state.flightIndex];
  if (!point) {
    endShot();
    return;
  }
  world.setProjectile(point, true);
  if (state.flightIndex >= flight.points.length - 1) {
    if (flight.hit) onImpact(flight.hit);
    endShot();
  }
}

function update(delta) {
  state.time += delta;
  world.syncBlocks(state.entries, state.time);

  updateDebris(delta);

  for (const burst of [...state.bursts]) {
    if (world.updateBurst(burst, delta)) {
      state.bursts = state.bursts.filter((entry) => entry !== burst);
    }
  }

  if (state.phase === "flying") {
    updateFlight();
  } else if (state.phase === "impact") {
    state.impactTimer -= delta;
    if (state.impactTimer <= 0) {
      const outcome = resolveOutcome({
        targetsLeft: remainingTargets(),
        shotsUsed: state.shotsUsed,
        shotsLimit: state.level.shots,
      });
      if (outcome !== "continue") {
        finishLevel(outcome);
      } else {
        state.phase = "aim";
        state.flight = null;
        world.clearTrail();
        world.setProjectile({ x: 0, y: 1.6, z: 0 }, true);
        refreshPreview();
        updateStatus();
      }
    }
  } else if (state.phase === "aim") {
    refreshPreview();
  }
}

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  state.invariantProblems = checkInvariants({
    projectile:
      state.phase === "flying" && state.flight
        ? { position: state.flight.points[state.flightIndex] ?? state.flight.points[0], velocity: state.flight.state.velocity }
        : null,
    debris: state.debris,
    blocks: state.blocks,
    shotsUsed: state.shotsUsed,
    shotsLimit: state.level.shots,
    targetsLeft: remainingTargets(),
  });
  badge.show(state.invariantProblems);
  if (state.invariantProblems.length > 0) {
    console.error(`[불변식 위반] ${state.invariantProblems.map((problem) => problem.message).join(" | ")}`);
  }
}

const hud = createHud({
  onAim: applyAim,
  onFire: fire,
  onReset: () => loadLevel(state.levelIndex),
  onLevels: openLevels,
});

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const step = event.shiftKey ? 5 : 1;
  if (event.key === "ArrowUp") {
    hud.setAimValue({ pitchDeg: state.aim.pitchDeg + step });
    applyAim();
  } else if (event.key === "ArrowDown") {
    hud.setAimValue({ pitchDeg: state.aim.pitchDeg - step });
    applyAim();
  } else if (event.key === "ArrowLeft") {
    hud.setAimValue({ yawDeg: state.aim.yawDeg - step });
    applyAim();
  } else if (event.key === "ArrowRight") {
    hud.setAimValue({ yawDeg: state.aim.yawDeg + step });
    applyAim();
  } else if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    fire();
  } else if (event.key === "r" || event.key === "R") {
    loadLevel(state.levelIndex);
  }
});

stage.start((delta) => {
  update(delta);
  updateInvariants(delta);
});

loadLevel(0);

window.__gameApi = {
  getState: () => ({
    level: state.level.id,
    phase: state.phase,
    shotsUsed: state.shotsUsed,
    shotsLeft: Math.max(0, state.level.shots - state.shotsUsed),
    targetsLeft: remainingTargets(),
    score: liveScore(),
    hitCount: state.hitCount,
    toppleCount: state.toppleCount,
    finished: state.finished,
    aim: { ...state.aim },
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

    push("launcher", launcher.muzzle);
    for (const entry of state.entries) {
      push(entry.block.id, entry.mesh.position);
    }
    for (const piece of state.debris) {
      push(piece.id, new THREE.Vector3(piece.position.x, piece.position.y, piece.position.z));
    }
    const flightPoint = state.flight?.points[state.flightIndex];
    if (flightPoint) push("projectile", new THREE.Vector3(flightPoint.x, flightPoint.y, flightPoint.z));

    return entries;
  },
  setView: views.setView,
  setChrome: (options = {}) => {
    if (options.labels === false) {
      launcher.group.visible = false;
    }
    if (options.labels === true) {
      launcher.group.visible = true;
    }
  },
  setAim: (aim = {}) => {
    hud.setAimValue(aim);
    applyAim();
  },
  fire,
  loadLevel,
  levelIndex: () => state.levelIndex,
};
