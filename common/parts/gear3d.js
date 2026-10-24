// 톱니바퀴의 순수 계산. three 에 묶지 않아 Node 에서 그대로 테스트된다.
// 기어비와 위상은 다른 게임에서도 재사용할 수 있게 공용(common/parts/)에 둔다.

export const TOOTH_MODULE = 0.02;
export const RADIUS_PER_TOOTH = TOOTH_MODULE / 2;
export const GEAR_SIZES = [8, 12, 16, 20, 24];
export const MESH_TOLERANCE = 1e-6;
export const SPEED_TOLERANCE = 0.01;
export const INPUT_REV_PER_SEC = 1;
export const PHASE_TOLERANCE = 1e-9;
export const MESH_PHASE = Math.PI;

export function gearRadius(teeth) {
  return teeth * RADIUS_PER_TOOTH;
}

export function gearDiameter(teeth) {
  return 2 * gearRadius(teeth);
}

export function gearRatio(fromTeeth, toTeeth) {
  return fromTeeth / toTeeth;
}

export function slotDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function meshDistance(teethA, teethB) {
  return gearRadius(teethA) + gearRadius(teethB);
}

export function isMeshing(a, b, teethA, teethB, tolerance = MESH_TOLERANCE) {
  return Math.abs(slotDistance(a, b) - meshDistance(teethA, teethB)) <= tolerance;
}

export function overlaps(a, b, teethA, teethB, tolerance = MESH_TOLERANCE) {
  return slotDistance(a, b) < meshDistance(teethA, teethB) - tolerance;
}

/** 각도를 [0, 2π) 로 접는다. */
export function normalizeAngle(angle) {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

/**
 * 톱니가 실제로 맞물리도록 각 톱니바퀴의 위상 오프셋을 계산한다.
 * 톱니바퀴 A 의 톱니 중심이 두 톱니바퀴의 중심을 잇는 선 위에 있고,
 * B 의 홈 중심도 같은 선 위에 있으면 맞물린 상태다.
 */
export function phaseOffsets(nodes, graph, inputId) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const offsets = new Map();
  offsets.set(inputId, 0);
  const stack = [inputId];

  while (stack.length > 0) {
    const id = stack.pop();
    const a = byId.get(id);
    for (const nextId of graph.get(id) ?? []) {
      if (offsets.has(nextId)) continue;
      const b = byId.get(nextId);
      const psi = Math.atan2(b.z - a.z, b.x - a.x);
      const target = psi * (a.teeth + b.teeth) + Math.PI * b.teeth - Math.PI;
      const offB = (target - a.teeth * offsets.get(id)) / b.teeth;
      offsets.set(nextId, normalizeAngle(offB));
      stack.push(nextId);
    }
  }

  return offsets;
}

/** 2π 의 배수에서 얼마나 떨어져 있는가. */
export function modDistance(value, base = Math.PI * 2) {
  const mod = ((value % base) + base) % base;
  return Math.min(mod, base - mod);
}

/** 맞물린 두 톱니바퀴의 접촉 지점에서 톱니와 홈이 마주 보는지. */
export function meshAlignment({ a, b, psi, thetaA, thetaB }) {
  const toothA = a.teeth * (psi - thetaA);
  const gapB = b.teeth * (psi + Math.PI - thetaB);
  const sum = toothA + gapB;
  return {
    tooth: toothA,
    gap: gapB,
    sum,
    aligned: modDistance(sum - Math.PI) < PHASE_TOLERANCE,
  };
}

/** 톱니바퀴 노드: { id, teeth, x, z } */
export function buildMeshGraph(nodes, tolerance = MESH_TOLERANCE) {
  const graph = new Map();
  for (const node of nodes) graph.set(node.id, []);
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      if (!isMeshing(a, b, a.teeth, b.teeth, tolerance)) continue;
      graph.get(a.id).push(b.id);
      graph.get(b.id).push(a.id);
    }
  }
  return graph;
}

export function meshingPairs(nodes, tolerance = MESH_TOLERANCE) {
  const pairs = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      if (isMeshing(a, b, a.teeth, b.teeth, tolerance)) pairs.push([a, b]);
    }
  }
  return pairs;
}

/**
 * 크랭크에서 출발해 맞물림을 따라 각속도를 전파한다.
 * ratio 는 크랭크 대비 부호 있는 비율이다. 한 단 맞물릴 때마다 부호가 뒤집힌다.
 */
export function propagateRotation({ nodes, inputId, inputOmega = INPUT_REV_PER_SEC, tolerance = MESH_TOLERANCE }) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const graph = buildMeshGraph(nodes, tolerance);
  const ratio = new Map();
  const omega = new Map();
  const conflicts = [];

  ratio.set(inputId, 1);
  omega.set(inputId, inputOmega);
  const stack = [inputId];

  while (stack.length > 0) {
    const id = stack.pop();
    const current = byId.get(id);
    const currentRatio = ratio.get(id);
    for (const nextId of graph.get(id) ?? []) {
      const next = byId.get(nextId);
      const nextRatio = -currentRatio * gearRatio(current.teeth, next.teeth);
      if (ratio.has(nextId)) {
        const actual = ratio.get(nextId);
        if (Math.abs(actual - nextRatio) > PHASE_TOLERANCE) {
          conflicts.push({ a: id, b: nextId, expected: nextRatio, actual });
        }
        continue;
      }
      ratio.set(nextId, nextRatio);
      omega.set(nextId, inputOmega * nextRatio);
      stack.push(nextId);
    }
  }

  for (const node of nodes) {
    if (ratio.has(node.id)) continue;
    ratio.set(node.id, 0);
    omega.set(node.id, 0);
  }

  return { ratio, omega, graph, conflicts };
}

/** 톱니가 맞물린 두 기어의 위상량. 맞물림이 유지되면 일정해야 한다. */
export function phaseValue(thetaA, teethA, thetaB, teethB) {
  return thetaA * teethA + thetaB * teethB;
}

/** t 초 뒤 크랭크가 돌린 각도(rad). 각속도는 회전/초 단위다. */
export function crankAngle(inputOmega, seconds) {
  return inputOmega * Math.PI * 2 * seconds;
}

/** 전파 결과로 각 기어의 각도를 구한다(위상 오프셋 포함). */
export function gearAngles(ratio, inputOmega, seconds, offsets) {
  const base = crankAngle(inputOmega, seconds);
  const angles = new Map();
  for (const [id, value] of ratio) {
    angles.set(id, base * value + (offsets.get(id) ?? 0));
  }
  return angles;
}

/** 이 위치에 이 크기의 톱니바퀴를 끼울 수 있는가(겹치면 안 된다). */
export function canPlaceAt(nodes, slot, teeth, tolerance = MESH_TOLERANCE) {
  for (const node of nodes) {
    if (node.id === slot.id) continue;
    if (overlaps(slot, node, teeth, node.teeth, tolerance)) return false;
  }
  return true;
}

/** 겹치는 톱니바퀴 쌍. */
export function overlappingPairs(nodes, tolerance = MESH_TOLERANCE) {
  const pairs = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      if (overlaps(a, b, a.teeth, b.teeth, tolerance)) pairs.push([a, b]);
    }
  }
  return pairs;
}
