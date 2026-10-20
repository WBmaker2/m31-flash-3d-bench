// 다체 에머전트 행동 규칙. 순수 계산, three에 의존하지 않는다.
// 새 한 마리 = { position: {x,y,z}, velocity: {x,y,z} }

export const FLOCK = {
  maxSpeed: 9,
  minSpeed: 4,
  maxForce: 12,
  separationRadius: 1.2,
  separationWeight: 1.6,
  alignmentRadius: 3,
  alignmentWeight: 0.8,
  cohesionRadius: 4.5,
  cohesionWeight: 0.7,
  targetWeight: 1,
  wallWeight: 2,
  wallMargin: 3,
  gateRadius: 3.2,
  arena: { halfX: 22, halfY: 9, halfZ: 20 },
};

export function vec(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(vector, factor) {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}

export function length(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function normalize(vector) {
  const size = length(vector);
  if (size < 1e-9) return { x: 0, y: 0, z: 0 };
  return { x: vector.x / size, y: vector.y / size, z: vector.z / size };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** 반경 안의 이웃 인덱스. 자기 자신은 제외한다. */
export function neighborsWithin(birds, index, radius) {
  const bird = birds[index];
  const radiusSq = radius * radius;
  const list = [];
  for (let j = 0; j < birds.length; j += 1) {
    if (j === index) continue;
    const other = birds[j];
    const dx = other.position.x - bird.position.x;
    const dy = other.position.y - bird.position.y;
    const dz = other.position.z - bird.position.z;
    if (dx * dx + dy * dy + dz * dz <= radiusSq) list.push(j);
  }
  return list;
}

/** 분리: 너무 가까운 이웃을 밀어낸다. */
export function separationSteer(birds, index, params = FLOCK) {
  const bird = birds[index];
  const radiusSq = params.separationRadius * params.separationRadius;
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;
  for (let j = 0; j < birds.length; j += 1) {
    if (j === index) continue;
    const other = birds[j];
    const dx = bird.position.x - other.position.x;
    const dy = bird.position.y - other.position.y;
    const dz = bird.position.z - other.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq >= radiusSq || distSq < 1e-12) continue;
    const dist = Math.sqrt(distSq);
    const weight = 1 / dist;
    x += dx * weight;
    y += dy * weight;
    z += dz * weight;
    count += 1;
  }
  if (count === 0) return { x: 0, y: 0, z: 0 };
  return normalize({ x, y, z });
}

/** 정렬: 이웃과 같은 방향으로 기운다. */
export function alignmentSteer(birds, index, params = FLOCK) {
  const bird = birds[index];
  const radiusSq = params.alignmentRadius * params.alignmentRadius;
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;
  for (let j = 0; j < birds.length; j += 1) {
    if (j === index) continue;
    const other = birds[j];
    const dx = other.position.x - bird.position.x;
    const dy = other.position.y - bird.position.y;
    const dz = other.position.z - bird.position.z;
    if (dx * dx + dy * dy + dz * dz > radiusSq) continue;
    x += other.velocity.x;
    y += other.velocity.y;
    z += other.velocity.z;
    count += 1;
  }
  if (count === 0) return { x: 0, y: 0, z: 0 };
  const average = { x: x / count, y: y / count, z: z / count };
  return normalize(sub(average, bird.velocity));
}

/** 응집: 무리의 중심을 향한다. */
export function cohesionSteer(birds, index, params = FLOCK) {
  const bird = birds[index];
  const radiusSq = params.cohesionRadius * params.cohesionRadius;
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;
  for (let j = 0; j < birds.length; j += 1) {
    if (j === index) continue;
    const other = birds[j];
    const dx = other.position.x - bird.position.x;
    const dy = other.position.y - bird.position.y;
    const dz = other.position.z - bird.position.z;
    if (dx * dx + dy * dy + dz * dz > radiusSq) continue;
    x += other.position.x;
    y += other.position.y;
    z += other.position.z;
    count += 1;
  }
  if (count === 0) return { x: 0, y: 0, z: 0 };
  const average = { x: x / count, y: y / count, z: z / count };
  return normalize(sub(average, bird.position));
}

/** 목표(불빛)를 향한다. */
export function targetSteer(position, target) {
  if (!target) return { x: 0, y: 0, z: 0 };
  return normalize(sub(target, position));
}

/** 경기장 경계에서 안쪽으로 민다. */
export function boundarySteer(position, params = FLOCK) {
  const { halfX, halfY, halfZ } = params.arena;
  const margin = params.wallMargin;
  let x = 0;
  let y = 0;
  let z = 0;
  if (position.x > halfX - margin) x -= position.x - (halfX - margin);
  if (position.x < -(halfX - margin)) x -= position.x + (halfX - margin);
  if (position.y > halfY - margin) y -= position.y - (halfY - margin);
  if (position.y < -(halfY - margin)) y -= position.y + (halfY - margin);
  if (position.z > halfZ - margin) z -= position.z - (halfZ - margin);
  if (position.z < -(halfZ - margin)) z -= position.z + (halfZ - margin);
  return normalize({ x, y, z });
}

/**
 * 무리 전체를 한 스텝 갱신한다. 입력은 바뀌지 않는다(새 배열을 돌려준다).
 * @param {Array} birds
 * @param {number} dt 초
 * @param {object|null} target 공짜 목표(불빛)
 */
export function stepFlock(birds, params = FLOCK, dt = 1 / 60, target = null) {
  const next = [];
  for (let i = 0; i < birds.length; i += 1) {
    const bird = birds[i];
    let steer = { x: 0, y: 0, z: 0 };
    steer = add(steer, scale(separationSteer(birds, i, params), params.separationWeight));
    steer = add(steer, scale(alignmentSteer(birds, i, params), params.alignmentWeight));
    steer = add(steer, scale(cohesionSteer(birds, i, params), params.cohesionWeight));
    if (target) steer = add(steer, scale(targetSteer(bird.position, target), params.targetWeight));
    steer = add(steer, scale(boundarySteer(bird.position, params), params.wallWeight));

    const steerLength = length(steer);
    if (steerLength > params.maxForce) steer = scale(steer, params.maxForce / steerLength);

    let vx = bird.velocity.x + steer.x * dt;
    let vy = bird.velocity.y + steer.y * dt;
    let vz = bird.velocity.z + steer.z * dt;

    const speed = Math.hypot(vx, vy, vz);
    if (speed > params.maxSpeed) {
      const factor = params.maxSpeed / speed;
      vx *= factor;
      vy *= factor;
      vz *= factor;
    } else if (speed > 1e-6 && speed < params.minSpeed) {
      const factor = params.minSpeed / speed;
      vx *= factor;
      vy *= factor;
      vz *= factor;
    }

    let px = bird.position.x + vx * dt;
    let py = bird.position.y + vy * dt;
    let pz = bird.position.z + vz * dt;

    // 경계 힘만으로는 관성으로 살짝 넘을 수 있다. 경기장 안으로 눌러 둔다.
    const limitX = params.arena.halfX - 0.5;
    const limitY = params.arena.halfY - 0.5;
    const limitZ = params.arena.halfZ - 0.5;
    if (px > limitX) { px = limitX; vx = Math.min(vx, 0); }
    if (px < -limitX) { px = -limitX; vx = Math.max(vx, 0); }
    if (py > limitY) { py = limitY; vy = Math.min(vy, 0); }
    if (py < -limitY) { py = -limitY; vy = Math.max(vy, 0); }
    if (pz > limitZ) { pz = limitZ; vz = Math.min(vz, 0); }
    if (pz < -limitZ) { pz = -limitZ; vz = Math.max(vz, 0); }

    next.push({
      position: { x: px, y: py, z: pz },
      velocity: { x: vx, y: vy, z: vz },
    });
  }
  return next;
}

/** 무리의 중심 · 평균 속도 · 흩어짐(중심에서 평균 거리). */
export function flockMetrics(birds) {
  const count = birds.length;
  if (count === 0) return { centroid: { x: 0, y: 0, z: 0 }, meanSpeed: 0, spread: 0, count: 0 };

  let cx = 0;
  let cy = 0;
  let cz = 0;
  let speed = 0;
  for (const bird of birds) {
    cx += bird.position.x;
    cy += bird.position.y;
    cz += bird.position.z;
    speed += length(bird.velocity);
  }
  cx /= count;
  cy /= count;
  cz /= count;

  let spread = 0;
  for (const bird of birds) {
    spread += Math.hypot(bird.position.x - cx, bird.position.y - cy, bird.position.z - cz);
  }
  spread /= count;

  return {
    centroid: { x: cx, y: cy, z: cz },
    meanSpeed: speed / count,
    spread,
    count,
  };
}

/**
 * 선분이 링 게이트를 통과했는지 판정한다.
 * @param {{x,y,z}} prev 직전 위치
 * @param {{x,y,z}} curr 현재 위치
 * @param {{center:object, normal:object, radius:number}} gate
 */
export function throughGate(prev, curr, gate) {
  const d0 = dot(sub(prev, gate.center), gate.normal);
  const d1 = dot(sub(curr, gate.center), gate.normal);
  if (d0 * d1 > 0) return false;
  // 링이 지정한 방향(법선 쪽)으로만 통과로 센다. 뒤로 넘어가는 것은 통과가 아니다.
  if (d0 > 0 || d1 < 0) return false;
  const denominator = d0 - d1;
  if (Math.abs(denominator) < 1e-9) return false;
  const t = d0 / denominator;
  const point = {
    x: prev.x + (curr.x - prev.x) * t,
    y: prev.y + (curr.y - prev.y) * t,
    z: prev.z + (curr.z - prev.z) * t,
  };
  return length(sub(point, gate.center)) <= gate.radius;
}

/** 시드가 같으면 같은 배치를 내는 난수. */
export function createRandom(seed) {
  let a = (seed >>> 0) || 1;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 무리를 흩뿌린다. 영역을 주면 그 안에서만 흩어진다. */
export function scatterFlock(count, seed, params = FLOCK, region = null) {
  const random = createRandom(seed);
  const { halfX, halfY, halfZ } = params.arena;
  const minX = region?.minX ?? -(halfX - 2);
  const maxX = region?.maxX ?? halfX - 2;
  const minY = region?.minY ?? -(halfY - 2);
  const maxY = region?.maxY ?? halfY - 2;
  const minZ = region?.minZ ?? -(halfZ - 2);
  const maxZ = region?.maxZ ?? halfZ - 2;
  const birds = [];
  for (let i = 0; i < count; i += 1) {
    birds.push({
      position: {
        x: minX + random() * (maxX - minX),
        y: minY + random() * (maxY - minY),
        z: minZ + random() * (maxZ - minZ),
      },
      velocity: {
        x: (random() * 2 - 1) * 4,
        y: (random() * 2 - 1) * 1,
        z: (random() * 2 - 1) * 4,
      },
    });
  }
  return birds;
}
