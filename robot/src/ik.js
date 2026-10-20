// 2절 역기구학 · 정방향 키네마틱 · 링크 충돌. 순수 계산, three에 의존하지 않는다.
// 단위: m, rad. 좌표계: Y 가 위, +Z 가 정면(발사대 앞), 베이스 회전 0 은 +Z.

export const ARM = {
  shoulderHeight: 0.9, // 어깨 관절 높이
  upperLength: 1.6, // 위팔 l1
  forearmLength: 1.65, // 팔꿈치~그리퍼 l2 (앞팔 1.4 + 그리퍼 0.25)
};

export function armReach(config = ARM) {
  return config.upperLength + config.forearmLength;
}

export function armMinReach(config = ARM) {
  return Math.abs(config.upperLength - config.forearmLength);
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * 목표 좌표에서 관절 각을 푼다.
 * sign = +1 은 팔꿈치가 위로, -1 은 아래로 접힌 해.
 * @returns {{baseYaw:number, shoulder:number, elbow:number, reachable:boolean, residual:number}}
 */
export function solveArm(target, config = ARM, sign = 1) {
  const l1 = config.upperLength;
  const l2 = config.forearmLength;
  const baseYaw = Math.atan2(target.x, target.z);
  const r = Math.hypot(target.x, target.z);
  const y = target.y - config.shoulderHeight;
  const d = Math.hypot(r, y);

  const maxReach = armReach(config);
  const minReach = armMinReach(config);
  const shortfall = Math.abs(d - clamp(d, minReach, maxReach));

  if (d > maxReach + 1e-9 || d < minReach - 1e-9) {
    return { baseYaw, shoulder: 0, elbow: 0, reachable: false, residual: shortfall };
  }
  if (d < 1e-9) {
    // 어깨 바로 아래/위: 완전히 접은 상태
    return { baseYaw, shoulder: 0, elbow: sign * Math.PI, reachable: true, residual: 0 };
  }

  const cosGamma = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const gamma = Math.acos(cosGamma);
  const cosBend = clamp((d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
  const bend = Math.acos(cosBend);
  const alpha = Math.atan2(y, r);

  const shoulder = alpha + sign * gamma;
  const elbow = -sign * bend;
  const angles = { baseYaw, shoulder, elbow };

  const tip = forwardArm(angles, config).tip;
  const residual = Math.hypot(tip.x - target.x, tip.y - target.y, tip.z - target.z);
  return { ...angles, reachable: true, residual };
}

/**
 * 관절 각에서 끝점 좌표를 구한다. solveArm 의 역함수.
 * @returns {{shoulderPos:object, elbowPos:object, tip:object}}
 */
export function forwardArm(angles, config = ARM) {
  const l1 = config.upperLength;
  const l2 = config.forearmLength;
  const baseYaw = angles.baseYaw ?? 0;
  const shoulder = angles.shoulder ?? 0;
  const elbow = angles.elbow ?? 0;

  const sinYaw = Math.sin(baseYaw);
  const cosYaw = Math.cos(baseYaw);
  const toWorld = (r, y) => ({ x: r * sinYaw, y, z: r * cosYaw });

  const j1r = l1 * Math.cos(shoulder);
  const j1y = l1 * Math.sin(shoulder);
  const j2r = j1r + l2 * Math.cos(shoulder + elbow);
  const j2y = j1y + l2 * Math.sin(shoulder + elbow);

  return {
    shoulderPos: toWorld(0, config.shoulderHeight),
    elbowPos: toWorld(j1r, config.shoulderHeight + j1y),
    tip: toWorld(j2r, config.shoulderHeight + j2y),
  };
}

/** 관절 각에서 두 링크의 3D 선분을 얻는다(충돌 검사용). */
export function armLinks(angles, config = ARM) {
  const { shoulderPos, elbowPos, tip } = forwardArm(angles, config);
  return [
    { a: shoulderPos, b: elbowPos },
    { a: elbowPos, b: tip },
  ];
}

/** 선분 위에서 평면상 가장 가까운 점의 매개변수. */
export function closestParam2D(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length2 = dx * dx + dz * dz;
  if (length2 < 1e-12) return 0;
  const t = ((point.x - a.x) * dx + (point.z - a.z) * dz) / length2;
  return clamp(t, 0, 1);
}

/** 점과 선분 사이의 3D 최단 거리. */
export function pointSegmentDistance(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const length2 = abx * abx + aby * aby + abz * abz;
  if (length2 < 1e-12) return Math.hypot(point.x - a.x, point.y - a.y, point.z - a.z);
  let t = ((point.x - a.x) * abx + (point.y - a.y) * aby + (point.z - a.z) * abz) / length2;
  t = clamp(t, 0, 1);
  return Math.hypot(point.x - (a.x + abx * t), point.y - (a.y + aby * t), point.z - (a.z + abz * t));
}

/**
 * 링크 선분이 세로 원기둥(기둥)과 부딪히는지 본다.
 * @param {{a:object,b:object}} segment
 * @param {{x:number,z:number,radius:number,height:number}} pillar
 */
export function segmentHitsCylinder(segment, pillar) {
  const { a, b } = segment;
  const t = closestParam2D({ x: pillar.x, z: pillar.z }, a, b);
  const px = a.x + (b.x - a.x) * t;
  const pz = a.z + (b.z - a.z) * t;
  const py = a.y + (b.y - a.y) * t;

  if (py >= 0 && py <= pillar.height) {
    return Math.hypot(px - pillar.x, pz - pillar.z) < pillar.radius;
  }
  if (py > pillar.height) {
    const top = { x: pillar.x, y: pillar.height, z: pillar.z };
    return pointSegmentDistance(top, a, b) < pillar.radius;
  }
  return false;
}

/** 관절 각으로 만든 링크가 기둥에 막히는지. */
export function linksHitPillars(angles, pillars = [], config = ARM) {
  return armLinks(angles, config).some((segment) =>
    pillars.some((pillar) => segmentHitsCylinder(segment, pillar)),
  );
}

/**
 * 목표 지점에 블록을 놓는 계획. 두 해 중 기둥에 막히지 않는 것을 고른다.
 * @returns {{angles:object, reachable:boolean, blocked:boolean, residual:number}}
 */
export function planPlacement(target, pillars = [], config = ARM) {
  const up = solveArm(target, config, 1);
  const down = solveArm(target, config, -1);
  const candidates = [up, down].filter((candidate) => candidate.reachable);

  if (candidates.length === 0) {
    return { angles: up, reachable: false, blocked: false, residual: up.residual };
  }

  const free = candidates.find((candidate) => !linksHitPillars(candidate, pillars, config));
  if (free) {
    return { angles: free, reachable: true, blocked: false, residual: free.residual };
  }
  return { angles: candidates[0], reachable: true, blocked: true, residual: candidates[0].residual };
}

/** 각도를 정규화해 (-π, π] 범위로 되돌린다. */
export function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  let value = angle % twoPi;
  if (value > Math.PI) value -= twoPi;
  if (value <= -Math.PI) value += twoPi;
  return value;
}

/** 두 관절 각 사이의 최단 회전량. */
export function shortestAngleDelta(from, to) {
  return normalizeAngle(to - from);
}

/** 관절 각을 부드럽게 섞는다(애니메이션용). */
export function blendAngles(from, to, t) {
  const ratio = clamp(t, 0, 1);
  return {
    baseYaw: from.baseYaw + shortestAngleDelta(from.baseYaw, to.baseYaw) * ratio,
    shoulder: from.shoulder + (to.shoulder - from.shoulder) * ratio,
    elbow: from.elbow + (to.elbow - from.elbow) * ratio,
  };
}
