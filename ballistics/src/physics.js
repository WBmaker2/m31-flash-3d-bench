// 순수 물리 계산. three에 의존하지 않는다(좌표는 {x, y, z} 평범한 객체).
// 단위: 거리 m · 속도 m/s · 시간 s · 각도 rad(표시는 deg) · 가속도 m/s²

export const GRAVITY_MPS2 = 9.8;
export const DEFAULT_STEP_SECONDS = 1 / 60;
export const PROJECTILE_RADIUS_M = 0.18;
export const BLOCK_SIZE_M = 2;
export const BLOCK_HALF_M = BLOCK_SIZE_M / 2;

export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPoint(from, to, t) {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    z: lerp(from.z, to.z, t),
  };
}

function isFinitePoint(point) {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
}

/**
 * 일정 가속도 한 스텝. 중력·바람·공기저항은 스텝 안에서 상수 취급하므로
 * 해석해를 정확히 재현한다(위치 오차 0, 에너지 보존).
 * @param {{position:{x,y,z}, velocity:{x,y,z}}} state
 */
export function stepProjectile(state, options = {}) {
  const dt = options.dt ?? DEFAULT_STEP_SECONDS;
  const gravity = options.gravity ?? GRAVITY_MPS2;
  const wind = options.wind ?? { x: 0, z: 0 };
  const drag = options.drag ?? 0;

  const position = state.position;
  const velocity = state.velocity;

  const ax = wind.x - drag * velocity.x;
  const ay = -gravity - drag * velocity.y;
  const az = wind.z - drag * velocity.z;

  return {
    position: {
      x: position.x + velocity.x * dt + 0.5 * ax * dt * dt,
      y: position.y + velocity.y * dt + 0.5 * ay * dt * dt,
      z: position.z + velocity.z * dt + 0.5 * az * dt * dt,
    },
    velocity: {
      x: velocity.x + ax * dt,
      y: velocity.y + ay * dt,
      z: velocity.z + az * dt,
    },
  };
}

/** AABB의 가장 가까운 점. 경계는 안쪽으로 당긴다. */
export function closestPointOnAabb(point, box) {
  return {
    x: clamp(point.x, box.min.x, box.max.x),
    y: clamp(point.y, box.min.y, box.max.y),
    z: clamp(point.z, box.min.z, box.max.z),
  };
}

/** 구와 AABB의 충돌 여부. 경계 접촉도 충돌로 본다. */
export function sphereIntersectsAabb(center, radius, box) {
  const closest = closestPointOnAabb(center, box);
  const dx = center.x - closest.x;
  const dy = center.y - closest.y;
  const dz = center.z - closest.z;
  // 접촉도 충돌이다. 부동소수점 오차로 경계 판정이 흔들리지 않게 여유를 준다.
  const limit = radius + 1e-9;
  return dx * dx + dy * dy + dz * dz <= limit * limit;
}

/**
 * 선분 구간에서 가장 먼저 만나는 블록. 빠른 발사체가 스텝 사이를 관통하지 않도록
 * 구간을 샘플링해 검사한다.
 */
export function hitAlongSegment(from, to, radius, boxes = []) {
  if (boxes.length === 0) return null;
  const length = distance(from, to);
  const steps = Math.max(1, Math.ceil(length / Math.max(radius * 0.5, 1e-6)));

  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const point = lerpPoint(from, to, t);
    for (const box of boxes) {
      if (sphereIntersectsAabb(point, radius, box)) {
        return { box, point, t };
      }
    }
  }
  return null;
}

/**
 * 탄도 비행 전체를 고정 스텝으로 시뮬레이션.
 * @returns {{points:Array, landed:boolean, hit:object|null, state:object}}
 */
