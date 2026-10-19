import { describe, expect, it } from "vitest";
import { FIND_LEVELS, POSE_LABEL, POSES, createDex, createFinder, dexKey } from "./dex.js";
import { SPECIES_ORDER } from "./species.js";

describe("도감", () => {
  it("종 4 × 자세 2 = 8항목이다", () => {
    const dex = createDex();
    expect(dex.total()).toBe(8);
    expect(dex.count()).toBe(0);
  });

  it("같은 항목을 두 번 등록해도 개수는 늘지 않는다", () => {
    const dex = createDex();
    expect(dex.register("cat", "idle")).toBe(true);
    expect(dex.register("cat", "idle")).toBe(false);
    expect(dex.count()).toBe(1);
  });

  it("종과 자세가 다르면 별개 항목으로 센다", () => {
    const dex = createDex();
    dex.register("cat", "idle");
    dex.register("cat", "walk");
    dex.register("dog", "idle");
    expect(dex.count()).toBe(3);
  });

  it("모르는 자세는 등록되지 않는다", () => {
    const dex = createDex();
    expect(dex.register("cat", "flying")).toBe(false);
    expect(dex.count()).toBe(0);
  });

  it("완성도를 비율로 보여준다", () => {
    const dex = createDex();
    for (const species of SPECIES_ORDER) dex.register(species, "idle");
    expect(dex.ratio()).toBeCloseTo(0.5, 5);
    expect(dex.has("cat", "idle")).toBe(true);
    expect(dex.has("cat", "walk")).toBe(false);
  });

  it("항목 목록에 모든 조합이 있다", () => {
    const dex = createDex();
    const entries = dex.entries();
    expect(entries).toHaveLength(8);
    expect(entries.filter((entry) => entry.found)).toHaveLength(0);
    expect(POSES.map((pose) => POSE_LABEL[pose])).toEqual(["가만히", "걷기"]);
  });
});

describe("찾기 게임", () => {
  it("레벨이 3개다", () => {
    expect(FIND_LEVELS).toHaveLength(3);
  });

  it("정답을 맞히면 점수를 얻고 다음 목표로 넘어간다", () => {
    const level = FIND_LEVELS[0];
    const finder = createFinder(level);
    const target = finder.current;
    const result = finder.answer(target);
    expect(result.correct).toBe(true);
    expect(finder.score).toBeGreaterThan(0);
    expect(finder.index).toBe(1);
  });

  it("틀리면 연속 정답이 끊기고 목표는 그대로다", () => {
    const finder = createFinder(FIND_LEVELS[1]);
    finder.answer(finder.current);
    const streak = finder.streak;
    const currentTarget = finder.current;
    const wrong = currentTarget === "cat" ? "dog" : "cat";
    const result = finder.answer(wrong);
    expect(result.correct).toBe(false);
    expect(finder.streak).toBe(0);
    expect(streak).toBeGreaterThan(0);
    expect(finder.current).toBe(currentTarget);
  });

  it("라운드를 다 맞히면 끝난다", () => {
    const level = FIND_LEVELS[0];
    const finder = createFinder(level);
    for (let index = 0; index < level.rounds; index += 1) {
      finder.answer(finder.current);
    }
    expect(finder.finished).toBe(true);
    expect(finder.current).toBe(null);
  });

  it("시간 보너스는 남은 시간에 비례한다", () => {
    const finder = createFinder(FIND_LEVELS[0]);
    expect(finder.timeBonus(10)).toBe(250);
    expect(finder.timeBonus(0)).toBe(0);
  });

  it("목표는 라운드마다 바뀐다", () => {
    const finder = createFinder(FIND_LEVELS[2]);
    const first = finder.current;
    finder.answer(first);
    expect(finder.current).not.toBe(null);
  });
});

describe("도감 키", () => {
  it("종과 자세를 한 키로 합친다", () => {
    expect(dexKey("cat", "walk")).toBe("cat:walk");
  });
});
