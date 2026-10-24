import { describe, expect, it } from "vitest";
import { cellKey, comparePicture, parsePicture, pictureColors } from "./draw3d.js";

const PICTURE = [
  "..RR..",
  ".RRRR.",
  "RRRRRR",
  "RRRRRR",
  ".RRRR.",
  "..RR..",
];

describe("그림 해석", () => {
  it("칸 목록으로 바꾼다", () => {
    const picture = parsePicture(PICTURE);
    expect(picture.width).toBe(6);
    expect(picture.height).toBe(6);
    expect(picture.cells.length).toBe(24);
  });

  it("빈 칸은 세지 않는다", () => {
    const picture = parsePicture([".R.", "..."]);
    expect(picture.cells).toHaveLength(1);
  });

  it("쓰인 색을 찾는다", () => {
    expect(pictureColors(PICTURE)).toEqual(["R"]);
    expect(pictureColors(["RG", ".."])).toEqual(["R", "G"]);
  });
});

describe("그림 비교", () => {
  it("빈 배치는 일치율 0 이다", () => {
    const result = comparePicture({ rows: PICTURE, placement: new Map() });
    expect(result.rate).toBe(0);
    expect(result.total).toBe(24);
  });

  it("완전히 맞으면 일치율 1 이다", () => {
    const placement = new Map();
    for (const cell of parsePicture(PICTURE).cells) {
      placement.set(cellKey(cell.col, cell.row), cell.color);
    }
    const result = comparePicture({ rows: PICTURE, placement });
    expect(result.rate).toBe(1);
    expect(result.matched).toBe(24);
    expect(result.extra).toBe(0);
  });

  it("색이 틀리면 맞은 칸으로 세지 않는다", () => {
    const placement = new Map([[cellKey(2, 2), "B"]]);
    const result = comparePicture({ rows: PICTURE, placement });
    expect(result.matched).toBe(0);
    expect(result.extra).toBe(1);
  });

  it("목표에 없는 칸은 잘못 놓은 칸이다", () => {
    const placement = new Map([[cellKey(0, 0), "R"]]);
    const result = comparePicture({ rows: PICTURE, placement });
    expect(result.extra).toBe(1);
  });
});
