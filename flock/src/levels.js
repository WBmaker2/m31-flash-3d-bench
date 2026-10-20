// 레벨 데이터와 판정 규칙. 순수 계산, three에 의존하지 않는다.

export const ARENA = { halfX: 30, halfY: 11, halfZ: 24 };
/** 링 반경. 무리(흩어짐 약 13 m)보다 조금 작게 두어 "무리 일부가 통과"가 되게 한다. */
export const GATE_RADIUS = 9;
/** 불빛이 이 거리 안으로 들어오면 "플레이어가 링을 두고 좋다" 로 본다. */
export const GATE_LIGHT_RADIUS = 14;

export const LEVELS = [
  {
    id: "first",
    label: "첫 무리",
    hint: "WASD로 불빛을 움직여 새 떼를 링을 통과시키세요. 떼가 흩어지지 않게 천천히 몰아야 합니다.",
    birds: 120,
    gates: 3,
    timeLimit: 70,
    scatterLimit: 22,
    seed: 3301,
  },
  {
    id: "branch",
    label: "두 갈래",
    hint: "게이트가 지그재그로 놓입니다. 다음 링의 방향을 미리 보고 불빛을 옮기세요.",
    birds: 160,
    gates: 4,
    timeLimit: 90,
    scatterLimit: 21,
    seed: 4409,
  },
  {
    id: "long",
    label: "긴 길",
    hint: "떼가 커지고 링이 멀어집니다. 한 번에 크게 돌리지 말고 부드럽게 끄세요.",
    birds: 200,
    gates: 5,
    timeLimit: 120,
    scatterLimit: 20,
    seed: 5513,
  },
  {
    id: "high",
    label: "높은 문",
    hint: "높이가 다른 링이 섞였습니다. 불빛의 높이를 함께 조절해 보세요.",
    birds: 220,
    gates: 5,
    timeLimit: 135,
    scatterLimit: 19,
    seed: 6619,
  },
  {
    id: "narrow",
    label: "좁은 통로",
    hint: "링 사이가 좁아집니다. 떼가 흩어지면 다음 링을 통과하기 어려워져요.",
    birds: 260,
    gates: 6,
    timeLimit: 150,
    scatterLimit: 18,
    seed: 7723,
  },
  {
    id: "twherd",
    label: "두 무리",
    hint: "새가 많습니다. 불빛을 천천히 옮겨야 떼가 흩어지지 않아요.",
    birds: 300,
    gates: 6,
    timeLimit: 165,
    scatterLimit: 17,
    seed: 8837,
  },
  {
    id: "walls",
    label: "벽길",
    hint: "링이 좁은 틈 사이로 이어집니다. 속도를 줄이고 정밀하게 몰아 보세요.",
    birds: 340,
    gates: 6,
    timeLimit: 185,
    scatterLimit: 16,
    seed: 9941,
  },
  {
    id: "finale",
    label: "최종",
    hint: "가장 큰 무리, 여덟 개의 링. 시간 안에 흩어짐 없이 몰아 보세요.",
    birds: 400,
    gates: 7,
    timeLimit: 210,
    scatterLimit: 15,
    seed: 10159,
  },
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

/**
 * 링 배치를 만든다. 경기장 안을 지그재그로 도는 경로다.
 * @returns {Array<{id:string, center:object, normal:object, radius:number}>}
 */
export function buildGates(level) {
  const gates = [];
  const columns = Math.ceil(level.gates / 2);
  const cellWidth = (ARENA.halfX * 2) / columns;
  const rowOffset = ARENA.halfZ * 0.3;
  for (let i = 0; i < level.gates; i += 1) {
    const column = Math.floor(i / 2);
    const row = i % 2;
    const x = -ARENA.halfX + (column + 0.5) * cellWidth;
    const z = row === 0 ? -rowOffset : rowOffset;
    const y = 2.2 + ((i * 7) % 3) * 1.3;
    const normal = row === 0 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
    gates.push({ id: `gate-${i}`, center: { x, y, z }, normal, radius: GATE_RADIUS });
  }
  return gates;
}

/**
 * 무리가 출발할 영역. 첫 링보다 뒤쪽(법선 반대편)에 있어야
 * 산포된 새가 링을 잘못 통과하지 않는다.
 */
export function startRegion(level) {
  const gate = buildGates(level)[0];
  const margin = 2;
  const region = {
    minX: -ARENA.halfX + 1,
    maxX: ARENA.halfX - 1,
    minY: -ARENA.halfY + 1,
    maxY: ARENA.halfY - 1,
    minZ: -ARENA.halfZ + 1,
    maxZ: ARENA.halfZ - 1,
  };
  if (gate.normal.x > 0.5) region.maxX = Math.min(region.maxX, gate.center.x - margin);
  if (gate.normal.x < -0.5) region.minX = Math.max(region.minX, gate.center.x + margin);
  if (gate.normal.z > 0.5) region.maxZ = Math.min(region.maxZ, gate.center.z - margin);
  if (gate.normal.z < -0.5) region.minZ = Math.max(region.minZ, gate.center.z + margin);
  return region;
}

/**
 * 판정. 통과한 링 수 · 남은 시간 · 흩어짐으로 별점을 준다.
 * @param {{gatesPassed:number, gatesTotal:number, timeLeft:number, spread:number}} result
 */
export function evaluateFlock(result, level) {
  const { gatesPassed = 0, gatesTotal = level.gates, timeLeft = 0, spread = 0 } = result;
  const cleared = gatesPassed >= gatesTotal;
  if (!cleared) return { cleared: false, stars: 0, gatesPassed, spread };
  const ratio = spread / level.scatterLimit;
  const stars = ratio <= 1 ? 3 : ratio <= 1.6 ? 2 : 1;
  return { cleared, stars, gatesPassed, spread };
}

/** 점수. 통과한 링 · 남은 시간 · 흩어짐을 함께 반영한다. */
export function scoreForFlock(result, level) {
  const { gatesPassed = 0, timeLeft = 0, spread = 0 } = result;
  const base = gatesPassed * 120;
  const timeBonus = Math.round(Math.max(0, timeLeft) * 8);
  const scatterPenalty = Math.round(Math.max(0, spread - level.scatterLimit) * 25);
  return Math.max(0, base + timeBonus - scatterPenalty);
}
