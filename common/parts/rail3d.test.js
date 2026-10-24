import { describe, expect, it } from "vitest";
import {
  EAST,
  NORTH,
  SOUTH,
  WEST,
  cellKey,
  connects,
  findPath,
  piecePorts,
  requiredPieces,
  step,
} from "./rail3d.js";

describe("조각 연결", () => {
  it("직선 조각은 반대쪽을 이룬다", () => {
    expect(piecePorts("straight", 0)).toEqual([NORTH, SOUTH]);
    expect(piecePorts("straight", 1)).toEqual([EAST, WEST]);
  });

  it("곡선 조각은 이웃한 방향을 이룬다", () => {
    expect(piecePorts("curve", 0)).toEqual([NORTH, EAST]);
    expect(piecePorts("curve", 1)).toEqual([EAST, SOUTH]);
    expect(piecePorts("curve", 2)).toEqual([SOUTH, WEST]);
    expect(piecePorts("curve", 3)).toEqual([WEST, NORTH]);
  });

  it("회전해도 방향은 두 개다", () => {
    for (let i = 0; i < 4; i += 1) {
      expect(piecePorts("curve", i)).toHaveLength(2);
      expect(piecePorts("straight", i)).toHaveLength(2);
    }
  });

  it("맞닿은 조각이 연결된다", () => {
    expect(connects({ kind: "straight", orientation: 1 }, { kind: "straight", orientation: 1 })).toBe(true);
    expect(connects({ kind: "straight", orientation: 1 }, { kind: "straight", orientation: 0 })).toBe(false);
  });
});

describe("이동", () => {
  it("방향으로 한 칸 간다", () => {
    expect(step(1, 1, NORTH)).toEqual({ col: 1, row: 0 });
    expect(step(1, 1, EAST)).toEqual({ col: 2, row: 1 });
  });
});

describe("경로 찾기", () => {
  const grid = new Map([
    ["0,0", { kind: "straight", orientation: 1 }],
    ["1,0", { kind: "straight", orientation: 1 }],
    ["2,0", { kind: "curve", orientation: 1 }],
    ["2,1", { kind: "straight", orientation: 0 }],
  ]);

  it("이어진 경로를 찾는다", () => {
    const path = findPath({ grid, size: 4, start: { col: 0, row: 0 }, goal: { col: 2, row: 1 } });
    expect(path).toHaveLength(4);
    expect(path[3]).toEqual({ col: 2, row: 1 });
  });

  it("이어지지 않으면 null 이다", () => {
    const broken = new Map([["0,0", { kind: "straight", orientation: 1 }]]);
    expect(findPath({ grid: broken, size: 4, start: { col: 0, row: 0 }, goal: { col: 2, row: 1 } })).toBeNull();
  });

  it("경로의 칸은 연속되어 있다", () => {
    const path = findPath({ grid, size: 4, start: { col: 0, row: 0 }, goal: { col: 2, row: 1 } });
    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1];
      const b = path[i];
      expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row)).toBe(1);
    }
  });
});

describe("필요한 조각 수", () => {
  it("빈 칸 수를 센다", () => {
    const level = {
      size: 5,
      start: { col: 0, row: 0 },
      goal: { col: 2, row: 0 },
      fixed: [{ col: 0, row: 0, kind: "straight", orientation: 1 }],
    };
    // 최단 경로 3칸 중 시작 칸은 이미 놓여 있고 도착역에는 조각이 필요 없다.
    expect(requiredPieces(level)).toBe(1);
  });

  it("칸 번호 키를 만든다", () => {
    expect(cellKey(2, 3)).toBe("2,3");
  });
});
