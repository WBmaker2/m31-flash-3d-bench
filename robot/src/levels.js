// 레벨 데이터와 판정 규칙. 순수 계산, three에 의존하지 않는다.
// 좌표는 벤치 위(지면 y = 0). 목표 표적의 y 가 0 이 아니면 받침 기둥이 생긴다.

export const RACK = { x: -1.45, z: 1.9, height: 0.22 };
export const BLOCK_SIZE = 0.34;
export const PICKUP_Y = 0.3;
/** 표적 판이 작업대 위로 솟은 높이. 판의 윗면이 곧 블록이 놓이는 높이다. */
export const PLATE_OFFSET = 0.006;

export const LEVELS = [
  {
    id: "first",
    label: "첫 조립",
    hint: "파란 판 위에 블록을 놓으세요. 회색 판은 도달 반경 밖입니다.",
    targets: [
      { id: "goal", x: 1.6, z: 0.9, y: 0, kind: "goal" },
      { id: "far", x: 3.05, z: 2.85, y: 0, kind: "decoy" },
    ],
    pillars: [],
    tolerance: 0.5,
    stars: { three: 0.12, two: 0.28 },
  },
  {
    id: "far",
    label: "먼 곳",
    hint: "도달 반경 한가운데를 노려 보세요. 발사대가 낮아질수록 팔을 펴야 합니다.",
    targets: [
      { id: "goal", x: 2.2, z: 1.9, y: 0, kind: "goal" },
      { id: "far", x: 3.05, z: 2.85, y: 0, kind: "decoy" },
    ],
    pillars: [],
    tolerance: 0.4,
    stars: { three: 0.1, two: 0.24 },
  },
  {
    id: "fold",
    label: "접힌 팔",
    hint: "가까이 있는 목표는 팔꿈치를 접어야 닿습니다. 끝까지 펴면 손이 모자라요.",
    targets: [
      { id: "goal", x: 1.2, z: 1.0, y: 0, kind: "goal" },
      { id: "far", x: 3.05, z: 2.85, y: 0, kind: "decoy" },
    ],
    pillars: [],
    tolerance: 0.35,
    stars: { three: 0.09, two: 0.21 },
  },
  {
    id: "pillar",
    label: "기둥 우회",
    hint: "기둥이 길을 막습니다. 팔꿈치 방향을 바꿔 기둥을 돌아야 합니다.",
    targets: [
      { id: "goal", x: 1.9, z: 1.9, y: 0, kind: "goal" },
      { id: "far", x: 3.05, z: 2.85, y: 0, kind: "decoy" },
    ],
    pillars: [{ id: "p1", x: 0.75, z: 1.05, radius: 0.26, height: 1.3 }],
    tolerance: 0.3,
    stars: { three: 0.08, two: 0.18 },
  },
  {
    id: "reach",
    label: "도달 불가",
    hint: "회색 판은 손이 닿지 않습니다. 파란 판을 찾아 정확히 놓으세요.",
    targets: [
      { id: "goal", x: 2.6, z: 0.6, y: 0, kind: "goal" },
      { id: "far", x: 3.05, z: 2.85, y: 0, kind: "decoy" },
    ],
    pillars: [],
    tolerance: 0.28,
    stars: { three: 0.07, two: 0.17 },
  },
  {
    id: "high",
    label: " 높은 목표",
    hint: "높은 받침대 위 목표입니다. 팔을 들어 올려야 닿습니다.",
    targets: [
      { id: "goal", x: 1.5, z: 1.2, y: 1.7, kind: "goal" },
      { id: "far", x: 3.05, z: 2.85, y: 0, kind: "decoy" },
    ],
    pillars: [],
    tolerance: 0.2,
    stars: { three: 0.05, two: 0.12 },
  },
  {
    id: "double",
    label: "이중 장애물",
    hint: "기둥이 두 개입니다. 어느 쪽으로 접을지 팔이 고릅니다.",
    targets: [
      { id: "goal", x: 1.6, z: 2.1, y: 0, kind: "goal" },
      { id: "far", x: 3.05, z: 2.85, y: 0, kind: "decoy" },
    ],
    pillars: [
      { id: "p1", x: 0.55, z: 1.15, radius: 0.24, height: 1.25 },
      { id: "p2", x: 0.85, z: 0.85, radius: 0.24, height: 1.25 },
    ],
    tolerance: 0.14,
    stars: { three: 0.04, two: 0.09 },
  },
  {
    id: "finale",
    label: "최종",
    hint: "가장 먼 자리, 기둥, 좁은 허용 오차. 정밀하게 놓으세요.",
    targets: [
      { id: "goal", x: 1.85, z: 2.0, y: 0, kind: "goal" },
      { id: "far", x: 3.05, z: 2.85, y: 0, kind: "decoy" },
    ],
    pillars: [{ id: "p1", x: 0.7, z: 1.1, radius: 0.28, height: 1.4 }],
    tolerance: 0.08,
    stars: { three: 0.02, two: 0.05 },
  },
];

/** 레벨의 정답 표적(놓아야 하는 곳). */
export function goalOf(level) {
  return level.targets.find((target) => target.kind === "goal") ?? level.targets[0];
}

/** 놓을 목표 지점(블록의 중심). 판의 윗면 위에 블록이 올라간다. */
export function goalPoint(level) {
  const goal = goalOf(level);
  return { x: goal.x, y: goal.y + PLATE_OFFSET + BLOCK_SIZE / 2, z: goal.z };
}

/** 블록을 집을 지점. */
export function pickupPoint(level = LEVELS[0]) {
  return { x: RACK.x, y: RACK.height + BLOCK_SIZE / 2, z: RACK.z };
}

/**
 * 배치 오차를 판정한다.
 * @param {number} error 목표 중심으로부터의 거리(m)
 */
export function evaluatePlacement(error, level) {
  if (!Number.isFinite(error)) return { cleared: false, stars: 0, error };
  const stars = error <= level.stars.three ? 3 : error <= level.stars.two ? 2 : error <= level.tolerance ? 1 : 0;
  return { cleared: stars > 0, stars, error };
}
