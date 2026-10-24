// 마지막 단계를 마쳤을 때 나오는 엔딩 화면.
// 진행 기록에서 합계를 뽑는 계산과 격려 문구는 여기서 다룬다(순수 계산이라 테스트된다).
import { showEnding } from "./overlay.js";

/** 게임 목록으로 돌아가는 주소. 게임 폴더 바로 위가 목록 페이지다. */
export const GAME_LIST_HREF = "../index.html";

/** 엔딩 화면 기본 버튼. 반드시 손댈 '다시 시작'만 펄스로 안내한다. */
export function endingActions() {
  return [
    { id: "first", label: "1단계부터 다시 시작", primary: true, pulse: true },
    { id: "levels", label: "레벨 선택" },
    { id: "exit", label: "게임 종료" },
  ];
}

/**
 * 진행 기록에서 엔딩 화면에 쓸 합계를 뽑는다.
 * 단계마다 최고 기록(별·점수)을 모아 총점을 만든다.
 */
export function summarizeProgress(progress, levels = []) {
  const list = levels ?? [];
  let stars = 0;
  let score = 0;
  let cleared = 0;
  let perfect = 0;

  const entries = list.map((level, index) => {
    const saved = progress?.levelState?.(level.id) ?? null;
    const levelStars = Math.max(0, Math.min(3, Number(saved?.stars) || 0));
    const levelScore = Number(saved?.bestScore) || 0;
    stars += levelStars;
    score += levelScore;
    if (levelStars > 0) cleared += 1;
    if (levelStars === 3) perfect += 1;
    return {
      index: index + 1,
      id: level.id,
      label: level.label ?? "",
      stars: levelStars,
      score: levelScore,
    };
  });

  return {
    levels: entries,
    total: list.length,
    stars,
    maxStars: list.length * 3,
    score,
    cleared,
    perfect,
  };
}

/** 성적에 따라 격려 문구를 고른다. */
export function praiseFor(summary) {
  const { total, stars, maxStars } = summary;
  if (total > 0 && stars >= maxStars) {
    return "모든 단계를 만점으로 통과했어요! 정말 대단해요. 다음 기록도 함께 기대해요!";
  }
  if (maxStars > 0 && stars >= maxStars * 0.75) {
    return "거의 완벽하게 통과했어요! 남은 별만 조금 더 모으면 만점이에요. 다음 도전도 응원해요!";
  }
  if (maxStars > 0 && stars >= maxStars * 0.5) {
    return "모든 단계를 끝까지 왔어요! 다음번에는 별을 하나 더 모아 볼까요? 충분히 잘했어요!";
  }
  return "끝까지 달려와 주셔서 고마워요! 다시 도전하면 더 높은 점수를 만들 수 있어요.";
}

/** 엔딩 화면에 들어갈 기본 통계 줄. */
export function endingRows(summary) {
  return [
    ["클리어한 단계", `${summary.cleared} / ${summary.total}`],
    ["만점 단계", `${summary.perfect} 개`],
  ];
}

/** 게임 목록으로 돌아간다. 랜딩 페이지가 iframe 으로 띄운 경우 그 창을 닫고 목록으로 보낸다. */
export function exitToGameList(href = GAME_LIST_HREF) {
  let target = href;
  try {
    target = new URL(href, window.location.href).href;
  } catch {
    target = href;
  }
  try {
    const parentWindow = window.parent;
    if (parentWindow && parentWindow !== window) {
      parentWindow.location.href = target;
      return target;
    }
  } catch {
    // 다른 출처라 닫을 수 없으면 현재 창으로 이동한다.
  }
  window.location.href = target;
  return target;
}

/**
 * 마지막 단계를 마친 뒤 엔딩 화면을 띄운다.
 * 반환값은 눌린 동작 id(first · levels · exit).
 */
export function showEndingScreen(options = {}) {
  const {
    progress,
    levels = [],
    title,
    kicker = "모든 단계 클리어",
    rows = [],
    detail,
    scoreLabel = "총점",
    summaryNote = "모은 별",
    actions = endingActions(),
    onFirst,
    onLevels,
    exitHref = GAME_LIST_HREF,
  } = options;

  const summary = summarizeProgress(progress, levels);
  return showEnding({
    kicker,
    title: title ?? "모든 단계를 마쳤어요!",
    summary,
    scoreLabel,
    summaryNote,
    rows: [...endingRows(summary), ...rows],
    detail: detail ?? praiseFor(summary),
    actions,
  }).then((action) => {
    if (action === "first") onFirst?.();
    if (action === "levels") onLevels?.();
    if (action === "exit") exitToGameList(exitHref);
    return action;
  });
}
