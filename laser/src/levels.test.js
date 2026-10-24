import { describe, expect, it } from "vitest";
import {
  LEVELS,
  evaluateLevel,
  levelById,
  levelIndexById,
  levelPar,
  levelSolution,
  mirrorMap,
  traceLevel,
} from "./levels.js";
import { key, traceBeam } from "../../common/parts/optic3d.js";

describe("레벨 목록", () => {
  it("레벨이 8종이다", () => {
    expect(LEVELS).toHaveLength(8);
  });

  it("아이디로 레벨을 찾는다", () => {
    expect(levelById("l01")?.label).toBe("첫 반사");
    expect(levelById("없는 것")).toBeNull();
    expect(levelIndexById("l08")).toBe(7);
  });
});

describe("해답", () => {
  it("모든 레벨에 해답이 있다", () => {
    for (const level of LEVELS) {
      expect(levelSolution(level), `${level.id} 에 해답이 없습니다`).not.toBeNull();
    }
  });

  it("해답으로 빛이 목표에 닿는다", () => {
    for (const level of LEVELS) {
      const solution = levelSolution(level);
      const trace = traceLevel(level, solution);
      expect(trace.reached, `${level.id} 해답이 목표에 닿지 않습니다`).toBe(true);
    }
  });

  it("처음 상태로는 목표에 닿지 않는다", () => {
    for (const level of LEVELS) {
      const trace = traceLevel(level, mirrorMap(level));
      expect(trace.reached, `${level.id} 는 거울을 안 바꿔도 풀립니다`).toBe(false);
    }
  });

  it("거울을 하나도 안 써도 닿지 않는다", () => {
    for (const level of LEVELS) {
      const trace = traceBeam({
        start: { col: level.emitter.col, row: level.emitter.row },
        direction: level.emitter.direction,
        mirrors: new Map(),
        size: level.size,
        target: level.target,
      });
      expect(trace.reached).toBe(false);
    }
  });

  it("최소 뒤집기 횟수가 정해져 있다", () => {
    for (const level of LEVELS) {
      const par = levelPar(level);
      expect(Number.isInteger(par)).toBe(true);
      expect(par).toBeGreaterThan(0);
      expect(par).toBeLessThanOrEqual(level.mirrors.length);
    }
  });

  it("해답으로 바꾸면 par 번이면 통과한다", () => {
    for (const level of LEVELS) {
      const solution = levelSolution(level);
      const initial = mirrorMap(level);
      let flips = 0;
      for (const [cell, orientation] of solution) {
        if (initial.get(cell) !== orientation) flips += 1;
      }
      const result = evaluateLevel(level, solution);
      expect(result.cleared).toBe(true);
      expect(result.stars).toBe(3);
      expect(flips).toBe(levelPar(level));
    }
  });
});

describe("미션 판정", () => {
  it("도달하지 못하면 별 0개다", () => {
    const level = LEVELS[0];
    const result = evaluateLevel(level, mirrorMap(level));
    expect(result.cleared).toBe(false);
    expect(result.stars).toBe(0);
  });

  it("거울이 판에 다 있다", () => {
    for (const level of LEVELS) {
      for (const mirror of level.mirrors) {
        expect(mirrorMap(level).has(key(mirror.col, mirror.row))).toBe(true);
      }
    }
  });
});
