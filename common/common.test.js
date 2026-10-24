import { afterEach, describe, expect, it } from "vitest";
import {
  clearGame,
  clearState,
  isStorageAvailable,
  loadState,
  saveState,
  STORAGE_VERSION,
} from "./storage.js";
import { createProgress, starsFor } from "./progress.js";
import { buildEndingPanel, buildLevelPanel, buildResultPanel } from "./overlay.js";
import {
  endingActions,
  endingRows,
  praiseFor,
  summarizeProgress,
} from "./ending.js";

afterEach(() => {
  window.localStorage.clear();
});

describe("저장 계층", () => {
  it("저장한 값을 다시 읽는다", () => {
    expect(saveState("demo", "key", { a: 1 })).toBe(true);
    expect(loadState("demo", "key", null)).toEqual({ a: 1 });
  });

  it("없는 키는 기본값을 돌려준다", () => {
    expect(loadState("demo", "nothing", { fallback: true })).toEqual({ fallback: true });
  });

  it("게임별로 키가 분리된다", () => {
    saveState("one", "k", 1);
    saveState("two", "k", 2);
    expect(loadState("one", "k", 0)).toBe(1);
    expect(loadState("two", "k", 0)).toBe(2);
  });

  it("깨진 JSON은 기본값으로 되돌린다", () => {
    window.localStorage.setItem("m31-3d-bench:demo:broken", "{not json");
    expect(loadState("demo", "broken", "safe")).toBe("safe");
  });

  it("버전이 다른 값은 기본값으로 되돌린다", () => {
    window.localStorage.setItem(
      "m31-3d-bench:demo:old",
      JSON.stringify({ v: STORAGE_VERSION + 1, data: { a: 1 } }),
    );
    expect(loadState("demo", "old", null)).toBe(null);
  });

  it("개별 삭제와 게임 전체 삭제가 동작한다", () => {
    saveState("demo", "a", 1);
    saveState("demo", "b", 2);
    saveState("other", "a", 3);
    clearState("demo", "a");
    expect(loadState("demo", "a", null)).toBe(null);
    expect(loadState("demo", "b", null)).toBe(2);
    clearGame("demo");
    expect(loadState("demo", "b", null)).toBe(null);
    expect(loadState("other", "a", null)).toBe(3);
  });

  it("저장소를 쓸 수 없으면 조용히 실패한다", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      expect(isStorageAvailable()).toBe(false);
      expect(saveState("demo", "k", 1)).toBe(false);
      expect(loadState("demo", "k", "fallback")).toBe("fallback");
    } finally {
      Object.defineProperty(window, "localStorage", original);
    }
  });
});

