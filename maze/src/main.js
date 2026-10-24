// 게임 진행과 화면 연결. 미로 규칙은 maze.js 에 있고, 여기서는 상태를 들고 화면에 반영한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createMazeView } from "./mazeView.js";
import { createHud } from "./hud.js";
import { LEVELS, evaluateSteps, scoreForSteps } from "./levels.js";
import {
  CELL_SIZE_M,
  DIRECTIONS,
  EYE_HEIGHT_M,
  MOVE_SPEED_MPS,
  cellToWorld,
  directionBetween,
  generateMaze,
  maskToKeys,
  resolveMove,
  shortestRoute,
} from "./maze.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";
import { showEndingScreen } from "../../common/ending.js";

const STEP_SECONDS = CELL_SIZE_M / MOVE_SPEED_MPS;
const KEY_TO_DIRECTION = {
  ArrowUp: 0,
  KeyW: 0,
  ArrowRight: 1,
  KeyD: 1,
  ArrowDown: 2,
  KeyS: 2,
  ArrowLeft: 3,
  KeyA: 3,
};
const DIRECTION_VECTOR = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
];

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const views = createViews(stage);
const badge = createInvariantBadge({ bottom: "130px" });

const progress = createProgress("maze", { levels: LEVELS });

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  maze: null,
  view: null,
  cell: 0,
  facing: 0,
  desired: -1,
  heldMask: 0,
  steps: 0,
  elapsed: 0,
  moveTimer: 0,
  visited: new Set(),
  phase: "play",
  par: 0,
  route: [],
  routeIndex: 0,
  solving: false,
  overview: false,
  invariantProblems: [],
  invariantTimer: 0,
  mapTimer: 0,
};

const hud = createHud({
  onRetry: () => loadLevel(state.levelIndex),
  onLevels: openLevels,
});

function extentOf(maze) {
  return (Math.max(maze.cols, maze.rows) * CELL_SIZE_M) / 2;
}

function targetYaw(direction) {
  const vector = DIRECTION_VECTOR[direction];
  return Math.atan2(-vector.x, -vector.z);
}

function loadLevel(index) {
  state.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  state.level = LEVELS[state.levelIndex];
  state.maze = generateMaze(state.level.cols, state.level.rows, state.level.seed, {
    keys: state.level.keys,
  });
  if (state.view) state.view.dispose();
  state.view = createMazeView(stage.scene, state.maze);
  stage.setExtent(extentOf(state.maze));

  const route = shortestRoute(state.maze);
  state.par = route.steps;
  state.route = route.path;
  state.routeIndex = 0;
  state.solving = false;
  state.overview = false;
  stage.setMode("play");

  state.cell = state.maze.start;
  state.facing = 0;
  for (let dir = 0; dir < 4; dir += 1) {
    if (state.maze.cells[state.cell][DIRECTIONS[dir].name]) {
      state.facing = dir;
      break;
    }
  }
  state.desired = -1;
  state.heldMask = 0;
  state.steps = 0;
  state.elapsed = 0;
  state.moveTimer = 0;
  state.visited = new Set([state.cell]);
  state.phase = "play";

  const start = cellToWorld(state.maze, state.cell);
  stage.rig.x = start.x;
  stage.rig.z = start.z;
  stage.rig.yaw = targetYaw(state.facing);
  stage.rig.pitch = 0;
  stage.applyRig();

  hud.setLevel(state.level);
  hud.setMessage("방향키로 움직이고 마우스로 둘러보세요. M 키로俯瞰 시점입니다.");
  refreshStatus();
  hud.drawMinimap(state.maze, state);
}

function refreshStatus() {
  hud.setStatus({
    steps: state.steps,
    par: state.par,
    keys: maskToKeys(state.heldMask, state.maze).length,
    keysTotal: state.maze?.keys.length ?? 0,
    time: state.elapsed,
  });
}

function tryMove() {
  if (state.phase !== "play") return false;
  const result = resolveMove(state.cell, state.facing, state.desired, state.maze, state.heldMask);
  if (!result.moved) return false;

  state.cell = result.cell;
  state.facing = result.facing;
  state.steps += 1;
  state.visited.add(state.cell);

  for (const key of state.maze.keys) {
    if (key.cell !== state.cell) continue;
    if (state.heldMask & (1 << key.index)) continue;
    state.heldMask |= 1 << key.index;
    state.view.collectKey(key.id);
    const gate = state.maze.gates.find((entry) => entry.keyIndex === key.index);
    if (gate) state.view.openGate(gate.id);
    const held = maskToKeys(state.heldMask, state.maze).length;
    showToast(`열쇠를 주웠습니다 (${held} / ${state.maze.keys.length})`);
  }

  if (state.cell === state.maze.exit) finishLevel();
  return true;
}

