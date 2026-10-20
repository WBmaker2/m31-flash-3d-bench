// 미로 생성 · 최단 경로 · 이동 해석. 순수 계산, three에 의존하지 않는다.
// 좌표: 칸 (col, row). 방향 0=북 1=동 2=남 3=서.

/** 미로의 공간 모델. 거리 단위는 m. */
export const CELL_SIZE_M = 2.4;
export const WALL_HEIGHT_M = 2.8;
export const WALL_THICKNESS_M = 0.16;
export const EYE_HEIGHT_M = 1.6;
export const MOVE_SPEED_MPS = 4.2;

export const DIRECTIONS = [
  { name: "n", dx: 0, dy: -1, opposite: "s" },
  { name: "e", dx: 1, dy: 0, opposite: "w" },
  { name: "s", dx: 0, dy: 1, opposite: "n" },
  { name: "w", dx: -1, dy: 0, opposite: "e" },
];

const ALL_KEYS = 0b1111;

/** 시드가 같으면 항상 같은 수열을 내는 난수 생성기. */
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

export function cellIndex(maze, col, row) {
  return row * maze.cols + col;
}

export function cellOf(maze, index) {
  return { col: index % maze.cols, row: Math.floor(index / maze.cols) };
}

export function isOpen(maze, index, dir) {
  const cell = maze.cells[index];
  return Boolean(cell && cell[DIRECTIONS[dir].name]);
}

/** 방향으로 한 칸 이동한 칸 번호. 격자 밖이면 -1. */
export function neighborOf(maze, index, dir) {
  const { col, row } = cellOf(maze, index);
  const step = DIRECTIONS[dir];
  const nextCol = col + step.dx;
  const nextRow = row + step.dy;
  if (nextCol < 0 || nextCol >= maze.cols || nextRow < 0 || nextRow >= maze.rows) return -1;
  return nextRow * maze.cols + nextCol;
}

/** 칸의 월드 좌표(미로 중심이 원점). */
export function cellToWorld(maze, index) {
  const { col, row } = cellOf(maze, index);
  return {
    x: (col - (maze.cols - 1) / 2) * CELL_SIZE_M,
    z: (row - (maze.rows - 1) / 2) * CELL_SIZE_M,
  };
}

/** 칸에서 특정 방향으로 나가는 통로의 문 정보(없으면 undefined). */
export function gateAt(maze, cell, dir) {
  return maze.gateMap.get(`${cell}:${dir}`);
}

/**
 * 시드 고정 DFS로 완전 미로를 만든다.
 * 완전 미로 = 모든 칸이 연결되고 통로 수가 칸수-1인 미로.
 * @param {number} keyCount 열쇠(문) 개수
 */
