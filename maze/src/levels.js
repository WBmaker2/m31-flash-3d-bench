// 레벨 데이터와 판정 규칙. 순수 계산, three에 의존하지 않는다.

export const LEVELS = [
  {
    id: "first",
    label: "첫 미로",
    hint: "키보드 방향키로 움직이고 마우스로 둘러보세요. 열쇠를 주운 뒤 초록빛 출구로 가면 됩니다.",
    cols: 7,
    rows: 7,
    seed: 1011,
    keys: 1,
    stars: { three: 0.12, two: 0.4 },
  },
  {
    id: "two",
    label: "두 개의 열쇠",
    hint: "열쇠가 둘입니다. 되돌아가는 길을 기억하면 짧게 갈 수 있어요.",
    cols: 9,
    rows: 9,
    seed: 2027,
    keys: 2,
    stars: { three: 0.12, two: 0.4 },
  },
  {
    id: "corridor",
    label: "긴 회랑",
    hint: "길이 길어졌습니다. 갈림길 앞에서 방향을 미리 정해 보세요.",
    cols: 11,
    rows: 11,
    seed: 3041,
    keys: 2,
    stars: { three: 0.1, two: 0.36 },
  },
  {
    id: "three",
    label: "세 갈래",
    hint: "문은 셋, 열쇠도 셋. 어떤 순서로 주울지 먼저 정해 보세요.",
    cols: 13,
    rows: 13,
    seed: 4093,
    keys: 3,
    stars: { three: 0.1, two: 0.34 },
  },
  {
    id: "ring",
    label: "고리 미로",
    hint: "돌아오는 길이 있는 미로입니다. 지나온 길을 미니맵으로 확인하세요.",
    cols: 15,
    rows: 15,
    seed: 5077,
    keys: 3,
    stars: { three: 0.1, two: 0.32 },
  },
  {
    id: "narrow",
    label: "좁은 통로",
    hint: "통로가 좁고 깊습니다. M 키로俯瞰 시점으로 전체 구조를 살펴보세요.",
    cols: 17,
    rows: 17,
    seed: 6053,
    keys: 4,
    stars: { three: 0.09, two: 0.3 },
  },
  {
    id: "stairs",
    label: "계단형 층",
    hint: "입구에서 출구까지 층이 여러 번 바뀝니다. 공간 기억이 중요해요.",
    cols: 19,
    rows: 19,
    seed: 7013,
    keys: 4,
    stars: { three: 0.09, two: 0.28 },
  },
  {
    id: "finale",
    label: "최종",
    hint: "가장 큰 미로, 다섯 개의 열쇠. 최적 경로를 따라가 보세요.",
    cols: 21,
    rows: 21,
    seed: 8087,
    keys: 5,
    stars: { three: 0.08, two: 0.26 },
  },
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

/**
 * 걸은 칸 수로 별점을 매긴다. par 은 BFS로 구한 최적 경로 길이다.
 * @param {number} steps 걸은 칸 수
 * @param {number} par 최적 경로 길이
 */
export function evaluateSteps(steps, par, level) {
  if (!Number.isFinite(steps) || steps < 0) return { stars: 0, steps, par };
  if (!Number.isFinite(par) || par <= 0) return { stars: 1, steps, par };
  if (steps <= par * (1 + level.stars.three)) return { stars: 3, steps, par };
  if (steps <= par * (1 + level.stars.two)) return { stars: 2, steps, par };
  return { stars: 1, steps, par };
}

/** 점수. 최적 경로에 가깝게 걸을수록 높다. */
export function scoreForSteps(steps, par) {
  if (!Number.isFinite(steps) || !Number.isFinite(par)) return 0;
  return Math.max(0, Math.round(par * 50 - (steps - par) * 20));
}
