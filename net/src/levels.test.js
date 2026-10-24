import { describe, expect, it } from "vitest";
import { NETS, matchesTarget } from "../../common/parts/net3d.js";
import { LEVELS, correctIndex, evaluateLevel, levelById, levelIndexById, levelOptions } from "./levels.js";

describe("레벨 목록", () => {
  it("레벨이 8종이다", () => {
    expect(LEVELS).toHaveLength(8);
  });

  it("아이디로 레벨을 찾는다", () => {
    expect(levelById("n01")?.label).toBe("첫 상자");
    expect(levelById("없는 것")).toBeNull();
    expect(levelIndexById("n08")).toBe(7);
  });
});

describe("보기", () => {
  it("보기가 4개다", () => {
    for (const level of LEVELS) {
      expect(levelOptions(level)).toHaveLength(4);
    }
  });

  it("정답은 하나뿐이다", () => {
    for (const level of LEVELS) {
      const cells = NETS[level.net];
      const hits = levelOptions(level).filter((colors) =>
        matchesTarget({ cells, colors, target: level.target }),
      );
      expect(hits.length, `${level.id} 정답이 ${hits.length} 개입니다`).toBe(1);
    }
  });

  it("첫 번째 보기가 정답이다", () => {
    for (const level of LEVELS) {
      expect(correctIndex(level)).toBe(0);
    }
  });

  it("보기들의 색 배치가 서로 다르다", () => {
    for (const level of LEVELS) {
      const options = levelOptions(level);
      const seen = new Set(options.map((colors) => JSON.stringify([...colors.values()])));
      expect(seen.size).toBe(4);
    }
  });
});

describe("미션 판정", () => {
  it("정답을 고르면 3성이다", () => {
    const level = LEVELS[0];
    const result = evaluateLevel(level, correctIndex(level));
    expect(result.cleared).toBe(true);
    expect(result.stars).toBe(3);
  });

  it("틀리면 0성이다", () => {
    const level = LEVELS[0];
    const result = evaluateLevel(level, 2);
    expect(result.cleared).toBe(false);
    expect(result.stars).toBe(0);
  });
});
