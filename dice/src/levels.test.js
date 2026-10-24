import { describe, expect, it } from "vitest";
import { advancePath } from "../../common/parts/board3d.js";
import {
  BOARDS,
  answerStep,
  boardById,
  boardIndexById,
  createGame,
  gameState,
  moveStep,
  rollStep,
} from "./levels.js";

describe("보드 목록", () => {
  it("보드가 3종이다", () => {
    expect(BOARDS).toHaveLength(3);
  });

  it("아이디로 보드를 찾는다", () => {
    expect(boardById("b02")?.label).toBe("뱀과 사다리");
    expect(boardById("없는 것")).toBeNull();
    expect(boardIndexById("b03")).toBe(2);
  });

  it("점프 위치가 보드 안에 있다", () => {
    for (const board of BOARDS) {
      const total = board.cols * board.rows;
      for (const [from, to] of Object.entries(board.jumps)) {
        expect(Number(from)).toBeGreaterThan(0);
        expect(Number(from)).toBeLessThan(total);
        expect(to).toBeGreaterThan(0);
        expect(to).toBeLessThan(total);
      }
    }
  });

  it("플레이어가 둘이다", () => {
    for (const board of BOARDS) {
      expect(board.players).toHaveLength(2);
    }
  });
});

describe("새 게임", () => {
  it("두 말이 출발 칸에서 시작한다", () => {
    const game = createGame("b01", 1);
    expect(game.players[0].position).toBe(0);
    expect(game.players[1].position).toBe(0);
    expect(game.turn).toBe(0);
    expect(game.phase).toBe("idle");
  });

  it("같은 시드면 같은 게임이 된다", () => {
    const a = createGame("b01", 42);
    const b = createGame("b01", 42);
    const first = [];
    const second = [];
    for (let i = 0; i < 10; i += 1) {
      first.push(rollStep(a), moveStep(a)?.index, answerStep(a, a.question?.answer ?? 0).correct);
      second.push(rollStep(b), moveStep(b)?.index, answerStep(b, b.question?.answer ?? 0).correct);
    }
    expect(first).toEqual(second);
  });
});

describe("턴 진행", () => {
  it("굴리면 1 부터 6 사이 값이 나온다", () => {
    const game = createGame("b01", 3);
    const value = rollStep(game);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
    expect(game.phase).toBe("rolling");
  });

  it("굴리는 중에는 또 굴릴 수 없다", () => {
    const game = createGame("b01", 3);
    rollStep(game);
    const again = rollStep(game);
    expect(again).toBe(game.value);
  });

  it("말이 정확히 값만큼 이동한다", () => {
    const game = createGame("b01", 3);
    const value = rollStep(game);
    const result = moveStep(game);
    expect(result.landedIndex).toBe(value);
  });

  it("질문이 나온다", () => {
    const game = createGame("b01", 3);
    rollStep(game);
    moveStep(game);
    expect(game.phase).toBe("question");
    expect(game.question.answer).toBe(game.question.a + game.question.b);
    expect(game.question.choices).toHaveLength(3);
  });

  it("맞히면 점수를 얻고 한 칸 더 간다", () => {
    const game = createGame("b01", 3);
    rollStep(game);
    const before = moveStep(game).index;
    const expected = advancePath({
      path: game.path,
      jumps: game.board.jumps,
      from: before,
      steps: 1,
    }).index;
    const result = answerStep(game, game.question.answer);
    expect(result.correct).toBe(true);
    expect(game.players[0].score).toBe(1);
    expect(game.players[0].position).toBe(expected);
  });

  it("틀리면 점수가 없고 차례가 넘어간다", () => {
    const game = createGame("b01", 3);
    rollStep(game);
    moveStep(game);
    const wrong = game.question.choices.find((choice) => choice !== game.question.answer);
    const result = answerStep(game, wrong);
    expect(result.correct).toBe(false);
    expect(game.players[0].score).toBe(0);
    expect(game.turn).toBe(1);
    expect(game.phase).toBe("idle");
  });

  it("차례가 번갈아 간다", () => {
    const game = createGame("b01", 3);
    expect(game.turn).toBe(0);
    rollStep(game);
    moveStep(game);
    answerStep(game, game.question.answer);
    expect(game.turn).toBe(1);
    rollStep(game);
    moveStep(game);
    answerStep(game, game.question.answer);
    expect(game.turn).toBe(0);
  });

  it("두 말은 서로 다른 칸에 있다", () => {
    const game = createGame("b01", 3);
    rollStep(game);
    moveStep(game);
    answerStep(game, game.question.answer);
    rollStep(game);
    moveStep(game);
    answerStep(game, game.question.answer);
    expect(game.players[0].position).not.toBe(game.players[1].position);
  });

  it("결승점에 닿으면 승자가 생긴다", () => {
    const game = createGame("b01", 3);
    let guard = 0;
    while (game.phase !== "over" && guard < 200) {
      guard += 1;
      if (game.phase === "idle") rollStep(game);
      if (game.phase === "rolling") moveStep(game);
      if (game.phase === "question") answerStep(game, game.question.answer);
    }
    expect(game.phase).toBe("over");
    expect(game.winner).toBeGreaterThanOrEqual(0);
    expect(game.players[game.winner].position).toBe(game.path.length - 1);
  });

  it("승리하면 더 굴리지 않는다", () => {
    const game = createGame("b01", 3);
    let guard = 0;
    while (game.phase !== "over" && guard < 200) {
      guard += 1;
      if (game.phase === "idle") rollStep(game);
      if (game.phase === "rolling") moveStep(game);
      if (game.phase === "question") answerStep(game, game.question.answer);
    }
    const rounds = game.rounds;
    rollStep(game);
    expect(game.rounds).toBe(rounds);
  });
});

describe("게임 상태", () => {
  it("상태를 숫자로 읽어 낸다", () => {
    const game = createGame("b02", 9);
    rollStep(game);
    moveStep(game);
    const state = gameState(game);
    expect(state.board).toBe("b02");
    expect(state.phase).toBe("question");
    expect(state.positions).toHaveLength(2);
    expect(state.scores).toHaveLength(2);
  });
});
