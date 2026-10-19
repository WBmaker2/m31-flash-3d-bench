import { describe, expect, it } from "vitest";
import { LEVELS, createSession } from "./session.js";
import { TARGETS } from "./chemistry.js";

describe("분자 레벨", () => {
  it("레벨이 2개다", () => {
    expect(LEVELS).toHaveLength(2);
  });

  it("레벨이 참조하는 목표가 모두 실재한다", () => {
    for (const level of LEVELS) {
      expect(level.targets.length).toBeGreaterThan(0);
      for (const id of level.targets) {
        expect(TARGETS.some((target) => target.id === id)).toBe(true);
      }
    }
  });

  it("심화 레벨이 기초보다 많다", () => {
    expect(LEVELS[1].targets.length).toBeGreaterThan(LEVELS[0].targets.length);
  });
});

describe("분자 세션", () => {
  it("정답을 맞히면 점수가 오르고 다음 문제로 넘어간다", () => {
    const session = createSession(LEVELS[0]);
    const first = session.current;
    const result = session.answer(true);
    expect(result.correct).toBe(true);
    expect(session.score).toBe(100);
    expect(session.index).toBe(1);
    expect(session.current).not.toBe(first);
  });

  it("연속 정답이 늘수록 보너스가 커진다", () => {
    const session = createSession(LEVELS[1]);
    session.answer(true);
    const afterOne = session.score;
    session.answer(true);
    expect(session.score).toBeGreaterThan(afterOne + 100);
  });

  it("틀리면 연속 정답이 끊긴다", () => {
    const session = createSession(LEVELS[0]);
    session.answer(true);
    session.answer(false);
    expect(session.streak).toBe(0);
    expect(session.wrong).toBe(1);
  });

  it("오답 패널티만큼 시간이 줄어든다", () => {
    const session = createSession(LEVELS[1]);
    const before = session.timeLeft;
    session.answer(false);
    expect(session.timeLeft).toBe(before - LEVELS[1].wrongPenalty);
  });

  it("시간이 다 지나면 0에서 멈춘다", () => {
    const session = createSession(LEVELS[0]);
    session.tick(1000);
    expect(session.timeLeft).toBe(0);
  });

  it("문제를 다 맞히면 끝난다", () => {
    const session = createSession(LEVELS[0]);
    for (let index = 0; index < LEVELS[0].targets.length; index += 1) session.answer(true);
    expect(session.finished).toBe(true);
    expect(session.current).toBe(null);
  });

  it("끝난 뒤에는 더 받지 않는다", () => {
    const session = createSession(LEVELS[0]);
    for (let index = 0; index < LEVELS[0].targets.length; index += 1) session.answer(true);
    const result = session.answer(true);
    expect(result.accepted).toBe(false);
  });

  it("오답이 없으면 3스타", () => {
    const session = createSession(LEVELS[0]);
    for (let index = 0; index < LEVELS[0].targets.length; index += 1) session.answer(true);
    expect(session.stars()).toBe(3);
  });

  it("오답이 있으면 별점이 낮아진다", () => {
    const session = createSession(LEVELS[0]);
    session.answer(false);
    for (let index = 1; index < LEVELS[0].targets.length; index += 1) session.answer(true);
    expect(session.stars()).toBeLessThan(3);
  });

  it("시간 보너스는 남은 시간에 비례한다", () => {
    const session = createSession(LEVELS[0]);
    expect(session.timeBonus()).toBe(Math.round(LEVELS[0].timeLimit * 10));
  });
});
