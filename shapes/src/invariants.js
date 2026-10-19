import { cellKey } from "./rotations.js";
import { GRID_SIZE } from "./levels.js";

export function checkInvariants({ placements = [], target = [] }) {
  const problems = [];
  const targetKeys = new Set(target.map(cellKey));
  const occupied = new Map();

  for (const placement of placements) {
    for (const cell of placement.cells) {
      if (!cell.every((value) => Number.isFinite(value))) {
        problems.push({
          code: "position-not-finite",
          message: "배치된 칸의 좌표가 유한하지 않습니다.",
        });
        continue;
      }
      if (!cell.every((value) => value >= 0 && value < GRID_SIZE)) {
        problems.push({
          code: "cell-out-of-grid",
          message: `칸 (${cell.join(", ")}) 이 3×3×3 격자 밖에 있습니다.`,
        });
      }
      if (!targetKeys.has(cellKey(cell))) {
        problems.push({
          code: "cell-outside-target",
          message: `칸 (${cell.join(", ")}) 이 목표 모양 밖에 있습니다.`,
        });
      }
      const key = cellKey(cell);
      if (occupied.has(key)) {
        problems.push({
          code: "overlap",
          message: `두 블록이 칸 (${cell.join(", ")}) 을 겹쳐 차지하고 있습니다.`,
        });
      } else {
        occupied.set(key, placement);
      }
    }
  }

  if (occupied.size !== targetKeys.size && occupied.size <= targetKeys.size) {
    const missing = target.length - occupied.size;
    if (missing < 0) {
      problems.push({
        code: "too-many-cells",
        message: `채운 칸(${occupied.size})이 목표 칸(${target.length})보다 많습니다.`,
      });
    }
  }

  return problems;
}
