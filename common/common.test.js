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
import { buildLevelPanel, buildResultPanel } from "./overlay.js";

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

  it("레벨 화면에 잠금과 별점이 표시된다", () => {
    const panel = buildLevelPanel({
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
