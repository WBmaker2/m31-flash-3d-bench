// 정육면체 전개도 접기. 순수 함수라 Node 에서 그대로 테스트된다.

export const FACE_IDS = ["down", "up", "north", "south", "east", "west"];

/** 전개도 종류. 좌표는 격자 (col,row). 모두 정육면체가 되는 배치다. */
export const NETS = {
  cross: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 3, row: 0 },
    { col: 1, row: -1 },
    { col: 2, row: 1 },
  ],
  tee: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 3, row: 0 },
    { col: 0, row: -1 },
    { col: 3, row: 1 },
  ],
  longL: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 2, row: 1 },
    { col: 3, row: 1 },
    { col: 4, row: 1 },
  ],
  zigzag: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
    { col: 2, row: 2 },
    { col: 3, row: 2 },
  ],
  belt: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
    { col: 3, row: 1 },
    { col: 3, row: 2 },
  ],
  stair: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 3, row: 0 },
    { col: 3, row: -1 },
    { col: 2, row: 1 },
  ],
};

/** 초기 자세: 각 방향을 보고 있는 면. */
export function createCubeState() {
  return {
    down: "down",
    up: "up",
    north: "north",
    south: "south",
    east: "east",
    west: "west",
  };
}

/** 큐브를 한 칸 굴린다. */
export function roll(state, direction) {
  if (direction === "east") {
    return {
      ...state,
      down: state.east,
      west: state.down,
      up: state.west,
      east: state.up,
    };
  }
  if (direction === "west") {
    return {
      ...state,
      down: state.west,
      east: state.down,
      up: state.east,
      west: state.up,
    };
  }
  if (direction === "north") {
    return {
      ...state,
      down: state.north,
      south: state.down,
      up: state.south,
      north: state.up,
    };
  }
  return {
    ...state,
    down: state.south,
    north: state.down,
    up: state.north,
    south: state.up,
  };
}

/**
 * 전개도를 접었을 때 각 칸이 어떤 면이 되는지.
 * 반환: Map("col,row" → 면 이름)
 */
export function foldNet(cells) {
  if (cells.length === 0) return new Map();
  const byCell = new Map(cells.map((cell) => [`${cell.col},${cell.row}`, cell]));
  const start = cells[0];
  const mapping = new Map();
  const visited = new Map();
  const queue = [{ cell: start, state: createCubeState() }];

  while (queue.length > 0) {
    const { cell, state } = queue.shift();
    const cellKey = `${cell.col},${cell.row}`;
    if (visited.has(cellKey)) continue;
    visited.set(cellKey, state);
    mapping.set(cellKey, state.down);

    for (const [dc, dr, direction] of [
      [1, 0, "east"],
      [-1, 0, "west"],
      [0, -1, "north"],
      [0, 1, "south"],
    ]) {
      const next = byCell.get(`${cell.col + dc},${cell.row + dr}`);
      if (!next) continue;
      queue.push({ cell: next, state: roll(state, direction) });
    }
  }

  return mapping;
}

/** 전개도가 정육면체가 되는가(6면이 겹치지 않고 모두 채워지는가). */
export function isValidNet(cells) {
  const mapping = foldNet(cells);
  if (mapping.size !== cells.length) return false;
  const faces = new Set(mapping.values());
  return faces.size === 6;
}

/** 목표 상자의 면 색에서, 전개도 각 칸의 색을 역으로 구한다. */
export function squareColors({ cells, target }) {
  const mapping = foldNet(cells);
  const colors = new Map();
  for (const cell of cells) {
    const face = mapping.get(`${cell.col},${cell.row}`);
    colors.set(`${cell.col},${cell.row}`, target[face]);
  }
  return colors;
}

/** 전개도를 접었을 때 각 면의 색. 목표와 비교할 수 있다. */
export function foldedColors({ cells, colors }) {
  const mapping = foldNet(cells);
  const result = {};
  for (const [cellKey, face] of mapping) {
    result[face] = colors.get(cellKey);
  }
  return result;
}

/** 접힌 상자가 목표와 같은 색인지. */
export function matchesTarget({ cells, colors, target }) {
  const folded = foldedColors({ cells, colors });
  for (const face of FACE_IDS) {
    if (folded[face] !== target[face]) return false;
  }
  return true;
}
