import { describe, expect, it } from "vitest";
import {
  ROTATIONS,
  applyRotation,
  cellKey,
  distinctRotations,
  generateRotations,
  sameCells,
} from "./rotations.js";
import { BLOCKS } from "./blocks.js";
import { LEVELS, GRID_SIZE } from "./levels.js";
import {
  blockOrientations,
  evaluateAssembly,
  matchesTarget,
  normalizeCells,
  orientationOf,
  placeCells,
  scoreFor,
  withinGrid,
} from "./assembly.js";

function determinant(matrix) {
  const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

function toMatrix(rotation) {
  const matrix = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  rotation.perm.forEach((column, row) => {
    matrix[row][column] = rotation.signs[row];
  });
  return matrix;
}

describe("24회전군", () => {
  it("회전이 정확히 24개다", () => {
    expect(ROTATIONS).toHaveLength(24);
    expect(generateRotations()).toHaveLength(24);
  });

  it("모든 회전의 행렬식이 1이다", () => {
    for (const rotation of ROTATIONS) {
      expect(determinant(toMatrix(rotation))).toBe(1);
    }
  });

  it("회전끼리 중복되지 않는다", () => {
    const seen = new Set();
    for (const rotation of ROTATIONS) {
      seen.add(rotation.perm.join("") + rotation.signs.join(""));
    }
    expect(seen.size).toBe(24);
  });

  it("벡터를 회전해도 길이가 유지된다", () => {
    const vectors = [
      [1, 2, 3],
      [0, 0, 1],
      [-2, 5, 0],
    ];
    for (const rotation of ROTATIONS) {
      for (const vector of vectors) {
        const rotated = applyRotation(rotation, vector);
        expect(Math.hypot(...rotated)).toBeCloseTo(Math.hypot(...vector), 6);
        expect(rotated.every((value) => Number.isInteger(value))).toBe(true);
      }
    }
  });

  it("열두 번 회전하면 원래대로 돌아온다", () => {
    for (const rotation of ROTATIONS) {
      let vector = [1, 2, 3];
      for (let i = 0; i < 12; i += 1) vector = applyRotation(rotation, vector);
      expect(vector).toEqual([1, 2, 3]);
    }
  });

  it("회전의 위수는 1, 2, 3, 4 중 하나다", () => {
    for (const rotation of ROTATIONS) {
      let vector = [1, 2, 3];
      let order = 0;
      for (let i = 1; i <= 4; i += 1) {
        vector = applyRotation(rotation, vector);
        if (vector.every((value, index) => value === [1, 2, 3][index])) {
          order = i;
          break;
        }
      }
      expect([1, 2, 3, 4]).toContain(order);
    }
  });

  it("같은 모양으로 회전한 결과는 같다", () => {
    const cells = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
    ];
    const results = distinctRotations(cells);
    const keys = results.map((entry) => entry.cells.map(cellKey).sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("막대 3칸은 회전해도 3칸이다", () => {
    const results = distinctRotations(BLOCKS.bar3.cells);
    expect(results).toHaveLength(3);
    for (const entry of results) {
      expect(entry.cells).toHaveLength(3);
    }
  });
});

describe("블록 방향", () => {
  it("모든 방향의 칸이 같은 개수다", () => {
    for (const id of Object.keys(BLOCKS)) {
      const orientations = blockOrientations(id);
      expect(orientations.length).toBeGreaterThan(0);
      for (const orientation of orientations) {
        expect(orientation.cells).toHaveLength(BLOCKS[id].cells.length);
      }
    }
  });

  it("정규화한 칸에는 음수가 없다", () => {
    for (const id of Object.keys(BLOCKS)) {
      for (const orientation of blockOrientations(id)) {
        for (const cell of orientation.cells) {
          expect(cell.every((value) => value >= 0)).toBe(true);
        }
      }
    }
  });

  it("정규화는 최소 모서리를 원점으로 옮긴다", () => {
    const cells = [
      [-1, 2, 3],
      [0, 2, 3],
    ];
    const normalized = normalizeCells(cells);
    expect(normalized).toEqual([
      [0, 0, 0],
      [1, 0, 0],
    ]);
  });

  it("같은Cells 비교가 동작한다", () => {
    expect(sameCells([[0, 0, 0]], [[0, 0, 0]])).toBe(true);
    expect(sameCells([[0, 0, 0]], [[0, 0, 1]])).toBe(false);
    expect(sameCells([[0, 0, 0]], [[0, 0, 0], [1, 0, 0]])).toBe(false);
  });
});

describe("레벨 데이터", () => {
  it("레벨이 8개다", () => {
    expect(LEVELS).toHaveLength(8);
  });

  it("모든 목표가 3×3×3 안에 있다", () => {
    for (const level of LEVELS) {
      expect(level.target.length).toBeGreaterThan(0);
      for (const cell of level.target) {
        expect(withinGrid([cell], GRID_SIZE)).toBe(true);
      }
    }
  });

  it("제공 블록이 모두 실재하고 par 가 달성 가능하다", () => {
    for (const level of LEVELS) {
      expect(level.blocks.length).toBeGreaterThanOrEqual(level.par);
      let total = 0;
      for (const id of level.blocks) {
        expect(BLOCKS[id]).toBeDefined();
        total += BLOCKS[id].cells.length;
      }
      expect(total).toBeGreaterThanOrEqual(level.target.length);
    }
  });

  it("블록 ID가 중복되지 않는다", () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("배치 판정", () => {
  const target = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 0, 1],
    [1, 0, 1],
  ];

  it("목표 밖으로 나간 칸을 잡아낸다", () => {
    const placement = { cells: [[2, 0, 0]] };
    const result = evaluateAssembly(target, [placement]);
    expect(result.outside).toHaveLength(1);
    expect(result.complete).toBe(false);
  });

  it("겹친 블록을 잡아낸다", () => {
    const placements = [
      { cells: [[0, 0, 0]] },
      { cells: [[0, 0, 0]] },
    ];
    const result = evaluateAssembly(target, placements);
    expect(result.overlaps).toHaveLength(1);
    expect(result.complete).toBe(false);
  });

  it("목표를 정확히 채우면 완성이 된다", () => {
    const placement = { cells: target.map((cell) => [...cell]) };
    const result = evaluateAssembly(target, [placement]);
    expect(result.remaining).toHaveLength(0);
    expect(result.overlaps).toHaveLength(0);
    expect(result.outside).toHaveLength(0);
    expect(result.complete).toBe(true);
  });

  it("빈 판은 미완성이다", () => {
    const result = evaluateAssembly(target, []);
    expect(result.remaining).toHaveLength(4);
    expect(result.complete).toBe(false);
  });

  it("배치한 칸과 목표가 같으면 일치로 본다", () => {
    expect(matchesTarget(target.map((cell) => [...cell]), target)).toBe(true);
    expect(matchesTarget([[0, 0, 0]], target)).toBe(false);
  });

  it("격자 밖 배치는 막는다", () => {
    expect(withinGrid([[2, 2, 2]], 3)).toBe(true);
    expect(withinGrid([[3, 0, 0]], 3)).toBe(false);
    expect(withinGrid([[-1, 0, 0]], 3)).toBe(false);
  });

  it("방향을 골라 배치 칸을 계산한다", () => {
    const orientation = orientationOf("bar3", 0);
    const cells = placeCells(orientation, [1, 0, 0]);
    expect(cells).toHaveLength(3);
    expect(cells.every((cell) => cell[0] >= 1 && cell[0] <= 3)).toBe(true);
  });
});

describe("점수", () => {
  it("par 을 지키면 점수가 높다", () => {
    const good = scoreFor({ par: 2, used: 2, timeMs: 5000 });
    const sloppy = scoreFor({ par: 2, used: 4, timeMs: 5000 });
    expect(good).toBeGreaterThan(sloppy);
  });

  it("점수는 음수가 되지 않는다", () => {
    expect(scoreFor({ par: 1, used: 9, timeMs: 90000 })).toBeGreaterThanOrEqual(0);
  });
});
