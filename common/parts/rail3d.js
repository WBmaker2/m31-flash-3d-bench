// 선로 조각과 경로 탐색. 순수 함수라 Node 에서 그대로 테스트된다.

export const PIECE_KINDS = ["straight", "curve"];
export const NORTH = "north";
export const EAST = "east";
export const SOUTH = "south";
export const WEST = "west";

const OPPOSITE = { north: SOUTH, south: NORTH, east: WEST, west: EAST };
export const DIRECTIONS = [NORTH, EAST, SOUTH, WEST];

/** 조각이 연결되는 두 방향. */
export function piecePorts(kind, orientation) {
  const index = ((orientation % 4) + 4) % 4;
  if (kind === "straight") {
    return index % 2 === 0 ? [NORTH, SOUTH] : [EAST, WEST];
  }
  const curve = [
    [NORTH, EAST],
    [EAST, SOUTH],
    [SOUTH, WEST],
    [WEST, NORTH],
  ];
  return curve[index];
}

/** 두 조각이 맞닿은 칸에서 연결되는가. */
export function connects(a, b) {
  if (!a || !b) return false;
  const portsA = piecePorts(a.kind, a.orientation);
  const portsB = piecePorts(b.kind, b.orientation);
  return portsA.some((port) => portsB.includes(OPPOSITE[port]));
}

export function cellKey(col, row) {
  return `${col},${row}`;
}

/**
 * 시작에서 도착까지 선로가 이어지는지 확인하고 경로를 돌려준다.
 * grid: Map("col,row" → { kind, orientation })
 */
export function findPath({ grid, size, start, goal }) {
  const queue = [{ col: start.col, row: start.row, from: null }];
  const visited = new Map();
  visited.set(cellKey(start.col, start.row), null);

  while (queue.length > 0) {
    const node = queue.shift();
    if (node.col === goal.col && node.row === goal.row) {
      const path = [];
      let key = cellKey(node.col, node.row);
      while (key) {
        const [col, row] = key.split(",").map(Number);
        path.unshift({ col, row });
        key = visited.get(key);
      }
      return path;
    }
    const piece = grid.get(cellKey(node.col, node.row));
    if (!piece) continue;
    const ports = piecePorts(piece.kind, piece.orientation);
    for (const port of ports) {
      // 들어온 방향이 있으면 그쪽으로 되돌아갈 수 없다.
      if (node.from && port === node.from) continue;
      const next = step(node.col, node.row, port);
      if (next.col < 0 || next.row < 0 || next.col >= size || next.row >= size) continue;
      const key = cellKey(next.col, next.row);
      if (visited.has(key)) continue;
      const isGoal = next.col === goal.col && next.row === goal.row;
      if (!isGoal && !grid.has(key)) continue;
      visited.set(key, cellKey(node.col, node.row));
      queue.push({ col: next.col, row: next.row, from: OPPOSITE[port] });
    }
  }
  return null;
}

export function step(col, row, direction) {
  if (direction === NORTH) return { col, row: row - 1 };
  if (direction === SOUTH) return { col, row: row + 1 };
  if (direction === EAST) return { col: col + 1, row };
  return { col: col - 1, row };
}

/** 조각을 무시한 최단 경로. */
export function shortestRoute({ size, start, goal }) {
  const queue = [{ col: start.col, row: start.row }];
  const visited = new Map();
  visited.set(cellKey(start.col, start.row), null);

  while (queue.length > 0) {
    const node = queue.shift();
    if (node.col === goal.col && node.row === goal.row) {
      const path = [];
      let key = cellKey(node.col, node.row);
      while (key) {
        const [col, row] = key.split(",").map(Number);
        path.unshift({ col, row });
        key = visited.get(key);
      }
      return path;
    }
    for (const direction of DIRECTIONS) {
      const next = step(node.col, node.row, direction);
      if (next.col < 0 || next.row < 0 || next.col >= size || next.row >= size) continue;
      const key = cellKey(next.col, next.row);
      if (visited.has(key)) continue;
      visited.set(key, cellKey(node.col, node.row));
      queue.push(next);
    }
  }
  return null;
}

/** 최단 경로에 새로 놓아야 하는 칸 수. */
export function requiredPieces(level) {
  const fixed = new Set((level.fixed ?? []).map((piece) => cellKey(piece.col, piece.row)));
  const path = shortestRoute({ size: level.size, start: level.start, goal: level.goal });
  if (!path) return Infinity;
  let count = 0;
  for (const cell of path) {
    // 도착역은 선로 조각이 필요 없다.
    if (cell.col === level.goal.col && cell.row === level.goal.row) continue;
    if (!fixed.has(cellKey(cell.col, cell.row))) count += 1;
  }
  return count;
}
