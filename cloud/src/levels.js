// 레벨 8종. 순수 계산이라 Node 에서 그대로 테스트된다.
import { JUMP_HEIGHT, JUMP_REACH, makePlatform } from "../../common/parts/platform3d.js";

function buildLevel({ id, label, hint, clouds, halfWidth = 0.7, coinGap = 0.45 }) {
  const platforms = clouds.map(([x, top, width]) => makePlatform(x, top, width ?? halfWidth, 0.85));
  const coins = [];
  for (let i = 0; i < platforms.length - 1; i += 1) {
    const a = platforms[i];
    const b = platforms[i + 1];
    coins.push({ x: (a.x + b.x) / 2, y: Math.max(a.top, b.top) + coinGap, z: 0 });
  }
  const last = platforms[platforms.length - 1];
  return {
    id,
    label,
    hint,
    platforms,
    coins,
    goal: { x: last.x + 0.55, y: last.top + 0.85, z: 0 },
    start: { x: platforms[0].x, y: platforms[0].top, z: 0 },
  };
}

export const LEVELS = [
  buildLevel({
    id: "c01",
    label: "첫 구름",
    hint: "오른쪽으로 걸어가다 Space 로 뛰어 보세요.",
    clouds: [[0, 0], [1.7, 0], [3.4, 0], [5.1, 0], [6.8, 0]],
  }),
  buildLevel({
    id: "c02",
    label: "오르막",
    hint: "높이가 올라가면 조금 더 힘내서 뛰어 보세요.",
    clouds: [[0, 0], [1.8, 0.5], [3.6, 1], [5.4, 1.3], [7.2, 1.6], [9, 1.9]],
  }),
  buildLevel({
    id: "c03",
    label: "내리막",
    hint: "내려갈 때는 조심하지만 점프는 쉬워요.",
    clouds: [[0, 2], [1.8, 1.5], [3.6, 1], [5.4, 0.6], [7.2, 0.2], [9, 0]],
  }),
  buildLevel({
    id: "c04",
    label: "좁은 구름",
    hint: "구름이 좁아요. 정확히 밟아야 해요.",
    halfWidth: 0.45,
    clouds: [[0, 0], [2, 0.2], [4, 0.4], [6, 0.6], [8, 0.5], [10, 0.4], [12, 0.3]],
  }),
  buildLevel({
    id: "c05",
    label: "높은 구름",
    hint: "높이 차가 커요. 꼭대기에 딱 밟으세요.",
    clouds: [[0, 0], [2, 0.9], [4, 1.3], [6, 0.6], [8, 1.2], [10, 0.5], [12, 0]],
  }),
  buildLevel({
    id: "c06",
    label: "코인 길",
    hint: "동전을 모으면 별이 높아져요.",
    clouds: [[0, 0], [2, 0.3], [4, 0.6], [6, 0.9], [8, 1.2], [10, 1], [12, 0.8], [14, 0.6]],
  }),
  buildLevel({
    id: "c07",
    label: "큰 구름",
    hint: "마지막 구름이 넓어요. 편하게 도착하세요.",
    clouds: [[0, 0], [2.2, 0.4], [4.4, 0.8], [6.6, 0.7], [8.8, 0.5], [11, 0.3], [13.4, 0.2, 2.2]],
  }),
  buildLevel({
    id: "c08",
    label: "하늘 성",
    hint: "가장 긴 길이에요. 끝까지 가 보세요.",
    clouds: [[0, 0], [2.1, 0.6], [4.2, 1.1], [6.3, 0.9], [8.4, 1.3], [10.5, 0.8], [12.6, 1.2], [14.7, 0.7], [17, 0.4, 1.6]],
  }),
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function levelIndexById(id) {
  return LEVELS.findIndex((level) => level.id === id);
}

/** 인접한 두 구름 사이에 벌어진 거리. */
export function gaps(level) {
  const list = [];
  for (let i = 0; i < level.platforms.length - 1; i += 1) {
    const a = level.platforms[i];
    const b = level.platforms[i + 1];
    list.push({ from: a, to: b, gap: b.x - a.x, rise: b.top - a.top });
  }
  return list;
}

/** 도달 가능한 레벨인지 검사한다. */
export function checkLevel(level) {
  const problems = [];
  for (const entry of gaps(level)) {
    if (entry.gap > JUMP_REACH + 1e-9) {
      problems.push(`구름 간격 ${entry.gap.toFixed(2)} m 이 점프 도달 거리 ${JUMP_REACH.toFixed(2)} m 를 넘습니다`);
    }
    if (entry.rise > JUMP_HEIGHT + 1e-9) {
      problems.push(`높이 차 ${entry.rise.toFixed(2)} m 가 점프 높이 ${JUMP_HEIGHT.toFixed(2)} m 를 넘습니다`);
    }
  }
  return problems;
}

export function evaluateLevel(level, { reached, coins, totalCoins }) {
  const cleared = reached;
  let stars = 0;
  if (cleared) stars = coins >= totalCoins ? 3 : 2;
  else if (coins > 0) stars = 1;
  return { cleared, stars, score: stars * 100 + coins * 10, coins, totalCoins };
}

export { JUMP_HEIGHT, JUMP_REACH };
