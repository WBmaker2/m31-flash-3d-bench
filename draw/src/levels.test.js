import { describe, expect, it } from "vitest";
import { cellKey, parsePicture } from "../../common/parts/draw3d.js";
import { LEVELS, evaluateLevel, levelById, levelColors, levelIndexById } from "./levels.js";

describe("레벨 목록", () => {
  it("레벨이 8종이다", () => {
    expect(LEVELS).toHaveLength(8);
  });

  it("아이디로 레벨을 찾는다", () => {
    expect(levelById("d01")?.label).toBe("하트");
    expect(levelById("없는 것")).toBeNull();
    expect(levelIndexById("d08")).toBe(7);
  });

  it("그림에 칸이 있다", () => {
    for (const level of LEVELS) {
      expect(parsePicture(level.rows).cells.length).toBeGreaterThan(8);
    }
  });

  it("쓰인 색이 있다", () => {
    for (const level of LEVELS) {
      expect(levelColors(level).length).toBeGreaterThan(0);
    }
  });
});

describe("미션 판정", () => {
  it("빈 배치는 0성이다", () => {
    const result = evaluateLevel(LEVELS[0], new Map());
    expect(result.rate).toBe(0);
    expect(result.stars).toBe(0);
  });

  it("완전히 맞으면 3성이다", () => {
    const placement = new Map();
    for (const cell of parsePicture(LEVELS[0].rows).cells) {
      placement.set(cellKey(cell.col, cell.row), cell.color);
    }
    const result = evaluateLevel(LEVELS[0], placement);
    expect(result.rate).toBe(1);
    expect(result.stars).toBe(3);
  });

  it("_half 맞으면 1성이다", () => {
    const cells = parsePicture(LEVELS[0].rows).cells;
    const placement = new Map();
    for (const cell of cells.slice(0, Math.floor(cells.length / 2))) {
      placement.set(cellKey(cell.col, cell.row), cell.color);
    }
    const result = evaluateLevel(LEVELS[0], placement);
    expect(result.rate).toBeGreaterThanOrEqual(0.5);
    expect(result.stars).toBe(1);
  });

  it("틀린 칸이 있으면 3성이 아니다", () => {
    const placement = new Map();
    for (const cell of parsePicture(LEVELS[0].rows).cells) {
      placement.set(cellKey(cell.col, cell.row), cell.color);
    }
    placement.set(cellKey(0, 0), "X");
    const result = evaluateLevel(LEVELS[0], placement);
    expect(result.extra).toBe(1);
    expect(result.stars).toBe(2);
  });
});
