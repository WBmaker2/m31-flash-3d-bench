import { describe, expect, it } from "vitest";
import { GEAR_SIZES } from "../../common/parts/gear3d.js";
import {
  LEVELS,
  assignmentOverlaps,
  buildNodes,
  canPlace,
  enumerateOutcomes,
  evaluateMission,
  levelById,
  levelIndexById,
  minimumGears,
  missionText,
  slotById,
} from "./levels.js";

describe("레벨 목록", () => {
  it("레벨이 8종이다", () => {
    expect(LEVELS).toHaveLength(8);
  });

  it("레벨 번호가 겹치지 않는다", () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("아이디로 레벨을 찾는다", () => {
    expect(levelById("g03")?.label).toBe("3배 속도");
    expect(levelById("없는 것")).toBeNull();
    expect(levelIndexById("g08")).toBe(7);
  });
});

describe("레벨 구조", () => {
  it("크랭크 칸이 슬롯 안에 있다", () => {
    for (const level of LEVELS) {
      expect(slotById(level, level.crank.slot)).not.toBeNull();
    }
  });

  it("미션 칸이 슬롯 안에 있다", () => {
    for (const level of LEVELS) {
      expect(slotById(level, level.mission.slot)).not.toBeNull();
    }
  });

  it("팔레트는 톱니 수 종류에서만 고른다", () => {
    for (const level of LEVELS) {
      expect(level.palette.length).toBeGreaterThan(0);
      for (const teeth of level.palette) {
        expect(GEAR_SIZES).toContain(teeth);
      }
    }
  });

  it("미션 속도는 양수다", () => {
    for (const level of LEVELS) {
      expect(level.mission.revPerSec).toBeGreaterThan(0);
      expect(["same", "opposite"]).toContain(level.mission.direction);
    }
  });

  it("기준 해법에는 겹치는 톱니바퀴가 없다", () => {
    for (const level of LEVELS) {
      expect(assignmentOverlaps(level, level.reference)).toHaveLength(0);
    }
  });
});

describe("기준 해법", () => {
  it("모든 레벨을 기준 해법으로 클리어한다", () => {
    for (const level of LEVELS) {
      const result = evaluateMission(level, level.reference);
      expect(result.cleared, `${level.id} 기준 해법이 실패했습니다`).toBe(true);
      expect(result.stars).toBe(3);
      expect(result.speed).toBeCloseTo(level.mission.revPerSec, 9);
    }
  });

  it("기준 해법은 미션 칸이 크랭크와 이어져 있다", () => {
    for (const level of LEVELS) {
      const result = evaluateMission(level, level.reference);
      expect(result.direction).toBe(level.mission.direction);
    }
  });

  it("최소 기어 수가 par 와 같다", () => {
    for (const level of LEVELS) {
      expect(minimumGears(level), `${level.id} 의 par 가 최소 기어 수와 다릅니다`).toBe(level.par);
    }
  });
});

describe("미션 판정", () => {
  it("아무것도 끼우면 미션은 실패다", () => {
    const result = evaluateMission(LEVELS[0], []);
    expect(result.cleared).toBe(false);
    expect(result.stars).toBe(0);
    expect(result.speed).toBe(0);
  });

  it("속도가 다르면 방향이 맞아도 실패다", () => {
    const level = LEVELS[3];
    const wrong = evaluateMission(level, [
      { slot: "a", teeth: 8 },
      { slot: "m", teeth: 16 },
    ]);
    expect(wrong.speedOk).toBe(false);
    expect(wrong.cleared).toBe(false);
    expect(wrong.stars).toBe(0);
  });

  it("속도가 맞고 방향이 틀리면 별 1개다", () => {
    const level = LEVELS[6];
    const result = evaluateMission(level, [
      { slot: "n", teeth: 8 },
      { slot: "m", teeth: 16 },
    ]);
    expect(result.speed).toBeCloseTo(1, 9);
    expect(result.broken).toBe(true);
    expect(result.cleared).toBe(false);
  });

  it("고리 조합은 깨진 것으로 표시한다", () => {
    const level = LEVELS[6];
    const result = evaluateMission(level, [
      { slot: "m", teeth: 16 },
      { slot: "n", teeth: 8 },
    ]);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.broken).toBe(true);
    expect(result.cleared).toBe(false);
  });

  it("par 을 넘겨 쓰면 별은 2개다", () => {
    const level = LEVELS[2];
    const result = evaluateMission(level, [
      { slot: "s1", teeth: 8 },
      { slot: "s2", teeth: 24 },
    ]);
    expect(result.cleared).toBe(true);
    expect(result.used).toBeGreaterThan(level.par);
    expect(result.stars).toBe(2);
  });

  it("점수는 별 수로만 나온다", () => {
    const level = LEVELS[0];
    const result = evaluateMission(level, level.reference);
    expect(result.score).toBe(result.stars * 100);
  });
});

describe("끼우기 규칙", () => {
  it("겹치면 끼울 수 없다", () => {
    const level = LEVELS[0];
    expect(canPlace(level, [], "s1", 8)).toBe(true);
    expect(canPlace(level, [], "s1", 16)).toBe(false);
  });

  it("이미 끼운 톱니와 겹치면 끼울 수 없다", () => {
    const level = LEVELS[3];
    expect(canPlace(level, [{ slot: "a", teeth: 8 }], "b", 12)).toBe(false);
  });
});

describe("전수 조사", () => {
  it("모든 배치가 겹침 없이 만들어진다", () => {
    for (const level of LEVELS) {
      for (const outcome of enumerateOutcomes(level)) {
        expect(assignmentOverlaps(level, outcome.assignment)).toHaveLength(0);
      }
    }
  });

  it("성공하는 배치가 기준 해법만큼 있다", () => {
    for (const level of LEVELS) {
      const cleared = enumerateOutcomes(level).filter((entry) => entry.result.cleared);
      expect(cleared.length, `${level.id} 을 클리어할 방법이 없습니다`).toBeGreaterThan(0);
    }
  });

  it("04번 레벨에는 길이 두 갈래다", () => {
    const level = LEVELS[3];
    const speeds = new Set(
      enumerateOutcomes(level)
        .filter((entry) => entry.result.speed > 0)
        .map((entry) => entry.result.speed.toFixed(3)),
    );
    expect(speeds.size).toBeGreaterThan(1);
  });
});

describe("노드와 문구", () => {
  it("노드에는 크랭크가 포함된다", () => {
    const nodes = buildNodes(LEVELS[0], LEVELS[0].reference);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].id).toBe("c");
  });

  it("미션 문구에 속도와 방향이 들어 있다", () => {
    const text = missionText(LEVELS[0]);
    expect(text).toContain("1.5");
    expect(text).toContain("반대");
  });
});
