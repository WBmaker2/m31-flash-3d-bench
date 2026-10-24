// 캐릭터 물리(중력 · 점프 · 스윕 착지). 순수 함수라 Node 에서 그대로 테스트된다.

export const GRAVITY = 18;
export const JUMP_SPEED = 7;
export const MOVE_SPEED = 4.6;
export const MAX_FALL = 22;
export const GROUND_ACCEL = 26;
export const AIR_ACCEL = 10;
export const PLAYER_HALF = 0.21;
export const PLAYER_HEIGHT = 0.52;
export const FIXED_STEP = 1 / 60;

export const JUMP_HEIGHT = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY);
export const JUMP_AIR_TIME = (2 * JUMP_SPEED) / GRAVITY;
export const JUMP_REACH = MOVE_SPEED * JUMP_AIR_TIME;

/** 새 캐릭터 상태. */
export function createPlayer({ x = 0, y = 0, z = 0 } = {}) {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
  };
}

/** 구름: { x, top, halfWidth, halfDepth } */
export function makePlatform(x, top, halfWidth = 0.9, halfDepth = 0.9) {
  return { x, top, halfWidth, halfDepth, z: 0 };
}

/** 캐릭터의 바닥이 구름 윗면을 스텝 안에서 통과했는지 본다(스윕 판정). */
export function sweepDown({ fromY, toY, x, z, platforms, half = PLAYER_HALF }) {
  if (toY > fromY) return null;
  let best = null;
  for (const platform of platforms) {
    if (Math.abs(x - platform.x) > platform.halfWidth + half) continue;
    if (Math.abs(z - (platform.z ?? 0)) > platform.halfDepth + half) continue;
    const top = platform.top;
    if (fromY >= top - 1e-9 && toY <= top) {
      if (!best || top > best.top) best = { top, platform };
    }
  }
  return best;
}

/** 캐릭터가 그 구름 위(또는 아래)에 있는가. */
export function overlapsPlatform({ x, y, z, platform, half = PLAYER_HALF }) {
  if (Math.abs(x - platform.x) > platform.halfWidth + half) return false;
  if (Math.abs(z - (platform.z ?? 0)) > platform.halfDepth + half) return false;
  const bottom = y;
  const top = platform.top;
  const floor = top - 0.7;
  return bottom < top - 1e-9 && bottom > floor;
}

/**
 * 한 스텝 진행. 상태는 새 객체로 돌려준다(참조 공유 없음).
 * input: { move: -1|0|1, jump: boolean }
 */
export function stepPlayer(player, { dt = FIXED_STEP, input = {}, platforms = [] } = {}) {
  const next = { ...player };
  const move = input.move ?? 0;
  const accel = next.onGround ? GROUND_ACCEL : AIR_ACCEL;
  const target = move * MOVE_SPEED;
  next.vx += (target - next.vx) * Math.min(1, accel * dt);
  if (move !== 0) next.facing = move > 0 ? 1 : -1;
  next.x += next.vx * dt;

  next.vy -= GRAVITY * dt;
  if (next.vy < -MAX_FALL) next.vy = -MAX_FALL;

  if (input.jump && next.onGround) {
    next.vy = JUMP_SPEED;
    next.onGround = false;
  }

  const fromY = next.y;
  next.y += next.vy * dt;

  let landed = null;
  if (next.vy <= 0) {
    const hit = sweepDown({
      fromY,
      toY: next.y,
      x: next.x,
      z: next.z,
      platforms,
    });
    if (hit) {
      next.y = hit.top;
      next.vy = 0;
      landed = hit.platform;
    }
  }

  next.onGround = landed !== null;
  return { player: next, landed };
}

/** N 스텝 동안 시뮬레이션한다. */
export function simulate(player, { steps, dt = FIXED_STEP, input = {}, platforms = [] }) {
  let current = player;
  let landed = null;
  for (let i = 0; i < steps; i += 1) {
    const result = stepPlayer(current, { dt, input, platforms });
    current = result.player;
    if (result.landed) landed = result.landed;
  }
  return { player: current, landed };
}

/** 동전과 만났는가. */
export function collectCoin(player, coin) {
  const dx = player.x - coin.x;
  const dy = player.y + PLAYER_HEIGHT / 2 - coin.y;
  const dz = player.z - (coin.z ?? 0);
  return dx * dx + dy * dy + dz * dz <= 0.36 * 0.36;
}

/** 두 구름 사이를 한 번의 점프로 넘을 수 있는가. */
export function canReach(from, to) {
  const gap = Math.abs(to.x - from.x);
  const rise = to.top - from.top;
  if (rise > JUMP_HEIGHT) return false;
  if (gap > JUMP_REACH) return false;
  return true;
}
