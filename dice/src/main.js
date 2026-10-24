// 게임 진행과 화면 연결. 규칙은 levels.js 에 있고, 여기서는 상태를 들고
// 조작과 애니메이션을 화면에 연결한다.
import * as THREE from "three";
import { createStage, createViews } from "./stage.js";
import { createDiceView } from "./diceView.js";
import { createHud } from "./hud.js";
import { createControls } from "./controls.js";
import {
  BOARDS,
  answerStep,
  boardIndexById,
  createGame,
  gameState,
  moveStep,
  rollStep,
} from "./levels.js";
import { cellPosition, createRng } from "../../common/parts/board3d.js";
import { createRoll, rollHeight, rollQuaternion } from "../../common/parts/dice3d.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge } from "../../common/ui-kit.js";
import { createProgress } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";

const ROLL_DURATION = 0.9;
const STEP_DURATION = 0.12;
const HOP_HEIGHT = 0.09;

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const views = createViews(stage);
const view = createDiceView(stage.scene);
const badge = createInvariantBadge({ bottom: "150px" });

const progress = createProgress("dice", { levels: BOARDS.map((board) => ({ id: board.id, label: board.label })) });

const visualRng = createRng(999);

const state = {
  boardIndex: 0,
  game: null,
  roll: null,
  rollTime: 0,
  move: null,
  moveTime: 0,
  phase: "idle",
  invariantProblems: [],
  invariantTimer: 0,
};

const hud = createHud({
  onRoll: () => startRoll(),
  onChoice: (choice) => answer(choice),
  onLevels: () => openLevels(),
  onReset: () => loadBoard(state.boardIndex),
});

function boardCenter() {
  const path = state.game?.path ?? [];
  if (path.length === 0) return { x: 0, z: 0 };
  return cellPosition(Math.floor(path.length / 2), path, state.game.board.cellSize);
}

function refreshHud() {
  const game = state.game;
  if (!game) return;
  const player = game.players[game.turn];
  hud.setStats({ turnName: player.name, value: game.value });
  hud.setScores(game.players, game.turn);
}

function loadBoard(index) {
  state.boardIndex = Math.max(0, Math.min(BOARDS.length - 1, index));
  const board = BOARDS[state.boardIndex];
  state.game = createGame(board.id);
  state.roll = null;
  state.move = null;
  state.phase = "idle";

  view.setBoard(board, state.game.path);
  view.setTokens(state.game.players);
  state.game.players.forEach((player, index) => {
    view.setTokenPosition(index, player.position);
  });
  view.setDieVisible(true);
  view.setDiePosition(boardCenter().x, 0.063, boardCenter().z);
  view.setDieQuaternion(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0.3, 1, 0.2).normalize(), visualRng() * Math.PI * 2),
  );

  const span = board.cellSize * Math.max(board.cols, board.rows);
  stage.setFocus({ x: 0, y: 0.03, z: 0, radius: span * 0.62 });
  stage.resetView();

  hud.setBoard(board);
  hud.setQuestion(null);
  hud.setMessage(`${state.game.players[0].name} 의 차례예요. 주사위를 굴려 보세요.`);
  refreshHud();
}

function startRoll() {
  const game = state.game;
  if (!game || game.phase !== "idle") return;
  const value = rollStep(game);
  state.roll = createRoll({
    value,
    start: view.die ? view.die.quaternion.clone() : new THREE.Quaternion(),
    spinAngle: visualRng() * Math.PI * 2,
  });
  state.rollTime = 0;
  state.phase = "rolling";
  view.setDieVisible(true);
  hud.setQuestion(null);
  hud.setMessage("주사위를 굴리는 중이에요…");
  refreshHud();
}

function finishRoll() {
  const game = state.game;
  const player = game.players[game.turn];
  const from = player.position;
  const result = moveStep(game);

  const waypoints = [];
  for (let i = from + 1; i <= result.landedIndex; i += 1) waypoints.push(i);
  if (result.jumped) waypoints.push(result.index);

  state.move = { from, waypoints, time: 0, duration: Math.max(waypoints.length, 1) * STEP_DURATION };
  state.phase = "moving";
  if (result.jumped) hud.setMessage(`${player.name} 이 뱀과 사다리를 탔어요!`);
  else hud.setMessage(`${player.name} 이 ${game.value}칸 전진했어요.`);
}

function finishMove() {
  const game = state.game;
  view.setTokenPosition(game.turn, game.players[game.turn].position);
  if (game.phase === "over") {
    state.phase = "over";
    const winner = game.players[game.winner];
    progress.record(game.board.id, { stars: 3, score: winner.score });
    showResult({
      kicker: "승리",
      title: game.board.label,
      stars: 3,
      score: winner.score,
      rows: game.players.map((player) => [player.name, `${player.score}점`]),
      detail: `${winner.name} 이 결승점에 먼저 도착했어요!`,
      actions: [
        { id: "next", label: "다음 보드", primary: true, pulse: true },
        { id: "retry", label: "다시 하기" },
        { id: "levels", label: "보드 선택" },
      ],
    }).then((action) => {
      if (action === "next") loadBoard(state.boardIndex + 1 >= BOARDS.length ? 0 : state.boardIndex + 1);
      if (action === "retry") loadBoard(state.boardIndex);
      if (action === "levels") openLevels();
    });
    refreshHud();
    return;
  }
  state.phase = "question";
  hud.setQuestion(game.question);
  hud.setMessage("더하기 문제를 맞혀 보세요!");
  refreshHud();
}