function finishLevel() {
  if (state.phase === "done") return;
  state.phase = "done";
  const result = evaluateSteps(state.steps, state.par, state.level);
  const score = scoreForSteps(state.steps, state.par);
  const extra = state.steps - state.par;
  const hasNext = state.levelIndex + 1 < LEVELS.length;

  progress.record(state.level.id, { stars: result.stars, score });

  if (!hasNext) {
    showEndingScreen({
      progress,
      levels: LEVELS,
      title: "마지막 미로까지 탈출했어요!",
      rows: [
        ["마지막 단계", state.level.label],
        ["걸은 길", `${state.steps} 칸`],
        ["사용 시간", `${Math.floor(state.elapsed / 60)}분 ${Math.floor(state.elapsed % 60)}초`],
      ],
      onFirst: () => gotoLevel(0),
      onLevels: openLevels,
    });
    refreshStatus();
    return;
  }

  const actions = [
    { id: "next", label: "다음 단계", primary: true, pulse: true },
    { id: "retry", label: "다시 하기" },
    { id: "levels", label: "레벨 선택" },
  ];

  showResult({
    kicker: "탈출 성공",
    title: state.level.label,
    stars: result.stars,
    score,
    rows: [
      ["걸은 길", `${state.steps} 칸`],
      ["최적 경로", `${state.par} 칸`],
      ["사용 시간", `${Math.floor(state.elapsed / 60)}분 ${Math.floor(state.elapsed % 60)}초`],
    ],
    detail:
      extra > 0
        ? `최적 경로보다 ${extra}칸 더 걸었습니다. 분기 앞에서 방향을 미리 정하면 짧아집니다.`
        : "최적 경로와 똑같이 걸어 나왔습니다.",
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
      stars: progress.levelState(level.id)?.stars ?? 0,
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

function toggleOverview() {
  state.overview = !state.overview;
  if (state.overview) {
    stage.setMode("overview");
    const extent = extentOf(state.maze);
    stage.camera.position.set(0, extent * 1.9, extent * 0.08);
    stage.camera.lookAt(0, 0, 0);
    hud.setMessage("俯瞰 시점입니다. M 키로 다시 돌아갑니다.");
  } else {
    stage.setMode("play");
    stage.applyRig();
    hud.setMessage("1인칭 시점으로 돌아왔습니다.");
  }
}

/** 자동 검사용. BFS 최적 경로를 따라 실제로 이동한다. */
function solve() {
  if (state.phase !== "play") return false;
  const route = shortestRoute(state.maze);
  if (!route.reachable) return false;
  state.route = route.path;
  state.routeIndex = 0;
  state.solving = true;
  return true;
}

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const direction = KEY_TO_DIRECTION[event.code];
  if (direction !== undefined) {
    event.preventDefault();
    state.desired = direction;
    state.solving = false;
    return;
  }
  if (event.code === "KeyM") {
    toggleOverview();
  } else if (event.code === "KeyR") {
    loadLevel(state.levelIndex);
  }
});

function updateCamera(delta) {
  if (state.phase !== "play" && !state.solving) return;
  const target = cellToWorld(state.maze, state.cell);
  const follow = state.solving ? 1 : 1 - Math.pow(0.0015, delta);
  stage.rig.x += (target.x - stage.rig.x) * follow;
  stage.rig.z += (target.z - stage.rig.z) * follow;

  const desired = targetYaw(state.facing);
  let deltaYaw = desired - stage.rig.yaw;
  while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
  while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
  stage.rig.yaw += deltaYaw * follow;
  stage.applyRig();
}

function update(delta) {
  state.elapsed += delta;
  state.view?.update(state.elapsed);

  if (state.phase === "play") {
    if (state.solving) {
      const next = state.route[state.routeIndex + 1];
      if (next !== undefined) {
        const direction = directionBetween(state.maze, state.cell, next);
        if (direction >= 0) {
          state.desired = direction;
          if (tryMove()) state.routeIndex += 1;
        }
      }
    } else if (state.desired >= 0) {
      state.moveTimer += delta;
      if (state.moveTimer >= STEP_SECONDS) {
        state.moveTimer -= STEP_SECONDS;
        tryMove();
      }
    }
  }

  updateCamera(delta);

  state.mapTimer += delta;
  if (state.mapTimer > 0.12) {
    state.mapTimer = 0;
    refreshStatus();
    hud.drawMinimap(state.maze, state);
  }
}

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  state.invariantProblems = checkInvariants({
    maze: state.maze,
    cell: state.cell,
    heldMask: state.heldMask,
    rig: stage.rig,
    steps: state.steps,
    par: state.par,
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
    cell: state.cell,
    steps: state.steps,
    par: state.par,
    keys: maskToKeys(state.heldMask, state.maze).length,
    keysTotal: state.maze.keys.length,
    time: Math.round(state.elapsed),
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
    const player = cellToWorld(state.maze, state.cell);
    push("player", new THREE.Vector3(player.x, EYE_HEIGHT_M, player.z));
    const exit = cellToWorld(state.maze, state.maze.exit);
    push("exit", new THREE.Vector3(exit.x, 1, exit.z));
    for (const key of state.maze.keys) {
      const point = cellToWorld(state.maze, key.cell);
      push(key.id, new THREE.Vector3(point.x, 0.9, point.z));
    }
    return entries;
  },
  setView: views.setView,
  setChrome: (options = {}) => {
    if (options.labels === false) {
      state.view?.keyMeshes.forEach((mesh) => (mesh.visible = false));
    }
    if (options.labels === true) {
      state.view?.keyMeshes.forEach((mesh) => (mesh.visible = true));
    }
  },
  solve,
  loadLevel,
  levelIndex: () => state.levelIndex,
};