export function simulateFlight(initial, options = {}) {
  const dt = options.dt ?? DEFAULT_STEP_SECONDS;
  const maxSteps = options.maxSteps ?? 1200;
  const radius = options.radius ?? PROJECTILE_RADIUS_M;
  const groundY = options.groundY ?? 0;
  const source = options.boxes ?? [];
  const bounds = options.bounds ?? 400;
  // 이동하는 표적은 시각마다 위치가 달라진다. boxes 를 함수로 넘기면 그 시각의 목록을 돌려준다.
  const resolveBoxes = (time) => (typeof source === "function" ? source(time) : source);

  let state = {
    position: { ...initial.position },
    velocity: { ...initial.velocity },
  };
  const points = [{ ...state.position }];
  let landed = false;
  let hit = null;

  for (let step = 0; step < maxSteps; step += 1) {
    const previous = state.position;
    const next = stepProjectile(state, { ...options, dt });
    const found = hitAlongSegment(previous, next.position, radius, resolveBoxes(step * dt));
    if (found) {
      state = { position: found.point, velocity: next.velocity };
      points.push({ ...found.point });
      hit = found;
      break;
    }
    state = next;
    points.push({ ...state.position });

    if (state.position.y <= groundY + radius) {
      landed = true;
      break;
    }
    if (
      !isFinitePoint(state.position) ||
      Math.abs(state.position.x) > bounds ||
      Math.abs(state.position.y) > bounds ||
      Math.abs(state.position.z) > bounds
    ) {
      break;
    }
  }

  return { points, landed, hit, state };
}

/**
 * 지지 상실로 무너지는 블록. 지지 블록이 사라지면 연쇄적으로 전부 무너진다.
 * @param {Array<{id:string,i:number,j:number,k:number,floating?:boolean}>} blocks
 * @returns {string[]} 무너지는 블록 id
 */
export function findUnsupported(blocks = []) {
  const key = (i, j, k) => `${i},${j},${k}`;
  const remaining = new Map(blocks.map((block) => [block.id, block]));
  const falling = [];
  let changed = true;

  while (changed) {
    changed = false;
    const occupied = new Set();
    for (const block of remaining.values()) occupied.add(key(block.i, block.j, block.k));

    for (const block of [...remaining.values()]) {
      if (block.floating || block.move) continue;
      if (block.j <= 0) continue;
      if (occupied.has(key(block.i, block.j - 1, block.k))) continue;
      remaining.delete(block.id);
      falling.push(block.id);
      changed = true;
    }
  }

  return falling;
}

/**
 * 무너진 잔해의 낙하. 바닥에 닿으면 y = 1 에서 멈추고 마찰로 미끄러짐이 줄어든다.
 */
export function settleDebris(body, dt, options = {}) {
  const gravity = options.gravity ?? GRAVITY_MPS2;
  const restY = options.restY ?? BLOCK_HALF_M;
  const friction = options.friction ?? 0.55;

  const position = body.position;
  const velocity = body.velocity;
  const ay = -gravity;

  let nextY = position.y + velocity.y * dt + 0.5 * ay * dt * dt;
  let nextVy = velocity.y + ay * dt;
  let nextVx = velocity.x;
  let nextVz = velocity.z;
  let nextSpin = body.spin ?? 0;
  let grounded = false;

  if (nextY <= restY) {
    nextY = restY;
    nextVy = 0;
    nextVx = velocity.x * friction;
    nextVz = velocity.z * friction;
    nextSpin = nextSpin * friction;
    if (Math.hypot(nextVx, nextVz) < 0.05) {
      nextVx = 0;
      nextVz = 0;
    }
    if (Math.abs(nextSpin) < 0.1) nextSpin = 0;
    grounded = true;
  }

  return {
    position: { x: position.x + velocity.x * dt, y: nextY, z: position.z + velocity.z * dt },
    velocity: { x: nextVx, y: nextVy, z: nextVz },
    rotation: body.rotation ?? { x: 0, y: 0, z: 0 },
    spin: nextSpin,
    grounded,
  };
}

/** 명중 점수. 직접 맞힌 표적 100점, 무너진 표적 60점, 남은 샷 보너스 50점. */
export function scoreForShot({ hitTargets = 0, toppledTargets = 0, shotsLeft = 0 } = {}) {
  return hitTargets * 100 + toppledTargets * 60 + shotsLeft * 50;
}

/** 사용 샷 수로 별점. par 이하 3점, par+1 이하 2점, 그 외 1점. */
export function starsForShots(shotsUsed, par) {
  if (shotsUsed < 1) return 0;
  if (shotsUsed <= par) return 3;
  if (shotsUsed <= par + 1) return 2;
  return 1;
}
