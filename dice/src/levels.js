// 보드 3종과 턴 상태 머신. 순수 계산이라 Node 에서 그대로 테스트된다.
import { advancePath, createRng, makeQuestion, rollDie, serpentinePath } from "../../common/parts/board3d.js";

export const BOARDS = [
  {
    id: "b01",
    label: "첫 보드",
    cols: 5,
    rows: 5,
    cellSize: 0.17,
    seed: 101,
    jumps: { 6: 14, 18: 11 },
    players: [
      { name: "빨간 말", color: 0xff6b5c },
      { name: "파란 말", color: 0x6fc9ff },
    ],
  },
  {
    id: "b02",
    label: "뱀과 사다리",
    cols: 5,
    rows: 6,
    cellSize: 0.17,
    seed: 202,
    jumps: { 5: 16, 12: 24, 20: 11, 22: 8, 26: 15, 28: 21 },
    players: [
      { name: "빨간 말", color: 0xff6b5c },
      { name: "파란 말", color: 0x6fc9ff },
    ],
  },
  {
    id: "b03",
    label: "긴 보드",
    cols: 6,
    rows: 6,
    cellSize: 0.16,
    seed: 303,
    jumps: { 4: 17, 11: 30, 16: 9, 22: 33, 25: 14, 29: 7, 31: 24, 34: 18 },
    players: [
      { name: "빨간 말", color: 0xff6b5c },
      { name: "파란 말", color: 0x6fc9ff },
    ],
  },
];

export function boardById(id) {
  return BOARDS.find((board) => board.id === id) ?? null;
}

export function boardIndexById(id) {
  return BOARDS.findIndex((board) => board.id === id);
}

/** 새 게임. 같은 시드면 같은 게임이 된다. */
export function createGame(boardId, seed) {
  const board = boardById(boardId) ?? BOARDS[0];
  const path = serpentinePath(board.cols, board.rows);
  return {
    board,
    path,
    rng: createRng(seed ?? board.seed),
    players: board.players.map((player) => ({ ...player, position: 0, score: 0 })),
    turn: 0,
    phase: "idle",
    value: 0,
    question: null,
    winner: -1,
    lastMove: null,
    rounds: 0,
  };
}

/** 주사위를 굴린다. 값만 정하고 자세는 화면 쪽에서 맞춘다. */
export function rollStep(game) {
  if (game.phase !== "idle") return game.value;
  game.value = rollDie(game.rng);
  game.phase = "rolling";
  game.rounds += 1;
  return game.value;
}

/** 말을 옮긴다. 뱀·사다리는 여기서 한 번 적용된다. */
export function moveStep(game) {
  if (game.phase !== "rolling") return null;
  const player = game.players[game.turn];
  const result = advancePath({
    path: game.path,
    jumps: game.board.jumps,
    from: player.position,
    steps: game.value,
  });
  player.position = result.index;
  game.lastMove = result;
  if (result.reachedGoal) {
    game.winner = game.turn;
    game.phase = "over";
    return result;
  }
  game.question = makeQuestion(game.rng);
  game.phase = "question";
  return result;
}

/** 정답을 고른다. 맞히면 한 칸 더 가고 점수를 얻는다. */
export function answerStep(game, choice) {
  if (game.phase !== "question" || !game.question) return { correct: false };
  const correct = choice === game.question.answer;
  const player = game.players[game.turn];
  if (correct) {
    player.score += 1;
    const bonus = advancePath({
      path: game.path,
      jumps: game.board.jumps,
      from: player.position,
      steps: 1,
    });
    player.position = bonus.index;
    game.lastMove = bonus;
    if (bonus.reachedGoal) {
      game.winner = game.turn;
      game.phase = "over";
      return { correct, winner: game.turn };
    }
  }
  game.turn = (game.turn + 1) % game.players.length;
  game.phase = "idle";
  game.question = null;
  return { correct, winner: -1 };
}

export function gameState(game) {
  return {
    board: game.board.id,
    phase: game.phase,
    turn: game.turn,
    value: game.value,
    winner: game.winner,
    rounds: game.rounds,
    positions: game.players.map((player) => player.position),
    scores: game.players.map((player) => player.score),
  };
}
