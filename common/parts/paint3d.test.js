import { describe, expect, it } from "vitest";
import {
  NEIGHBORS,
  VOXEL_SIZE,
  applyColor,
  buildAdjacency,
  countComponents,
  expandBoxes,
  floodFill,
  matchRate,
  parseVoxelKey,
  surfaceVoxels,
  voxelKey,
} from "./paint3d.js";

function box(x0, y0, z0, x1, y1, z1) {
  return { x0, y0, z0, x1, y1, z1 };
}

function build(boxes) {
  const { voxels, overlaps } = expandBoxes(boxes);
  const surface = surfaceVoxels(voxels);
  const adjacency = buildAdjacency(surface);
  return { voxels, overlaps, surface, adjacency };
}

describe("복셀 집합", () => {
  it("상자를 복셀로 편다", () => {
    const { voxels } = expandBoxes([{ partId: "a", box: box(0, 0, 0, 2, 1, 1) }]);
    expect(voxels.size).toBe(2);
    expect(voxels.get(voxelKey(1, 0, 0)).partId).toBe("a");
  });

  it("겹치는 복셀을 찾아낸다", () => {
    const { overlaps } = expandBoxes([
      { partId: "a", box: box(0, 0, 0, 2, 1, 1) },
      { partId: "b", box: box(1, 0, 0, 3, 1, 1) },
    ]);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].key).toBe(voxelKey(1, 0, 0));
  });

  it("안쪽 복셀은 표면이 아니다", () => {
    const { surface } = build([{ partId: "a", box: box(0, 0, 0, 3, 3, 3) }]);
    expect(surface.size).toBe(26);
  });

  it("복셀 키를 되읽는다", () => {
    expect(parseVoxelKey(voxelKey(-2, 5, 3))).toEqual({ x: -2, y: 5, z: 3 });
  });

  it("복셀 크기가 정해져 있다", () => {
    expect(VOXEL_SIZE).toBe(0.08);
    expect(NEIGHBORS).toHaveLength(6);
  });
});

describe("인접 그래프", () => {
  it("6방향으로만 이어진다", () => {
    const { adjacency } = build([{ partId: "a", box: box(0, 0, 0, 3, 1, 1) }]);
    expect(adjacency.get(voxelKey(1, 0, 0))).toHaveLength(2);
    expect(adjacency.get(voxelKey(0, 0, 0))).toHaveLength(1);
  });

  it("대칭이다", () => {
    const { adjacency } = build([{ partId: "a", box: box(0, 0, 0, 2, 2, 2) }]);
    for (const [key, list] of adjacency) {
      for (const next of list) {
        expect(adjacency.get(next)).toContain(key);
      }
    }
  });

  it("조각 경계는 넘지 않는다", () => {
    const { adjacency } = build([
      { partId: "a", box: box(0, 0, 0, 2, 1, 1) },
      { partId: "b", box: box(2, 0, 0, 3, 1, 1) },
    ]);
    expect(adjacency.get(voxelKey(1, 0, 0))).toEqual([voxelKey(0, 0, 0)]);
    expect(adjacency.get(voxelKey(1, 0, 0))).not.toContain(voxelKey(2, 0, 0));
    expect(adjacency.get(voxelKey(2, 0, 0))).toEqual([]);
  });
});

describe("칠하기 (flood fill)", () => {
  it("같은 색으로 이어진 영역만 칠한다", () => {
    const { surface, adjacency } = build([{ partId: "a", box: box(0, 0, 0, 3, 1, 1) }]);
    const colors = new Map();
    for (const key of surface.keys()) colors.set(key, key === voxelKey(1, 0, 0) ? 1 : 0);
    const filled = floodFill({ startKey: voxelKey(0, 0, 0), colors, adjacency });
    expect(filled).toHaveLength(1);
  });

  it("영역 전체가 한 번에 칠해진다", () => {
    const { surface, adjacency } = build([{ partId: "a", box: box(0, 0, 0, 3, 1, 1) }]);
    const colors = new Map();
    for (const key of surface.keys()) colors.set(key, 7);
    const filled = floodFill({ startKey: voxelKey(1, 0, 0), colors, adjacency });
    expect(filled).toHaveLength(3);
  });

  it("다른 조각으로 넘어가지 않는다", () => {
    const { surface, adjacency } = build([
      { partId: "a", box: box(0, 0, 0, 2, 1, 1) },
      { partId: "b", box: box(2, 0, 0, 3, 1, 1) },
    ]);
    const colors = new Map();
    for (const key of surface.keys()) colors.set(key, 3);
    const filled = floodFill({ startKey: voxelKey(0, 0, 0), colors, adjacency });
    expect(filled).toHaveLength(2);
    expect(filled).not.toContain(voxelKey(2, 0, 0));
  });

  it("색이 다른 영역은 남는다", () => {
    const { surface, adjacency } = build([{ partId: "a", box: box(0, 0, 0, 3, 1, 1) }]);
    const colors = new Map();
    for (const key of surface.keys()) colors.set(key, key === voxelKey(2, 0, 0) ? 9 : 4);
    const filled = floodFill({ startKey: voxelKey(0, 0, 0), colors, adjacency });
    expect(filled).toHaveLength(2);
    expect(filled).not.toContain(voxelKey(2, 0, 0));
  });
});

describe("영역 세기", () => {
  it("떨어진 같은 색은 두 영역이다", () => {
    const { surface, adjacency } = build([
      { partId: "a", box: box(0, 0, 0, 1, 1, 1) },
      { partId: "a", box: box(5, 0, 0, 6, 1, 1) },
    ]);
    expect(countComponents(surface, adjacency, "a")).toBe(2);
  });

  it("이어져 있으면 한 영역이다", () => {
    const { surface, adjacency } = build([{ partId: "a", box: box(0, 0, 0, 3, 1, 1) }]);
    expect(countComponents(surface, adjacency, "a")).toBe(1);
  });
});

describe("일치율", () => {
  it("전부 맞으면 1이다", () => {
    const surface = new Map([
      ["a", {}],
      ["b", {}],
    ]);
    const current = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const target = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    expect(matchRate({ current, target, surface })).toBe(1);
  });

  it("하나 틀리면 개수만큼 빠진다", () => {
    const surface = new Map([
      ["a", {}],
      ["b", {}],
    ]);
    const current = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const target = new Map([
      ["a", 1],
      ["b", 3],
    ]);
    expect(matchRate({ current, target, surface })).toBe(0.5);
  });

  it("표면 밖은 세지 않는다", () => {
    const surface = new Map([["a", {}]]);
    const current = new Map([
      ["a", 1],
      ["hidden", 5],
    ]);
    const target = new Map([
      ["a", 1],
      ["hidden", 6],
    ]);
    expect(matchRate({ current, target, surface })).toBe(1);
  });
});

describe("색 적용", () => {
  it("바뀐 복셀 수를 알려 준다", () => {
    const colors = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const result = applyColor(colors, ["a", "b"], 5);
    expect(result.changed).toBe(2);
    expect(result.colors.get("a")).toBe(5);
  });

  it("같은 색이면 세지 않는다", () => {
    const colors = new Map([["a", 1]]);
    expect(applyColor(colors, ["a"], 1).changed).toBe(0);
  });
});