export function generateMaze(cols, rows, seed, options = {}) {
  const keyCount = Math.max(0, options.keys ?? 1);
  const random = createRandom(seed);
  const total = cols * rows;
  const cells = [];
  for (let i = 0; i < total; i += 1) cells.push({ n: false, e: false, s: false, w: false });
  const visited = new Uint8Array(total);

  const start = 0;
  const stack = [start];
  visited[start] = 1;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const { col, row } = cellOf({ cols, rows }, current);
    const candidates = [];
    for (let dir = 0; dir < 4; dir += 1) {
      const step = DIRECTIONS[dir];
      const nextCol = col + step.dx;
      const nextRow = row + step.dy;
      if (nextCol < 0 || nextCol >= cols || nextRow < 0 || nextRow >= rows) continue;
      const next = nextRow * cols + nextCol;
      if (visited[next]) continue;
      candidates.push({ dir, next });
    }
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const pick = candidates[Math.floor(random() * candidates.length)];
    const step = DIRECTIONS[pick.dir];
    cells[current][step.name] = true;
    cells[pick.next][step.opposite] = true;
    visited[pick.next] = 1;
    stack.push(pick.next);
  }

  const maze = { cols, rows, cells, seed, start, exit: 0, keys: [], gates: [], gateMap: new Map() };

  // 출구는 시작점에서 가장 먼 칸.
  const distances = bfsDistances(maze, start);
  let exit = start;
  for (let i = 0; i < total; i += 1) {
    if (distances[i] > distances[exit]) exit = i;
  }
  maze.exit = exit;

  // 시작점 → 출구 경로.
  const path = pathTo(maze, start, exit);
  const gateCount = Math.min(keyCount, Math.max(0, path.length - 1));

  // 문은 경로의 마지막 구간에 놓는다. 그래야 열쇠를 문 앞에 모으게 된다.
  const gates = [];
  for (let i = 0; i < gateCount; i += 1) {
    const step = path.length - 1 - i;
    const from = path[step];
    const to = path[step + 1];
    const dir = directionBetween(maze, from, to);
    gates.push({ id: `gate-${i}`, cell: from, dir, keyIndex: i, keyCell: -1 });
  }
  for (const gate of gates) maze.gateMap.set(`${gate.cell}:${gate.dir}`, gate);

  // 열쇠는 문을 통과하지 않고도 닿는 곳에 둔다.
  const blocked = new Set();
  for (const gate of gates) blocked.add(`${gate.cell}:${gate.dir}`);
  const openDistances = bfsDistances(maze, start, blocked);
  const reachable = [];
  for (let i = 0; i < total; i += 1) {
    if (openDistances[i] < 0) continue;
    if (i === start || i === exit) continue;
    reachable.push(i);
  }
  reachable.sort((a, b) => openDistances[a] - openDistances[b]);

  const keys = [];
  for (let i = 0; i < gateCount; i += 1) {
    const picked = pickSpread(reachable, i, gateCount);
    if (picked < 0) continue;
    const cell = reachable[picked];
    keys.push({ id: `key-${i}`, cell, index: i });
    gates[i].keyCell = cell;
  }
  maze.keys = keys;
  maze.gates = gates;
  return maze;
}

/** 목록을 고르게 나눠 고른다(깊이가 다른 열쇠를 두기 위함). */
function pickSpread(list, index, count) {
  if (list.length === 0) return -1;
  if (count <= 1) return Math.floor(list.length / 2);
  const position = Math.round((index * (list.length - 1)) / (count - 1));
  return Math.min(list.length - 1, Math.max(0, position));
}

export function directionBetween(maze, from, to) {
  const a = cellOf(maze, from);
  const b = cellOf(maze, to);
  for (let dir = 0; dir < 4; dir += 1) {
    const step = DIRECTIONS[dir];
    if (a.col + step.dx === b.col && a.row + step.dy === b.row) return dir;
  }
  return -1;
}

/** 특정 통로를 막고 시작점에서 갈 수 있는 칸까지의 거리(-1 = 못 감). */
export function bfsDistances(maze, start, blocked = new Set()) {
  const total = maze.cols * maze.rows;
  const distances = new Array(total).fill(-1);
  distances[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (let dir = 0; dir < 4; dir += 1) {
      if (!isOpen(maze, current, dir)) continue;
      if (blocked.has(`${current}:${dir}`)) continue;
      const next = neighborOf(maze, current, dir);
      if (next < 0 || distances[next] >= 0) continue;
      distances[next] = distances[current] + 1;
      queue.push(next);
    }
  }
  return distances;
}

/** 두 칸 사이의 유일한 경로(칸 번호 배열). */
export function pathTo(maze, start, goal) {
  const total = maze.cols * maze.rows;
  const previous = new Array(total).fill(-1);
  const seen = new Uint8Array(total);
  const queue = [start];
  seen[start] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (current === goal) break;
    for (let dir = 0; dir < 4; dir += 1) {
      if (!isOpen(maze, current, dir)) continue;
      const next = neighborOf(maze, current, dir);
      if (next < 0 || seen[next]) continue;
      seen[next] = 1;
      previous[next] = current;
      queue.push(next);
    }
  }
  if (!seen[goal]) return [];
  const path = [goal];
  let current = goal;
  while (current !== start) {
    current = previous[current];
    if (current < 0) return [];
    path.push(current);
  }
  return path.reverse();
}