describe("진행 관리", () => {
  const levels = [
    { id: "one", label: "하나" },
    { id: "two", label: "둘" },
    { id: "three", label: "셋" },
  ];

  it("첫 레벨만 처음부터 열려 있다", () => {
    const progress = createProgress("demo", { levels });
    expect(progress.isUnlocked("one")).toBe(true);
    expect(progress.isUnlocked("two")).toBe(false);
    expect(progress.unlockedCount()).toBe(1);
  });

  it("별을 받으면 다음 레벨이 열린다", () => {
    const progress = createProgress("demo", { levels });
    const result = progress.record("one", { stars: 3, score: 500 });
    expect(result.unlocked).toEqual(["two"]);
    expect(progress.isUnlocked("two")).toBe(true);
    expect(progress.isUnlocked("three")).toBe(false);
  });

  it("기록은 더 좋은 값으로만 갱신된다", () => {
    const progress = createProgress("demo", { levels });
    progress.record("one", { stars: 3, score: 900, timeMs: 4000 });
    progress.record("one", { stars: 1, score: 100, timeMs: 9000 });
    const state = progress.levelState("one");
    expect(state.stars).toBe(3);
    expect(state.bestScore).toBe(900);
    expect(state.bestTimeMs).toBe(4000);
    expect(state.attempts).toBe(2);
  });

  it("별이 없으면 다음 레벨이 열리지 않는다", () => {
    const progress = createProgress("demo", { levels });
    progress.record("one", { stars: 0, score: 10 });
    expect(progress.isUnlocked("two")).toBe(false);
  });

  it("합계 조회가 전체 성적을 모아 준다", () => {
    const progress = createProgress("demo", { levels });
    progress.record("one", { stars: 3, score: 500 });
    progress.record("two", { stars: 2, score: 300 });
    expect(progress.starsTotal()).toBe(5);
    expect(progress.starsMax()).toBe(9);
    expect(progress.scoreTotal()).toBe(800);
    expect(progress.clearedCount()).toBe(2);
    expect(progress.perfectCount()).toBe(1);
  });

  it("진행 상태가 저장되고 다시 읽힌다", () => {
    const first = createProgress("demo", { levels });
    first.record("one", { stars: 2, score: 700 });
    const second = createProgress("demo", { levels });
    expect(second.levelState("one").stars).toBe(2);
    expect(second.levelState("one").bestScore).toBe(700);
    expect(second.isUnlocked("two")).toBe(true);
  });

  it("초기화하면 처음 상태로 돌아간다", () => {
    const progress = createProgress("demo", { levels });
    progress.record("one", { stars: 3, score: 700 });
    progress.reset();
    expect(progress.levelState("one").stars).toBe(0);
    expect(progress.isUnlocked("one")).toBe(true);
    expect(progress.isUnlocked("two")).toBe(false);
  });

  it("별점 계산이 경계값에서 맞는다", () => {
    expect(starsFor({ accuracy: 1, used: 1, par: 1, timeRatio: 1 })).toBe(3);
    expect(starsFor({ accuracy: 0.85, used: 2, par: 1, timeRatio: 1 })).toBe(2);
    expect(starsFor({ accuracy: 0.3, used: 9, par: 1, timeRatio: 0.1 })).toBe(1);
    expect(starsFor({ accuracy: 0 })).toBe(0);
  });
});

describe("공통 화면", () => {
  it("결과 화면에 별과 점수와 동작 버튼이 들어간다", () => {
    const panel = buildResultPanel({
      title: "정육면체 완성",
      stars: 2,
      score: 1200,
      bestScore: 1500,
      rows: [["남은 블록", "1개"]],
      actions: [
        { id: "retry", label: "다시 하기", primary: true },
        { id: "levels", label: "레벨 선택" },
      ],
    });
    expect(panel.textContent).toContain("정육면체 완성");
    expect(panel.querySelectorAll(".m31-star.is-on")).toHaveLength(2);
    expect(panel.textContent).toContain("1200");
    expect(panel.textContent).toContain("1500");
    expect(panel.textContent).toContain("남은 블록");
    expect(panel.querySelectorAll("button")).toHaveLength(2);
  });

  it("다음 단계 버튼에만 펄스 표시가 붙는다", () => {
    const panel = buildResultPanel({
      title: "클리어",
      actions: [
        { id: "next", label: "다음 단계", primary: true, pulse: true },
        { id: "retry", label: "다시 하기" },
      ],
    });
    const buttons = panel.querySelectorAll("button");
    expect(buttons[0].dataset.action).toBe("next");
    expect(buttons[0].classList.contains("btn-pulse")).toBe(true);
    expect(buttons[0].classList.contains("m31-btn-primary")).toBe(true);
    expect(buttons[1].classList.contains("btn-pulse")).toBe(false);
  });

  it("레벨 화면에 잠금과 별점이 표시된다", () => {    const panel = buildLevelPanel({
      title: "레벨 선택",
      levels: [
        { id: "one", label: "하나", stars: 3, unlocked: true },
        { id: "two", label: "둘", stars: 0, unlocked: false },
      ],
    });
    const buttons = panel.querySelectorAll(".m31-level");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].disabled).toBe(false);
    expect(buttons[1].disabled).toBe(true);
    expect(buttons[0].querySelectorAll(".m31-star.is-on")).toHaveLength(3);
  });
});

