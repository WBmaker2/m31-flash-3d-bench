// 게임 진행과 화면 연결. 규칙은 ik.js · levels.js 에 있고, 여기서는 상태를 들고 화면에 반영한다.
import * as THREE from "three";
import { createStage, createViews, createPicker, BENCH } from "./stage.js";
import { createArm } from "./arm.js";
import { createHud } from "./hud.js";
import { LEVELS, RACK, BLOCK_SIZE, PLATE_OFFSET, evaluatePlacement, goalOf, goalPoint, pickupPoint } from "./levels.js";
import {
  ARM,
  armReach,
  blendAngles,
  forwardArm,
  linksHitPillars,
  planPlacement,
  solveArm,
} from "./ik.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";

const MOVE_SECONDS = 0.6;
const LIFT_SECONDS = 0.45;
const GRIP_SECONDS = 0.25;
const LIFT_Y = 1.8; // 장애물 위를 넘나드는 높이
const PILLAR_COLOR = 0x8c939c;

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const picker = createPicker(canvas, stage.camera);
const views = createViews(stage);
const arm = createArm();
stage.scene.add(arm.group);

const world = new THREE.Group();
stage.scene.add(world);

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  phase: "idle",
  gripTimer: 0,
  attempts: 0,
  lastError: null,
  angles: { baseYaw: 0, shoulder: 0, elbow: 0 },
  anim: null,
  plan: null,
  surfaces: [],
  plates: [],
  pillars: [],
  block: null,
  held: false,
  invariantProblems: [],
  invariantTimer: 0,
};

const badge = createInvariantBadge({ bottom: "120px" });

const hud = createHud({
  onRetry: () => loadLevel(state.levelIndex),
  onLevels: openLevels,
});

// ── 메시 구성 ───────────────────────────────────────────
function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.geometry?.dispose();
    if (child.material) {
      const list = Array.isArray(child.material) ? child.material : [child.material];
      for (const entry of list) entry.dispose();
    }
  }
}

const blockMaterial = new THREE.MeshStandardMaterial({
  color: 0xf2b24a,
  roughness: 0.55,
  metalness: 0.1,
});

function buildLevel() {
  clearGroup(world);
  state.surfaces = [];
  state.plates = [];
  state.pillars = state.level.pillars.map((pillar) => ({ ...pillar }));

  // 표적 판. 정답은 청색, 미끼는 회색.
  for (const target of state.level.targets) {
    const isGoal = target.kind === "goal";
    const radius = isGoal ? state.level.tolerance : 0.42;
    // 판은 작업대 위에 얹힌 얇은 원반이다. 윗면이 곧 블록이 놓이는 높이다.
    const plate = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 44),
      new THREE.MeshBasicMaterial({
        color: isGoal ? 0x3fa7d6 : 0x7b8089,
        transparent: true,
        opacity: isGoal ? 0.72 : 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(target.x, target.y + PLATE_OFFSET, target.z);
    world.add(plate);
    state.surfaces.push(plate);
    state.plates.push({ target, mesh: plate, isGoal });

    // 높이가 다른 표적은 받침 기둥을 세운다.
    if (target.y > 0.02) {
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.8, radius * 0.95, target.y, 28),
        new THREE.MeshStandardMaterial({ color: 0x5c6470, roughness: 0.8, metalness: 0.15 }),
      );
      stand.position.set(target.x, target.y / 2, target.z);
      stand.castShadow = true;
      stand.receiveShadow = true;
      world.add(stand);
      state.surfaces.push(stand);
    }
  }

  // 장애물 기둥
  for (const pillar of state.pillars) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(pillar.radius, pillar.radius * 1.08, pillar.height, 24),
      new THREE.MeshStandardMaterial({ color: PILLAR_COLOR, roughness: 0.62, metalness: 0.35 }),
    );
    mesh.position.set(pillar.x, pillar.height / 2, pillar.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    world.add(mesh);
  }

  // 장작대와 블록
  const rack = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, RACK.height, 0.62),
    new THREE.MeshStandardMaterial({ color: 0x6f6552, roughness: 0.85, metalness: 0.08 }),
  );
  rack.position.set(RACK.x, RACK.height / 2, RACK.z);
  rack.receiveShadow = true;
  rack.castShadow = true;
  world.add(rack);

  const block = new THREE.Mesh(
    new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE),
    blockMaterial,
  );
  block.castShadow = true;
  block.receiveShadow = true;
  world.add(block);
  state.block = block;
  state.held = false;
  state.block.position.set(RACK.x, RACK.height + BLOCK_SIZE / 2, RACK.z);

  // 발사대 위 작업면도 클릭 대상이다.
  state.surfaces.push(stage.scene.getObjectByName("bench-top"));
}

function setAnglesNow(angles) {
  state.angles = { ...angles };
  arm.setAngles(state.angles);
}

