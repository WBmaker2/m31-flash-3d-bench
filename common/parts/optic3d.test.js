import { describe, expect, it } from "vitest";
import {
  DIRECTIONS,
  MIRROR_NORMAL,
  ORIENTATIONS,
  countReflections,
  key,
  reflect,
  solveMirrors,
  traceBeam,
} from "./optic3d.js";

describe("반사 법칙", () => {
  it("거울과 나란히 가면 방향이 그대로다", () => {
    const result = reflect(DIRECTIONS.east, { x: 0, y: 0, z: 1 });
    expect(result.x).toBeCloseTo(1, 12);
    expect(result.z).toBeCloseTo(0, 12);
  });

  it("정면으로 부딪히면 되돌아간다", () => {
    const result = reflect(DIRECTIONS.east, { x: 1, y: 0, z: 0 });
    expect(result.x).toBeCloseTo(-1, 12);
    expect(result.z).toBeCloseTo(0, 12);
  });

  it("입사각과 반사각이 같다", () => {
    const normal = MIRROR_NORMAL.slash;
    const incoming = { x: 1, y: 0, z: 0 };
    const result = reflect(incoming, normal);
    const dotBefore = Math.abs(incoming.x * normal.x + incoming.z * normal.z);
    const dotAfter = Math.abs(result.x * normal.x + result.z * normal.z);
    expect(dotAfter).toBeCloseTo(dotBefore, 12);
  });

  it("반사 벡터의 길이가 1 이다", () => {
    const result = reflect(DIRECTIONS.east, MIRROR_NORMAL.slash);
    expect(Math.hypot(result.x, result.y, result.z)).toBeCloseTo(1, 12);
  });

  it("거울의 법선은 단위 벡터다", () => {
    for (const orientation of ORIENTATIONS) {
      const normal = MIRROR_NORMAL[orientation];
      expect(Math.hypot(normal.x, normal.y, normal.z)).toBeCloseTo(1, 12);
    }
  });
});

describe("빛 추적", () => {
  it("거울이 없으면 밖으로 나간다", () => {
    const result = traceBeam({
      start: { col: 0, row: 0 },
      direction: "east",
      mirrors: new Map(),
      size: 5,
      target: { col: 4, row: 4 },
    });
    expect(result.reached).toBe(false);
    expect(result.escaped).toBe(true);
  });

  it("거울을 만나면 꺾인다", () => {
    const mirrors = new Map([[key(2, 0), "backslash"]]);
    const result = traceBeam({
      start: { col: 0, row: 0 },
      direction: "east",
      mirrors,
      size: 5,
      target: { col: 2, row: 2 },
    });
    expect(result.reflections).toBe(1);
    expect(result.reached).toBe(true);
  });

  it("경로가 연속되어 있다", () => {
    const mirrors = new Map([[key(2, 0), "backslash"]]);
    const result = traceBeam({
      start: { col: 0, row: 0 },
      direction: "east",
      mirrors,
      size: 6,
    });
    for (let i = 1; i < result.path.length; i += 1) {
      const a = result.path[i - 1];
      const b = result.path[i];
      expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row)).toBe(1);
    }
  });

  it("반사 횟수를 센다", () => {
    const mirrors = new Map([[key(2, 0), "backslash"], [key(2, 4), "slash"]]);
    const result = traceBeam({
      start: { col: 0, row: 0 },
      direction: "east",
      mirrors,
      size: 6,
    });
    expect(countReflections(result.path, mirrors)).toBe(result.reflections);
  });

  it("해답을 찾는다", () => {
    const mirrors = new Map([[key(2, 0), "backslash"]]);
    const solution = solveMirrors({
      start: { col: 0, row: 0 },
      direction: "east",
      mirrors,
      size: 5,
      target: { col: 2, row: 4 },
    });
    expect(solution).not.toBeNull();
    const result = traceBeam({
      start: { col: 0, row: 0 },
      direction: "east",
      mirrors: solution,
      size: 5,
      target: { col: 2, row: 4 },
    });
    expect(result.reached).toBe(true);
  });
});
