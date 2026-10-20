// 격자 좌표 ↔ 월드 좌표 변환. 도메인 경계에서 한 번만 한다.
// 칸 (i, j, k) 는 2 m 격자이고, 세로(j)만 지면 위에 오도록 y 를 1 m 올려 둔다.

export const CELL_SIZE_M = 2;
export const BLOCK_SIZE_M = 2;
export const BLOCK_HALF_M = BLOCK_SIZE_M / 2;

export function cellKey(cell) {
  return `${cell.i},${cell.j},${cell.k}`;
}

export function cellCenter(cell) {
  return {
    x: cell.i * CELL_SIZE_M,
    y: cell.j * CELL_SIZE_M + BLOCK_HALF_M,
    z: cell.k * CELL_SIZE_M,
  };
}

/** 블록의 월드 AABB. 이동 블록은 offset 만큼 옮겨진다. */
export function cellBounds(cell, offset = null) {
  const center = cellCenter(cell);
  const dx = offset?.x ?? 0;
  const dy = offset?.y ?? 0;
  const dz = offset?.z ?? 0;
  return {
    min: {
      x: center.x - BLOCK_HALF_M + dx,
      y: center.y - BLOCK_HALF_M + dy,
      z: center.z - BLOCK_HALF_M + dz,
    },
    max: {
      x: center.x + BLOCK_HALF_M + dx,
      y: center.y + BLOCK_HALF_M + dy,
      z: center.z + BLOCK_HALF_M + dz,
    },
  };
}

/** 이동 블록의 현재 오프셋. 시간이 주어지면 그 시각의 위치다. */
export function moveOffset(block, timeSeconds) {
  if (!block.move) return { x: 0, y: 0, z: 0 };
  const phase = (timeSeconds / block.move.period) * Math.PI * 2;
  const value = Math.sin(phase) * block.move.amplitude;
  if (block.move.axis === "x") return { x: value, y: 0, z: 0 };
  if (block.move.axis === "z") return { x: 0, y: 0, z: value };
  return { x: 0, y: value, z: 0 };
}

/**
 * 블록 목록 → 충돌용 AABB 목록. 이동 블록은 시각을 받아 그때의 위치로 계산한다.
 * @returns {Array<{id:string, kind:string, min:object, max:object}>}
 */
export function blocksBounds(blocks = [], timeSeconds = 0) {
  return blocks.map((block) => {
    const bounds = cellBounds(block, moveOffset(block, timeSeconds));
    return { id: block.id, kind: block.kind, min: bounds.min, max: bounds.max };
  });
}