function startMove(targetAngles, duration, onDone) {
  state.anim = { from: { ...state.angles }, to: { ...targetAngles }, t: 0, duration, onDone };
}

function ease(t) {
  return t * t * (3 - 2 * t);
}

/** 기둥에 막히지 않는 대기 자세. */
function homePose() {
  const candidates = [
    { x: 0.85, y: 1.15, z: 1.15 },
    { x: -0.55, y: 1.2, z: 1.0 },
    { x: 1.0, y: 1.35, z: -0.35 },
    { x: 0.2, y: 1.5, z: 0.2 },
  ];
  for (const point of candidates) {
    const angles = solveArm(point, ARM, 1);
    if (!linksHitPillars(angles, state.pillars, ARM)) return angles;
  }
  return solveArm(candidates[0], ARM, 1);
}

/** 기둥에 막히지 않는 관절 각을 고른다. */
function safePose(point) {
  const plan = planPlacement(point, state.pillars, ARM);
  return plan.reachable ? plan.angles : solveArm(point, ARM, 1);
}

/** 관절 각 목록을 순서대로 따라간다. */
function runSequence(steps, onDone) {
  let index = 0;
  const next = () => {
    if (index >= steps.length) {
      onDone?.();
      return;
    }
    const step = steps[index];
    index += 1;
    state.phase = "toTarget";
    startMove(step.angles, step.duration, next);
  };
  next();
}

// ── 레벨 흐름 ───────────────────────────────────────────
function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.phase = "idle";
  state.attempts = 0;
  state.lastError = null;
  state.anim = null;
  state.plan = null;
  state.gripTimer = 0;
  buildLevel();

  // 대기 자세는 기둥에 걸리지 않는 지점을 고른다.
  setAnglesNow(homePose());
  arm.setJaws(true);

  hud.setLevel(state.level);
  hud.setMessage("표적 판을 누르세요. 파란 판에 블록을 놓으면 됩니다.");
  updateStatus();
}

function updateStatus() {
  hud.setStatus({
    error: state.lastError,
    reach: armReach(ARM),
    tries: state.attempts,
    phase: phaseLabel(),
  });
}

function phaseLabel() {
  if (state.phase === "idle") return "대기";
  if (state.phase === "toRack" || state.phase === "toTarget") return "이동 중";
  if (state.phase === "grip") return "집는 중";
  if (state.phase === "release") return "놓는 중";
  if (state.phase === "done") return "완료";
  return state.phase;
}

function attemptPlace(worldPoint) {
  if (state.phase !== "idle") return;

  const placement = {
    x: worldPoint.x,
    y: worldPoint.y + BLOCK_SIZE / 2,
    z: worldPoint.z,
  };
  const plan = planPlacement(placement, state.pillars, ARM);

  if (!plan.reachable) {
    hud.setMessage("도달할 수 없습니다. 금빛 링 안쪽을 노려 보세요.", "bad");
    showToast("도달 불가 · 손이 닿지 않습니다", "bad");
    return;
  }
  if (plan.blocked) {
    hud.setMessage("장애물에 막혔습니다.", "bad");
    showToast("장애물에 막혔습니다", "bad");
    return;
  }

  state.plan = { ...plan, placement };
  state.attempts += 1;

  const pickup = solveArm(pickupPoint(state.level), ARM, 1);
  state.phase = "toRack";
  startMove(pickup, MOVE_SECONDS, () => {
    state.phase = "grip";
    state.gripTimer = GRIP_SECONDS;
    arm.setJaws(false);
    arm.held.add(state.block);
    state.block.position.set(0, 0, 0);
    state.held = true;
  });
  hud.setMessage("블록을 집으러 갑니다.");
  updateStatus();
}

function judge(placement) {
  const goalCenter = goalPoint(state.level);
  const error = Math.hypot(
    placement.x - goalCenter.x,
    placement.y - goalCenter.y,
    placement.z - goalCenter.z,
  );
  state.lastError = error;
  const result = evaluatePlacement(error, state.level);
  state.phase = "done";
  updateStatus();

  if (result.cleared) {
    hud.setMessage(`클리어! 오차 ${error.toFixed(3)} m`, "info");
  } else {
    hud.setMessage(`허용 오차(${state.level.tolerance.toFixed(2)} m)를 넘었습니다.`, "bad");
  }

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
    kicker: result.cleared ? "조립 완료" : "실패",
    title: state.level.label,
    stars: result.stars,
    score: Math.max(0, Math.round((state.level.tolerance - error) * 1000)),
    rows: [
      ["배치 오차", `${error.toFixed(3)} m`],
      ["허용 오차", `${state.level.tolerance.toFixed(2)} m`],
      ["시도 횟수", `${state.attempts}회`],
    ],
    detail: result.cleared
      ? hasNext
        ? "다음 단계로 이어서 조립해 보세요."
        : "마지막 단계까지 마쳤습니다."
      : "목표 판 중심에 더 가깝게 놓아 보세요.",
    actions,
  }).then((action) => {
    if (action === "next") gotoLevel(state.levelIndex + 1);
    if (action === "first") gotoLevel(0);
    if (action === "retry") gotoLevel(state.levelIndex);
    if (action === "levels") openLevels();
  });
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

