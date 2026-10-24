import { describe, expect, it } from "vitest";
import { floodFill, matchRate } from "../../common/parts/paint3d.js";
import {
  COLORS,
  LEVELS,
  buildLevel,
  evaluatePaint,
  levelById,
  levelIndexById,
  targetText,
} from "./levels.js";
import { PART_LABELS, findPart } from "./objects.js";

/** 목표 색으로 전부 칠해 본다. clicks 는 실제로 누른 횟수다. */
function paintAll(level, built) {
  let colors = new Map(built.initial);
  let clicks = 0;
  for (const partId of level.parts) {
    const keys = [...built.surface.keys()].filter((key) => built.surface.get(key).partId === partId);
    // 이미 맞는 조각은 손대지 않는다.
    if (keys.every((key) => built.initial.get(key) === built.target.get(key))) continue;
    const visited = new Set();
    for (const key of keys) {
      if (visited.has(key)) continue;
      const region = floodFill({ startKey: key, colors, adjacency: built.adjacency });
      for (const entry of region) visited.add(entry);
      const targetColor = built.target.get(key);
      const next = new Map(colors);
      for (const entry of region) next.set(entry, targetColor);
      colors = next;
      clicks += 1;
    }
  }
  return { colors, clicks };
}

describe("레벨 목록", () => {
  it("레벨이 8종이다", () => {
    expect(LEVELS).toHaveLength(8);
  });

  it("레벨 번호가 겹치지 않는다", () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("아이디로 레벨을 찾는다", () => {
    expect(levelById("p04")?.label).toBe("버섯");
    expect(levelById("없는 것")).toBeNull();
    expect(levelIndexById("p08")).toBe(7);
  });
});

describe("레벨 구조", () => {
  it("겹치는 조각이 없다", () => {
    for (const level of LEVELS) {
      expect(buildLevel(level).overlaps, `${level.id} 에 겹치는 조각이 있습니다`).toHaveLength(0);
    }
  });

  it("모든 조각에 목표 색이 있다", () => {
    for (const level of LEVELS) {
      for (const partId of level.parts) {
        expect(level.target[partId], `${level.id} 의 ${partId} 목표 색이 없습니다`).toBeTruthy();
      }
    }
  });

  it("목표 색은 팔레트에 들어 있다", () => {
    for (const level of LEVELS) {
      for (const name of Object.values(level.target)) {
        expect(level.palette).toContain(name);
        expect(COLORS[name]).toBeTypeOf("number");
      }
    }
  });

  it("조각 이름이 모두 있다", () => {
    for (const level of LEVELS) {
      for (const partId of level.parts) {
        expect(PART_LABELS[partId]).toBeTruthy();
        expect(findPart(partId)).not.toBeNull();
      }
    }
  });

  it("목표 문구에 색 이름이 들어 있다", () => {
    expect(targetText(LEVELS[0])).toContain("빨강");
  });
});

describe("복셀 구성", () => {
  it("표면 복셀이 있다", () => {
    for (const level of LEVELS) {
      const built = buildLevel(level);
      expect(built.surface.size).toBeGreaterThan(10);
      expect(built.surface.size).toBeLessThanOrEqual(built.voxels.size);
    }
  });

  it("인접 그래프가 표면 복셀과 같은 크기다", () => {
    for (const level of LEVELS) {
      const built = buildLevel(level);
      expect(built.adjacency.size).toBe(built.surface.size);
    }
  });

  it("처음부터 완성된 조각도 있다", () => {
    const level = LEVELS.find((entry) => (entry.done ?? []).length > 0);
    const built = buildLevel(level);
    const rate = matchRate({ current: built.initial, target: built.target, surface: built.surface });
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1);
  });
});

describe("최소 칠하기 횟수", () => {
  it("par 은 칠해야 하는 조각 덩어리 수다", () => {
    for (const level of LEVELS) {
      const built = buildLevel(level);
      const painted = paintAll(level, built);
      expect(painted.clicks, `${level.id} 의 par 이 최소 횟수와 다릅니다`).toBe(built.par);
    }
  });

  it("목표 색으로 칠하면 100% 가 된다", () => {
    for (const level of LEVELS) {
      const built = buildLevel(level);
      const painted = paintAll(level, built);
      const rate = matchRate({
        current: painted.colors,
        target: built.target,
        surface: built.surface,
      });
      expect(rate, `${level.id} 를 목표대로 칠하면 100% 가 되어야 합니다`).toBe(1);
    }
  });

  it("처음 상태는 아직 완성되지 않았다", () => {
    for (const level of LEVELS) {
      const built = buildLevel(level);
      const rate = matchRate({ current: built.initial, target: built.target, surface: built.surface });
      expect(rate).toBeLessThan(1);
    }
  });
});

describe("채점", () => {
  it("완성하면 3성이다", () => {
    const level = LEVELS[0];
    const built = buildLevel(level);
    const painted = paintAll(level, built);
    const result = evaluatePaint(level, built, painted.colors, painted.clicks);
    expect(result.cleared).toBe(true);
    expect(result.stars).toBe(3);
    expect(result.rate).toBe(1);
  });

  it("많이 칠하면 2성이다", () => {
    const level = LEVELS[0];
    const built = buildLevel(level);
    const painted = paintAll(level, built);
    const result = evaluatePaint(level, built, painted.colors, painted.clicks + 2);
    expect(result.cleared).toBe(true);
    expect(result.stars).toBe(2);
  });

  it("절반만 맞으면 1성이다", () => {
    const level = LEVELS[1];
    const built = buildLevel(level);
    const painted = paintAll(level, built);
    const half = new Map(painted.colors);
    for (const [key, voxel] of built.surface) {
      if (voxel.partId === "r-body") half.set(key, built.initial.get(key));
    }
    const result = evaluatePaint(level, built, half, painted.clicks);
    expect(result.rate).toBeGreaterThan(0.5);
    expect(result.cleared).toBe(false);
    expect(result.stars).toBe(1);
  });

  it("아무것도 안 칠하면 0성이다", () => {
    const level = LEVELS[0];
    const built = buildLevel(level);
    const result = evaluatePaint(level, built, built.initial, 0);
    expect(result.rate).toBe(0);
    expect(result.stars).toBe(0);
  });

  it("점수는 일치율과 별 수로 나온다", () => {
    const level = LEVELS[0];
    const built = buildLevel(level);
    const painted = paintAll(level, built);
    const result = evaluatePaint(level, built, painted.colors, painted.clicks);
    expect(result.score).toBe(result.stars * 100 + 50);
  });
});
