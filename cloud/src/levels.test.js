import { describe, expect, it } from "vitest";
import { JUMP_HEIGHT, JUMP_REACH } from "../../common/parts/platform3d.js";
import { LEVELS, checkLevel, evaluateLevel, gaps, levelById, levelIndexById } from "./levels.js";

describe("레벨 목록", () => {
  it("레벨이 8종이다", () => {
    expect(LEVELS).toHaveLength(8);
  });

  it("아이디로 레벨을 찾는다", () => {
    expect(levelById("c01")?.label).toBe("첫 구름");
    expect(levelById("없는 것")).toBeNull();
    expect(levelIndexById("c08")).toBe(7);
  });
});

describe("도달 가능성", () => {
  it("모든 레벨이 도달 가능하다", () => {
    for (const level of LEVELS) {
      expect(checkLevel(level), `${level.id}: ${checkLevel(level).join(" / ")}`).toHaveLength(0);
    }
  });

  it("구름 간격이 점프 도달 거리 이내다", () => {
    for (const level of LEVELS) {
      for (const entry of gaps(level)) {
        expect(entry.gap).toBeLessThanOrEqual(JUMP_REACH + 1e-9);
      }
    }
  });

  it("높이 차가 점프 높이 이내다", () => {
    for (const level of LEVELS) {
      for (const entry of gaps(level)) {
        expect(entry.rise).toBeLessThanOrEqual(JUMP_HEIGHT + 1e-9);
      }
    }
  });

  it("구름이 5개 이상 있다", () => {
    for (const level of LEVELS) {
      expect(level.platforms.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("동전이 구름 사이에 있다", () => {
    for (const level of LEVELS) {
      expect(level.coins.length).toBe(level.platforms.length - 1);
      for (const coin of level.coins) {
        expect(Number.isFinite(coin.x)).toBe(true);
      }
    }
  });

  it("시작점과 결승점이 있다", () => {
    for (const level of LEVELS) {
      expect(level.start.x).toBe(level.platforms[0].x);
      expect(level.goal.x).toBeGreaterThan(level.start.x);
    }
  });
});

describe("미션 판정", () => {
  it("결승점에 닿으면 별 2개다", () => {
    const result = evaluateLevel(LEVELS[0], { reached: true, coins: 1, totalCoins: 4 });
    expect(result.cleared).toBe(true);
    expect(result.stars).toBe(2);
  });

  it("동전을 다 모으면 별 3개다", () => {
    const result = evaluateLevel(LEVELS[0], { reached: true, coins: 4, totalCoins: 4 });
    expect(result.stars).toBe(3);
  });

  it("동전만 모으면 별 1개다", () => {
    const result = evaluateLevel(LEVELS[0], { reached: false, coins: 2, totalCoins: 4 });
    expect(result.cleared).toBe(false);
    expect(result.stars).toBe(1);
  });

  it("아무것도 못 하면 별 0개다", () => {
    const result = evaluateLevel(LEVELS[0], { reached: false, coins: 0, totalCoins: 4 });
    expect(result.stars).toBe(0);
  });
});