// ── 입력 ───────────────────────────────────────────────
let pointerDownAt = null;

canvas.addEventListener("pointerdown", (event) => {
  pointerDownAt = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (!pointerDownAt) return;
  const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
  pointerDownAt = null;
  if (moved > 5) return;

  const hits = picker.pick(event.clientX, event.clientY, state.surfaces);
  if (hits.length === 0) {
    hud.setMessage("작업대 위를 눌러 위치를 정하세요.", "bad");
    return;
  }
  attemptPlace(hits[0].point);
});

canvas.addEventListener("pointermove", (event) => {
  if (state.phase !== "idle") return;
  const hits = picker.pick(event.clientX, event.clientY, state.surfaces);
  const reachable = hits.length > 0 && planPlacement(
    { x: hits[0].point.x, y: hits[0].point.y + BLOCK_SIZE / 2, z: hits[0].point.z },
    state.pillars,
    ARM,
  ).reachable;
  canvas.style.cursor = reachable ? "pointer" : "not-allowed";
});

window.addEventListener("keydown", (event) => {
  if (event.key === "r" || event.key === "R") loadLevel(state.levelIndex);
});

// ── 루프 ───────────────────────────────────────────────
function update(delta) {
  if (state.phase === "grip") {
    state.gripTimer -= delta;
    if (state.gripTimer <= 0) {
      // 이동 시작과 동시에 단계를 바꿔야 grip 타이머가 이동을 다시 시작하지 않는다.
      state.phase = "toTarget";
      const plan = state.plan;
      // 들어 올림 → 장애물 위를 넘는 이동 → 내려놓기. 기둥을 그대로 통과하지 않는다.
      runSequence(
        [
          { angles: safePose({ x: plan.placement.x, y: LIFT_Y, z: plan.placement.z }), duration: LIFT_SECONDS },
          { angles: plan.angles, duration: LIFT_SECONDS },
        ],
        () => {
          state.phase = "release";
          arm.setJaws(true);
          const position = arm.tipPosition();
          arm.held.remove(state.block);
          world.add(state.block);
          state.block.position.copy(position);
          state.held = false;
          judge(plan.placement);
        },
      );
    }
  }

  if (state.anim) {
    state.anim.t += delta;
    const raw = Math.min(state.anim.t / state.anim.duration, 1);
    state.angles = blendAngles(state.anim.from, state.anim.to, ease(raw));
    arm.setAngles(state.angles);
    if (raw >= 1) {
      const onDone = state.anim.onDone;
      state.anim = null;
      onDone?.();
    }
  }
}

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  // 이동 중의 순간 자세는 검사 대상이 아니다. 목표 자세를 본다.
  const settled = state.plan?.angles ?? state.angles;
  const tip = forwardArm(settled, ARM).tip;
  state.invariantProblems = checkInvariants({
    angles: settled,
    tip,
    pillars: state.pillars,
    blockPosition: state.block?.position ?? null,
    error: state.lastError,
    attempts: state.attempts,
  });
  badge.show(state.invariantProblems);
  if (state.invariantProblems.length > 0) {
    console.error(`[불변식 위반] ${state.invariantProblems.map((problem) => problem.message).join(" | ")}`);
  }
}

stage.start((delta) => {
  update(delta);
  updateInvariants(delta);
});

loadLevel(0);

window.__gameApi = {
  getState: () => ({
    level: state.level.id,
    phase: state.phase,
    attempts: state.attempts,
    lastError: state.lastError,
    reach: armReach(ARM),
    goal: goalPoint(state.level),
    pillars: state.pillars.length,
    finished: state.phase === "done",
  }),
  getInvariants: () => state.invariantProblems,
  getScreenPositions: () => {
    const entries = [];
    for (const plate of state.plates) {
      const target = plate.target;
      const point = new THREE.Vector3(target.x, target.y + PLATE_OFFSET, target.z);
      const projected = point.project(stage.camera);
      entries.push({
        id: `plate-${target.id}`,
        x: projected.x,
        y: projected.y,
        visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
      });
    }
    const rack = new THREE.Vector3(RACK.x, RACK.height, RACK.z).project(stage.camera);
    entries.push({ id: "rack", x: rack.x, y: rack.y, visible: true });
    return entries;
  },
  setView: views.setView,
  setChrome: (options = {}) => {
    if (options.labels === false) {
      for (const plate of state.plates) plate.mesh.visible = false;
    }
    if (options.labels === true) {
      for (const plate of state.plates) plate.mesh.visible = true;
    }
  },
  loadLevel,
  levelIndex: () => state.levelIndex,
  bench: BENCH,
};