describe("엔딩 화면", () => {
  const levels = [
    { id: "one", label: "하나" },
    { id: "two", label: "둘" },
    { id: "three", label: "셋" },
  ];

  function seeded() {
    const progress = createProgress("ending", { levels });
    progress.record("one", { stars: 3, score: 500 });
    progress.record("two", { stars: 2, score: 300 });
    return progress;
  }

  it("진행 기록에서 총점과 별을 합산한다", () => {
    const summary = summarizeProgress(seeded(), levels);
    expect(summary.total).toBe(3);
    expect(summary.stars).toBe(5);
    expect(summary.maxStars).toBe(9);
    expect(summary.score).toBe(800);
    expect(summary.cleared).toBe(2);
    expect(summary.perfect).toBe(1);
    expect(summary.levels[0]).toMatchObject({ index: 1, id: "one", label: "하나", stars: 3, score: 500 });
  });

  it("아직 하지 않은 단계는 0점으로 잡는다", () => {
    const summary = summarizeProgress(createProgress("ending", { levels }), levels);
    expect(summary.stars).toBe(0);
    expect(summary.score).toBe(0);
    expect(summary.cleared).toBe(0);
    expect(summary.levels).toHaveLength(3);
  });

  it("만점이면 가장 엄격한 격려 문구가 나온다", () => {
    const progress = createProgress("ending", { levels });
    levels.forEach((level) => progress.record(level.id, { stars: 3, score: 100 }));
    const summary = summarizeProgress(progress, levels);
    expect(praiseFor(summary)).toContain("만점");
    expect(praiseFor(summary)).not.toContain("아쉽");
  });

  it("성적이 낮으면 다독을 가는 격려 문구가 나온다", () => {
    const progress = createProgress("ending", { levels });
    progress.record("one", { stars: 1, score: 10 });
    const summary = summarizeProgress(progress, levels);
    expect(praiseFor(summary)).toContain("고마워요");
  });

  it("기본 통계와 버튼이 정해진 모습으로 나온다", () => {
    const summary = summarizeProgress(seeded(), levels);
    expect(endingRows(summary)).toEqual([
      ["클리어한 단계", "2 / 3"],
      ["만점 단계", "1 개"],
    ]);
    expect(endingActions().map((action) => action.id)).toEqual(["first", "levels", "exit"]);
    expect(endingActions()[0].pulse).toBe(true);
  });

  it("엔딩 화면에 총점과 단계별 성적이 들어간다", () => {
    const summary = summarizeProgress(seeded(), levels);
    const panel = buildEndingPanel({
      kicker: "모든 단계 클리어",
      title: "모두 끝냈어요!",
      summary,
      rows: endingRows(summary),
      detail: "축하해요!",
      actions: endingActions(),
    });
    expect(panel.querySelector(".m31-kicker").textContent).toBe("모든 단계 클리어");
    expect(panel.querySelector(".m31-title").textContent).toBe("모두 끝냈어요!");
    expect(panel.querySelector(".m31-ending-score-value").textContent).toBe("800");
    expect(panel.querySelector(".m31-ending-stars").textContent).toBe("★ 5 / 9");
    expect(panel.querySelectorAll(".m31-ending-row")).toHaveLength(3);
    expect(panel.querySelectorAll(".m31-ending-row")[0].querySelectorAll(".m31-star.is-on")).toHaveLength(3);
    expect(panel.textContent).toContain("클리어한 단계");
    expect(panel.textContent).toContain("축하해요!");
    const buttons = [...panel.querySelectorAll("button")];
    expect(buttons.map((button) => button.dataset.action)).toEqual(["first", "levels", "exit"]);
    expect(buttons[0].classList.contains("btn-pulse")).toBe(true);
    expect(buttons[0].classList.contains("m31-btn-primary")).toBe(true);
  });
});