function answer(choice) {
  const game = state.game;
  if (!game || game.phase !== "question" || !game.question) return;
  const playerIndex = game.turn;
  const result = answerStep(game, choice);
  const player = game.players[playerIndex];
  if (result.correct) {
    hud.setMessage(`정답이에요! ${player.name} 이 한 칸 더 가고 1점을 얻었어요.`);
    view.setTokenPosition(playerIndex, game.players[playerIndex].position);
  } else {
    hud.setMessage(`아쉬워요. 정답은 ${game.question?.answer ?? ""} 였어요.`, "bad");
  }
  state.phase = "idle";
  hud.setQuestion(null);
  refreshHud();
}

function openLevels() {
  showLevelSelect({
    title: "보드 선택",
    levels: BOARDS.map((board, index) => ({
      id: board.id,
      label: `${String(index + 1).padStart(2, "0")} · ${board.label}`,
      stars: progress.levelState(board.id)?.stars ?? 0,
      unlocked: progress.isUnlocked(board.id),
    })),
    footerActions: [{ id: "close", label: "닫기" }],
  }).then((result) => {
    if (result && result.levelId) {
      const index = boardIndexById(result.levelId);
      loadBoard(index);
    }
  });
}

createControls({
  roll: () => startRoll(),
  reset: () => loadBoard(state.boardIndex),
  choice: (index) => {
    const game = state.game;
    if (!game || game.phase !== "question" || !game.question) return;
    const choice = game.question.choices[index];
    if (choice !== undefined) answer(choice);
  },
});

function updateRoll(delta) {
  state.rollTime += delta;
  const progress01 = Math.min(1, state.rollTime / ROLL_DURATION);
  const quaternion = rollQuaternion(state.roll, progress01);
  view.setDieQuaternion(quaternion);
  const center = boardCenter();
  const hop = rollHeight(progress01, 0.16);
  view.setDiePosition(center.x, 0.018 + 0.045 + hop, center.z);
  if (progress01 >= 1) finishRoll();
}

function updateMove(delta) {
  state.moveTime += delta;
  const move = state.move;
  const progress01 = Math.min(1, state.moveTime / move.duration);
  const total = move.waypoints.length || 1;
  const scaled = progress01 * total;
  const segment = Math.min(Math.floor(scaled), total - 1);
  const local = scaled - segment;

  const fromIndex = segment === 0 ? move.from : move.waypoints[segment - 1];
  const toIndex = move.waypoints[segment];
  const path = state.game.path;
  const size = state.game.board.cellSize;
  const from = cellPosition(fromIndex, path, size);
  const to = cellPosition(toIndex, path, size);
  const x = from.x + (to.x - from.x) * local;
  const z = from.z + (to.z - from.z) * local;
  const y = Math.sin(Math.PI * local) * HOP_HEIGHT;
  view.setTokenPositionAt(state.game.turn, x, y, z);

  if (progress01 >= 1) finishMove();
}

function updateInvariants(delta) {
  state.invariantTimer += delta;
  if (state.invariantTimer < 0.5) return;
  state.invariantTimer = 0;
  const game = state.game;
  if (!game) return;
  const path = state.game.path;
  const size = state.game.board.cellSize;
  const expectedPositions = game.players.map((player, index) => {
    const cell = cellPosition(player.position, path, size);
    const offset = view.tokenOffset(index);
    // 칸 위치에 말을 살짝 벌려 두므로 그 오차까지 고려한다.
    return { x: cell.x + offset.x, z: cell.z + offset.z };
  });
  const tokenPositions = game.players.map((player, index) => {
    const token = view.tokens[index];
    return token ? { x: token.position.x, z: token.position.z } : null;
  });
  state.invariantProblems = checkInvariants({
    game,
    dieQuaternion: view.die?.quaternion,
    reportedValue: game.value,
    tokenPositions,
    expectedPositions,
    moving: state.phase === "moving",
    rolling: state.phase === "rolling",
  });
  badge.show(state.invariantProblems);
  if (state.invariantProblems.length > 0) {
    console.error(
      `[불변식 위반] ${state.invariantProblems.map((problem) => problem.message).join(" | ")}`,
    );
  }
}

stage.start((delta) => {
  if (state.phase === "rolling") updateRoll(delta);
  else if (state.phase === "moving") updateMove(delta);
  updateInvariants(delta);
});

loadBoard(0);

/** 자동 검사용. 굴리고 정답을 맞힌다. */
function solve() {
  const game = state.game;
  if (game.phase !== "idle") return false;
  const value = rollStep(game);
  state.roll = createRoll({
    value,
    start: new THREE.Quaternion(),
    spinAngle: visualRng() * Math.PI * 2,
  });
  view.setDieVisible(true);
  view.setDieQuaternion(state.roll.end);
  const center = boardCenter();
  view.setDiePosition(center.x, 0.063, center.z);
  finishRoll();
  finishMove();
  const player = game.players[game.turn];
  if (game.question) answer(game.question.answer);
  hud.setMessage(`${player.name} 이 ${value} 이 나왔어요.`);
  return true;
}

window.__gameApi = {
  getState: () => (state.game ? gameState(state.game) : null),
  getInvariants: () => state.invariantProblems,
  getScreenPositions: () => {
    const entries = [];
    const game = state.game;
    if (!game) return entries;
    game.players.forEach((player, index) => {
      const token = view.tokens[index];
      if (!token) return;
      const projected = token.position.clone().project(stage.camera);
      entries.push({
        id: `token-${index}`,
        x: projected.x,
        y: projected.y,
        visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
      });
    });
    if (view.die && view.die.visible) {
      const projected = view.die.position.clone().project(stage.camera);
      entries.push({
        id: "die",
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
  loadLevel: (index) => loadBoard(index),
  loadBoard,
  levelIndex: () => state.boardIndex,
};
