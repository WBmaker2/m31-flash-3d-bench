import { describe, expect, it } from "vitest";
import {
  LEVELS,
  evaluateLevel,
  levelById,
  levelGeometry,
  levelIndexById,
  levelPar,
  levelSolution,
  missionText,
  toWeights,
} from "./levels.js";

describe("레벨 목록", () => {
  it("레벨이 8종이다", () => {
    expect(LEVELS).toHaveLength(8);
  });

  it("아이디로 레벨을 찾는다", () => {
    expect(levelById("b01")?.label).toBe("첫 균형");
    expect(levelById("없는 것")).toBeNull();
    expect(levelIndexById("b08")).toBe(7);
  });

  it("추 종류마다 목표 무게가 가능하다", () => {
    for (const level of LEVELS) {
      expect(level.masses.length).toBeGreaterThan(1);
      expect(level.targetMass).toBeGreaterThan(0);
    }
  });
});

describe("레벨 구조", () => {
  it("받침대 위치가 홈 안에 있다", () => {
    for (const level of LEVELS) {
      const geometry = levelGeometry(level);
      expect(geometry.slots[level.fulcrumSlot]).toBeDefined();
      expect(geometry.fulcrumX).toBeCloseTo(geometry.slots[level.fulcrumSlot].x, 12);
    }
  });

  it("기준 해법의 추가 모두 존재한다", () => {
    for (const level of LEVELS) {
      const geometry = levelGeometry(level);
      for (const item of level.reference) {
        expect(geometry.slots.some((slot) => slot.id === item.slot)).toBe(true);
        expect(level.masses).toContain(item.mass);
      }
    }
  });
});

describe("기준 해법", () => {
  it("모든 레벨을 기준 해법으로 클리어한다", () => {
    for (const level of LEVELS) {
      const result = evaluateLevel(level, level.reference);
      expect(result.cleared, `${level.id} 기준 해법이 실패했습니다`).toBe(true);
      expect(result.level).toBe(true);
      expect(result.massOk).toBe(true);
      expect(result.stars).toBe(3);
    }
  });

  it("최소 추 개수가 par 와 같다", () => {
    for (const level of LEVELS) {
      expect(levelPar(level), `${level.id} 의 par 이 최소 개수와 다릅니다`).toBe(level.par);
    }
  });

  it("계산한 해도 통과한다", () => {
    for (const level of LEVELS) {
      const solution = levelSolution(level);
      expect(solution).not.toBeNull();
      const result = evaluateLevel(level, solution);
      expect(result.cleared).toBe(true);
    }
  });
});

describe("미션 판정", () => {
  it("아무것도 놓지 않으면 실패다", () => {
    const result = evaluateLevel(LEVELS[0], []);
    expect(result.cleared).toBe(false);
    expect(result.stars).toBe(0);
  });

  it("수평만 맞으면 별 1개다", () => {
    const level = LEVELS[0];
    const result = evaluateLevel(level, [
      { slot: "s3", mass: 1 },
      { slot: "s5", mass: 1 },
    ]);
    expect(result.level).toBe(true);
    expect(result.massOk).toBe(false);
    expect(result.stars).toBe(1);
  });

  it("많이 놓으면 별은 2개다", () => {
    const level = LEVELS[0];
    const result = evaluateLevel(level, [
      { slot: "s2", mass: 1 },
      { slot: "s3", mass: 1 },
      { slot: "s5", mass: 1 },
      { slot: "s6", mass: 1 },
    ]);
    expect(result.cleared).toBe(true);
    expect(result.used).toBeGreaterThan(level.par);
    expect(result.stars).toBe(2);
  });

  it("무게중심이 받침대와 같으면 수평이다", () => {
    const level = LEVELS[0];
    const geometry = levelGeometry(level);
    const weights = toWeights(geometry, [
      { slot: "s3", mass: 1 },
      { slot: "s5", mass: 1 },
    ]);
    expect(weights[0].x).toBeCloseTo(-geometry.fulcrumX - 0.11, 12);
    expect(weights[1].x).toBeCloseTo(-geometry.fulcrumX + 0.11, 12);
  });
});

describe("미션 문구", () => {
  it("목표 무게가 들어 있다", () => {
    expect(missionText(LEVELS[0])).toContain("4kg");
  });
});