/** 문을 무시하고 시작점에서 도달 가능한 칸 수. 완전 미로면 칸 수와 같다. */
export function reachableCount(maze) {
  const distances = bfsDistances(maze, maze.start);
  return distances.filter((value) => value >= 0).length;
}

/** 통로 수. 완전 미로면 칸 수-1 이다. */
export function passageCount(maze) {
  let count = 0;
  for (let index = 0; index < maze.cells.length; index += 1) {
    for (let dir = 0; dir < 2; dir += 1) {
      if (maze.cells[index][DIRECTIONS[dir].name]) count += 1;
    }
  }
  return count;
}

/**
 * (위치 × 획득 열쇠) 상태 공간에서 최단 경로를 찾는다.
 * 문은 해당 열쇠를 있어야 통과할 수 있다.
 * @returns {{steps:number, path:number[], reachable:boolean}}
 */
export function shortestRoute(maze) {
  const keyCount = maze.keys.length;
  const maskCount = 1 << keyCount;
  const keyMaskByCell = new Map();
  maze.keys.forEach((key, index) => {
    keyMaskByCell.set(key.cell, (keyMaskByCell.get(key.cell) ?? 0) | (1 << index));
  });

  const startState = maze.start * maskCount;
  const distances = new Map([[startState, 0]]);
  const parents = new Map();
  const queue = [startState];
  let goalState = -1;

  for (let head = 0; head < queue.length; head += 1) {
    const state = queue[head];
    const cell = Math.floor(state / maskCount);
    const mask = state % maskCount;
    if (cell === maze.exit) {
      goalState = state;
      break;
    }
    for (let dir = 0; dir < 4; dir += 1) {
      if (!isOpen(maze, cell, dir)) continue;
      const gate = gateAt(maze, cell, dir);
      if (gate && (mask & (1 << gate.keyIndex)) === 0) continue;
      const next = neighborOf(maze, cell, dir);
      if (next < 0) continue;
      const nextMask = mask | (keyMaskByCell.get(next) ?? 0);
      const nextState = next * maskCount + nextMask;
      if (distances.has(nextState)) continue;
      distances.set(nextState, distances.get(state) + 1);
      parents.set(nextState, state);
      queue.push(nextState);
    }
  }

  if (goalState < 0) return { steps: Infinity, path: [], reachable: false };

  const path = [];
  let state = goalState;
  while (state !== undefined) {
    path.push(Math.floor(state / maskCount));
    if (state === startState) break;
    state = parents.get(state);
  }
  path.reverse();
  return { steps: distances.get(goalState), path, reachable: true };
}

/** 최단 경로가 지나가는 칸에 있는 열쇠 집합(자동 획득 가정). */
export function keysOnPath(maze, path) {
  const mask = new Set();
  for (const cell of path) {
    maze.keys.forEach((key, index) => {
      if (key.cell === cell) mask.add(index);
    });
  }
  return mask;
}

/**
 * 한 칸 이동 해석. 막힌 방향을 누르면 진행 방향으로 미끄러진다.
 * @param {number} heldMask 가지고 있는 열쇠 비트마스크
 */
export function resolveMove(cell, facing, desired, maze, heldMask = 0) {
  const canGo = (dir) => {
    if (!isOpen(maze, cell, dir)) return false;
    const gate = gateAt(maze, cell, dir);
    if (gate && (heldMask & (1 << gate.keyIndex)) === 0) return false;
    return true;
  };

  if (canGo(desired)) {
    const next = neighborOf(maze, cell, desired);
    if (next >= 0) return { cell: next, facing: desired, moved: true, slid: false };
  }
  if (canGo(facing)) {
    const next = neighborOf(maze, cell, facing);
    if (next >= 0) return { cell: next, facing, moved: true, slid: true };
  }
  return { cell, facing, moved: false, slid: false };
}

/** 열쇠 비트마스크를 사람이 읽는 목록으로. */
export function maskToKeys(mask, maze) {
  const list = [];
  maze.keys.forEach((key, index) => {
    if (mask & (1 << index)) list.push(key.id);
  });
  return list;
}

export { ALL_KEYS };
