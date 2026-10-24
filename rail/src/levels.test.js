import { describe, expect, it } from "vitest";
import { cellKey, findPath } from "../../common/parts/rail3d.js";
import { LEVELS, evaluateLevel, levelById, levelIndexById, levelGrid, levelPar } from "./levels.js";

describe("레벨 목록", () => {
  it("레벨이 8종이다", () => {
    expect(LEVELS).toHaveLength(8);
  });

  it("아이디로 레벨을 찾는다", () => {
    expect(levelById("r01")?.label).toBe("첫 선로");
    expect(levelById("없는 것")).toBeNull();
    expect(levelIndexById("r08")).toBe(7);
  });

  it("시작과 도착이 판 안에 있다", () => {
    for (const level of LEVELS) {
      expect(level.start.col).toBeGreaterThanOrEqual(0);
      expect(level.goal.col).toBeLessThan(level.size);
      expect(level.goal.row).toBeLessThan(level.size);
    }
  });
});

describe("최소 조각 수", () => {
  it("모든 레벨이 완성 가능하다", () => {
    for (const level of LEVELS) {
      expect(levelPar(level), `${level.id} 를 완성할 수 없습니다`).not.toBe(Infinity);
    }
  });

  it("par 가 정해져 있다", () => {
    for (const level of LEVELS) {
      expect(level.par).toBeGreaterThan(0);
      expect(level.par).toBeLessThan(level.size * level.size);
    }
  });
});

describe("미션 판정", () => {
  it("아무것도 놓지 않으면 실패다", () => {
    const level = LEVELS[0];
    const result = evaluateLevel(level, []);
    expect(result.cleared).toBe(false);
    expect(result.stars).toBe(0);
  });

  it("선로를 놓으면 길이 열린다", () => {
    const level = LEVELS[0];
    const placement = [
      { col: 1, row: 2, kind: "straight", orientation: 1 },
      { col: 2, row: 2, kind: "straight", orientation: 1 },
      { col: 3, row: 2, kind: "straight", orientation: 1 },
      { col: 4, row: 2, kind: "straight", orientation: 1 },
    ];
    const result = evaluateLevel(level, placement);
    expect(result.cleared).toBe(true);
    expect(result.path).not.toBeNull();
  });

  it("놓인 선로가 격자에 반영된다", () => {
    const level = LEVELS[0];
    const grid = levelGrid(level, [{ col: 1, row: 2, kind: "curve", orientation: 2 }]);
    expect(grid.has(cellKey(1, 2))).toBe(true);
    expect(grid.get(cellKey(0, 2)).kind).toBe("straight");
  });

  it("완성하면 별 3개다", () => {
    const level = LEVELS[0];
    const placement = [
      { col: 1, row: 2, kind: "straight", orientation: 1 },
      { col: 2, row: 2, kind: "straight", orientation: 1 },
      { col: 3, row: 2, kind: "straight", orientation: 1 },
      { col: 4, row: 2, kind: "straight", orientation: 1 },
    ];
    const result = evaluateLevel(level, placement);
    expect(result.stars).toBe(3);
  });
});
