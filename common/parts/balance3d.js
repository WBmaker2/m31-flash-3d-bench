// 시소매 저울의 역학 계산. 순수 함수라 Node 에서 그대로 테스트된다.

export const GRAVITY = 9.8;
export const MAX_TILT = 0.6;

/** 추: { slot, x, mass } */
export function momentSum(weights, fulcrumX) {
  let torque = 0;
  let totalMass = 0;
  for (const weight of weights) {
    const arm = weight.x - fulcrumX;
    torque += weight.mass * GRAVITY * arm;
    totalMass += weight.mass;
  }
  return { torque, totalMass };
}

export function beamAngle({ torque, totalMass }) {
  if (totalMass === 0) return 0;
  return Math.atan2(torque, totalMass * GRAVITY);
}

export function centerOfMass(weights) {
  let mass = 0;
  let weighted = 0;
  for (const weight of weights) {
    mass += weight.mass;
    weighted += weight.mass * weight.x;
  }
  if (mass === 0) return 0;
  return weighted / mass;
}

export function isLevel(weights, fulcrumX, tolerance = 1e-9) {
  const { torque } = momentSum(weights, fulcrumX);
  return Math.abs(torque) <= tolerance;
}

/** 저울 상태를 한 번에 계산한다. */
export function evaluateBalance({
  weights,
  fulcrumX,
  targetMass,
  massTolerance = 1e-9,
  torqueTolerance = 1e-9,
}) {
  const { torque, totalMass } = momentSum(weights, fulcrumX);
  const angle = beamAngle({ torque, totalMass });
  const level = Math.abs(torque) <= torqueTolerance;
  const massOk = Math.abs(totalMass - targetMass) <= massTolerance;
  return {
    torque,
    totalMass,
    angle,
    center: centerOfMass(weights),
    level,
    massOk,
    cleared: level && massOk,
  };
}

/**
 * 두 조건(수평 + 목표 무게)을 만족하는 최소 추 개수.
 * 목표 무게를 넘는 조합은 자르고, 가짓수가 작아서 전수 조사로 구한다.
 */
export function minimumWeights({ slots, masses, fulcrumX, targetMass, blockedSlot = -1 }) {
  let best = Infinity;
  const walk = (index, picked, mass) => {
    if (mass > targetMass + 1e-9) return;
    if (index === slots.length) {
      const weights = picked.map((item) => ({
        slot: item.slot,
        x: slots[item.slot].x,
        mass: item.mass,
      }));
      const result = evaluateBalance({ weights, fulcrumX, targetMass });
      if (result.cleared && picked.length < best) best = picked.length;
      return;
    }
    if (index === blockedSlot) {
      walk(index + 1, picked, mass);
      return;
    }
    walk(index + 1, picked, mass);
    for (const value of masses) {
      walk(index + 1, [...picked, { slot: index, mass: value }], mass + value);
    }
  };
  walk(0, [], 0);
  return best;
}

/** 최소 개수로 맞추는 해 하나. */
export function findSolution({ slots, masses, fulcrumX, targetMass, blockedSlot = -1 }) {
  let answer = null;
  const walk = (index, picked, mass) => {
    if (answer) return;
    if (mass > targetMass + 1e-9) return;
    if (index === slots.length) {
      const weights = picked.map((item) => ({
        slot: item.slot,
        x: slots[item.slot].x,
        mass: item.mass,
      }));
      const result = evaluateBalance({ weights, fulcrumX, targetMass });
      if (result.cleared) answer = picked.map((item) => ({ ...item }));
      return;
    }
    if (index === blockedSlot) {
      walk(index + 1, picked, mass);
      return;
    }
    walk(index + 1, picked, mass);
    for (const value of masses) {
      walk(index + 1, [...picked, { slot: index, mass: value }], mass + value);
    }
  };
  walk(0, [], 0);
  return answer;
}
