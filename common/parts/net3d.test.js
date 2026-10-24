import { describe, expect, it } from "vitest";
import {
  FACE_IDS,
  NETS,
  createCubeState,
  foldNet,
  foldedColors,
  isValidNet,
  matchesTarget,
  roll,
  squareColors,
} from "./net3d.js";

describe("전개도 종류", () => {
  it("모두 정육면체가 된다", () => {
    for (const [name, cells] of Object.entries(NETS)) {
      expect(isValidNet(cells), `${name} 이 정육면체가 되지 않습니다`).toBe(true);
    }
  });

  it("전개도는 6칸이다", () => {
    for (const cells of Object.values(NETS)) {
      expect(cells).toHaveLength(6);
    }
  });
});

describe("굴리기", () => {
  it("굴린 뒤에도 6면이 모두 있다", () => {
    const state = createCubeState();
    const next = roll(state, "east");
    expect(Object.values(next).sort()).toEqual(Object.values(state).sort());
  });

  it("굴리면 바닥면이 바뀐다", () => {
    const state = createCubeState();
    expect(roll(state, "east").down).toBe("east");
    expect(roll(state, "north").down).toBe("north");
    expect(roll(state, "west").down).toBe("west");
    expect(roll(state, "south").down).toBe("south");
  });
});

describe("접기", () => {
  it("각 칸이 서로 다른 면이 된다", () => {
    for (const cells of Object.values(NETS)) {
      const faces = [...foldNet(cells).values()];
      expect(new Set(faces).size).toBe(6);
    }
  });

  it("첫 칸은 바닥면이 된다", () => {
    const cells = NETS.cross;
    expect(foldNet(cells).get(`${cells[0].col},${cells[0].row}`)).toBe("down");
  });

  it("면 색이 칸 색으로 돌아온다", () => {
    const cells = NETS.zigzag;
    const target = {
      down: 1,
      up: 2,
      north: 3,
      south: 4,
      east: 5,
      west: 6,
    };
    const colors = squareColors({ cells, target });
    const folded = foldedColors({ cells, colors });
    for (const face of FACE_IDS) {
      expect(folded[face]).toBe(target[face]);
    }
    expect(matchesTarget({ cells, colors, target })).toBe(true);
  });

  it("색을 바꾸면 목표와 다르다", () => {
    const cells = NETS.zigzag;
    const target = {
      down: 1,
      up: 2,
      north: 3,
      south: 4,
      east: 5,
      west: 6,
    };
    const colors = squareColors({ cells, target });
    const swapped = new Map(colors);
    const first = [...colors.keys()][0];
    swapped.set(first, 99);
    expect(matchesTarget({ cells, colors: swapped, target })).toBe(false);
  });
});
