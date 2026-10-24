// 복셀 표면의 순수 계산. three 에 묶지 않아 Node 에서 그대로 테스트된다.
// 표면 셀 그래프와 flood fill 은 도형 조립·색칠 게임 어디에나 재사용할 수 있다.

export const VOXEL_SIZE = 0.08;

export const NEIGHBORS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export function voxelKey(x, y, z) {
  return `${x}|${y}|${z}`;
}

export function parseVoxelKey(key) {
  const [x, y, z] = key.split("|").map(Number);
  return { x, y, z };
}

/** 상자 목록을 복셀 집합으로 편다. 겹치는 복셀이 있으면 함께 알려 준다. */
export function expandBoxes(boxes) {
  const voxels = new Map();
  const overlaps = [];
  for (const item of boxes) {
    for (let x = item.box.x0; x < item.box.x1; x += 1) {
      for (let y = item.box.y0; y < item.box.y1; y += 1) {
        for (let z = item.box.z0; z < item.box.z1; z += 1) {
          const key = voxelKey(x, y, z);
          const existing = voxels.get(key);
          if (existing) {
            overlaps.push({ key, partId: item.partId, other: existing.partId });
            continue;
          }
          voxels.set(key, { x, y, z, partId: item.partId });
        }
      }
    }
  }
  return { voxels, overlaps };
}

/** 노출된 면이 있는 복셀. 안쪽 복셀은 그리지 않는다. */
export function surfaceVoxels(voxels) {
  const surface = new Map();
  for (const [key, voxel] of voxels) {
    let exposed = false;
    for (const [dx, dy, dz] of NEIGHBORS) {
      if (!voxels.has(voxelKey(voxel.x + dx, voxel.y + dy, voxel.z + dz))) {
        exposed = true;
        break;
      }
    }
    if (exposed) surface.set(key, voxel);
  }
  return surface;
}

/** 같은 조각 안에서 6방향으로 이어진 복셀만 잇는다. 조각 경계는 넘지 않는다. */
export function buildAdjacency(voxels) {
  const adjacency = new Map();
  for (const [key, voxel] of voxels) {
    const list = [];
    for (const [dx, dy, dz] of NEIGHBORS) {
      const next = voxelKey(voxel.x + dx, voxel.y + dy, voxel.z + dz);
      const neighbor = voxels.get(next);
      if (!neighbor) continue;
      if (neighbor.partId !== voxel.partId) continue;
      list.push(next);
    }
    adjacency.set(key, list);
  }
  return adjacency;
}

/** 같은 색으로 이어진 영역만 칠한다. */
export function floodFill({ startKey, colors, adjacency }) {
  const startColor = colors.get(startKey);
  if (startColor === undefined) return [];
  const visited = new Set([startKey]);
  const stack = [startKey];
  while (stack.length > 0) {
    const key = stack.pop();
    for (const next of adjacency.get(key) ?? []) {
      if (visited.has(next)) continue;
      if (colors.get(next) !== startColor) continue;
      visited.add(next);
      stack.push(next);
    }
  }
  return [...visited];
}

/** 칠할 수 있는 조각이 몇 덩어리인지. 떨어진 같은 색은 따로 세다. */
export function countComponents(voxels, adjacency, partId) {
  const keys = [...voxels.keys()].filter((key) => voxels.get(key).partId === partId);
  const visited = new Set();
  let count = 0;
  for (const key of keys) {
    if (visited.has(key)) continue;
    count += 1;
    const stack = [key];
    visited.add(key);
    while (stack.length > 0) {
      const current = stack.pop();
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }
  }
  return count;
}

/** 표면 복셀 중 목표 색과 같은 비율. */
export function matchRate({ current, target, surface }) {
  let total = 0;
  let hit = 0;
  for (const key of surface.keys()) {
    total += 1;
    if (current.get(key) === target.get(key)) hit += 1;
  }
  if (total === 0) return 0;
  return hit / total;
}

/** 색을 바꾼다. 같은 색이면 그대로. */
export function applyColor(colors, keys, color) {
  const next = new Map(colors);
  let changed = 0;
  for (const key of keys) {
    if (next.get(key) === color) continue;
    next.set(key, color);
    changed += 1;
  }
  return { colors: next, changed };
}
