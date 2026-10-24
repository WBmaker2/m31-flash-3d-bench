// 시드 난수 · 주사위 면 · 자세→면 매핑 · 보드 경로 · 이동. 순수 계산이다.

/** mulberry32. 같은 시드면 언제나 같은 수열이 나온다. */
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 주사위 면의 자기 법선. 마주 보는 면의 합은 7이다. */
export const DIE_FACES = {
  1: { x: 0, y: 1, z: 0 },
  6: { x: 0, y: -1, z: 0 },
  2: { x: 1, y: 0, z: 0 },
  5: { x: -1, y: 0, z: 0 },
  3: { x: 0, y: 0, z: 1 },
  4: { x: 0, y: 0, z: -1 },
};

export function rollDie(rng) {
  return 1 + Math.floor(rng() * 6);
}

/** 회전(quaternion)이 위쪽을 향하는 방향. */
export function upFromQuaternion(quaternion) {
  const { x, y, z, w } = quaternion;
  return {
    x: 2 * (x * y - z * w),
    y: 1 - 2 * (x * x + z * z),
    z: 2 * (y * z + x * w),
  };
}

/** 위쪽 방향에서 어느 면이 보이는지. */
export function faceFromUp(up) {
  let face = 1;
  let best = -Infinity;
  for (const [value, normal] of Object.entries(DIE_FACES)) {
    const dot = up.x * normal.x + up.y * normal.y + up.z * normal.z;
    if (dot > best) {
      best = dot;
      face = Number(value);
    }
  }
  return { face, dot: best };
}

/** 지그재그 경로. 모든 칸을 한 번씩 지난다. */
export function serpentinePath(cols, rows) {
  const path = [];
  for (let row = 0; row < rows; row += 1) {
    for (let step = 0; step < cols; step += 1) {
      const col = row % 2 === 0 ? step : cols - 1 - step;
      path.push({ col, row, index: path.length });
    }
  }
  return path;
}

/** 칸의 판 위 좌표. 보드 가운데를 원점으로 둔다. */
export function cellPosition(index, path, cellSize) {
  const cell = path[index];
  if (!cell) return { x: 0, z: 0 };
  const halfCols = (path.length ? Math.max(...path.map((entry) => entry.col)) : 0) / 2;
  const halfRows = (path.length ? Math.max(...path.map((entry) => entry.row)) : 0) / 2;
  return {
    x: (cell.col - halfCols) * cellSize,
    z: (cell.row - halfRows) * cellSize,
  };
}

/**
 * 말을 n칸 움직인다. 뱀·사다리는 한 번만 적용한다.
 * 결승점을 넘어가면 마지막 칸에서 멈춘다.
 */
export function advancePath({ path, jumps, from, steps }) {
  const last = path.length - 1;
  const raw = from + steps;
  const index = Math.min(raw, last);
  const jump = jumps[index];
  const landed = jump === undefined ? index : Math.min(jump, last);
  return {
    index: landed,
    landedIndex: index,
    jumped: jump !== undefined,
    reachedGoal: landed >= last,
  };
}

/** 더하기 문제. 답과 보기 3개를 만든다. */
export function makeQuestion(rng) {
  const a = 1 + Math.floor(rng() * 5);
  const b = 1 + Math.floor(rng() * 3);
  const answer = a + b;
  const choices = [answer];
  let guard = 0;
  while (choices.length < 3 && guard < 40) {
    guard += 1;
    const delta = Math.floor(rng() * 5) - 2;
    const value = answer + delta;
    if (value < 0) continue;
    if (choices.includes(value)) continue;
    choices.push(value);
  }
  for (let i = choices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = choices[i];
    choices[i] = choices[j];
    choices[j] = swap;
  }
  return { a, b, answer, choices };
}
