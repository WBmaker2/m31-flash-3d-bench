// 빛의 반사 · 격자 경로 추적. 순수 함수라 Node 에서 그대로 테스트된다.

export const ORIENTATIONS = ["slash", "backslash"];
export const SQRT_HALF = Math.SQRT1_2;

/** 거울의 법선. slash 는 "/" , backslash 는 "\" 모양이다. */
export const MIRROR_NORMAL = {
  slash: { x: SQRT_HALF, y: 0, z: SQRT_HALF },
  backslash: { x: SQRT_HALF, y: 0, z: -SQRT_HALF },
};

export const DIRECTIONS = {
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  north: { x: 0, y: 0, z: -1 },
  south: { x: 0, y: 0, z: 1 },
};

export function key(col, row) {
  return `${col},${row}`;
}

/** 반사 벡터. 입사각과 반사각이 같다. */
export function reflect(direction, normal) {
  const dot = direction.x * normal.x + direction.y * normal.y + direction.z * normal.z;
  return {
    x: direction.x - 2 * dot * normal.x,
    y: direction.y - 2 * dot * normal.y,
    z: direction.z - 2 * dot * normal.z,
  };
}

/** 방향 이름에서 벡터를 찾는다. */
export function directionVector(name) {
  return DIRECTIONS[name] ?? DIRECTIONS.east;
}

/**
 * 격자 위에서 빛을 쫓는다.
 * mirrors: Map("col,row" → orientation)
 * 반환: { path, end, reflections, reached, escaped }
 */
export function traceBeam({ start, direction, mirrors, size, target = null, maxSteps = 200 }) {
  let col = start.col;
  let row = start.row;
  let vector = directionVector(direction);
  const path = [{ col, row }];
  const visited = new Set([key(col, row)]);
  let reflections = 0;
  let reached = false;
  let escaped = false;

  for (let step = 0; step < maxSteps; step += 1) {
    col += Math.round(vector.x);
    row += Math.round(vector.z);
    if (col < 0 || row < 0 || col >= size || row >= size) {
      escaped = true;
      break;
    }
    path.push({ col, row });
    if (target && col === target.col && row === target.row) {
      reached = true;
      break;
    }
    const cell = key(col, row);
    if (visited.has(cell)) {
      // 같은 칸을 다시 방문하면 무한 순환이다.
      break;
    }
    visited.add(cell);
    const orientation = mirrors.get(cell);
    if (orientation) {
      vector = reflect(vector, MIRROR_NORMAL[orientation]);
      reflections += 1;
    }
  }

  return { path, end: { col, row }, reflections, reached, escaped };
}

/** 거울들의 방향을 모두 바꿔 보며 목표에 닿는 조합을 전부 찾는다. */
export function solveAll({ start, direction, mirrors, size, target }) {
  const entries = [...mirrors.entries()];
  if (entries.length > 20) return [];
  const found = [];
  const total = 2 ** entries.length;
  for (let mask = 0; mask < total; mask += 1) {
    const candidate = new Map();
    entries.forEach(([cell], index) => {
      candidate.set(cell, ORIENTATIONS[(mask >> index) & 1]);
    });
    const result = traceBeam({ start, direction, mirrors: candidate, size, target });
    if (result.reached) found.push(candidate);
  }
  return found;
}

/** 거울들의 방향을 모두 바꿔 보며 목표에 닿는 조합을 찾는다. */
export function solveMirrors({ start, direction, mirrors, size, target }) {
  const found = solveAll({ start, direction, mirrors, size, target });
  return found.length > 0 ? found[0] : null;
}

/** 빛이 몇 번 꺾였는지. */
export function countReflections(path, mirrors) {
  let count = 0;
  for (let i = 1; i < path.length; i += 1) {
    if (mirrors.has(key(path[i].col, path[i].row))) count += 1;
  }
  return count;
}
