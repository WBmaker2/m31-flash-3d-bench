import { BLOCKS } from "./blocks.js";
import { cellKey, distinctRotations, normalizeCells, sameCells } from "./rotations.js";

export { normalizeCells };

export function blockOrientations(blockId) {
  const block = BLOCKS[blockId];
  if (!block) return [];
  return distinctRotations(block.cells).map((entry, index) => {
    const cells = normalizeCells(entry.cells);
    const rotatedOrigin = entry.cells.find((cell) => cellKey(cell) === cellKey([0, 0, 0])) ?? [0, 0, 0];
    const min = [Math.min(...entry.cells.map((cell) => cell[0])), Math.min(...entry.cells.map((cell) => cell[1])), Math.min(...entry.cells.map((cell) => cell[2]))];
    const anchor = [rotatedOrigin[0] - min[0], rotatedOrigin[1] - min[1], rotatedOrigin[2] - min[2]];
    return { index, rotation: entry.rotation, cells, anchor };
  });
}

export function orientationOf(blockId, orientationIndex) {
  const orientations = blockOrientations(blockId);
  if (orientations.length === 0) return null;
  return orientations[orientationIndex % orientations.length];
}

export function placeCells(orientation, origin) {
  return orientation.cells.map((cell) => [cell[0] + origin[0], cell[1] + origin[1], cell[2] + origin[2]]);
}

export function withinGrid(cells, size) {
  return cells.every((cell) => cell.every((value) => value >= 0 && value < size));
}

export function evaluateAssembly(target, placements) {
  const targetKeys = new Set(target.map(cellKey));
  const occupied = new Map();
  const overlaps = [];
  const outside = [];
  let placedCount = 0;

  for (const placement of placements) {
    for (const cell of placement.cells) {
      placedCount += 1;
      const key = cellKey(cell);
      if (!targetKeys.has(key)) outside.push(cell);
      if (occupied.has(key)) overlaps.push(cell);
      else occupied.set(key, placement);
    }
  }

  const remaining = target.filter((cell) => !occupied.has(cellKey(cell)));
  return {
    placedCount,
    occupied,
    overlaps,
    outside,
    remaining,
    complete: remaining.length === 0 && overlaps.length === 0 && outside.length === 0,
  };
}

export function matchesTarget(cells, target) {
  if (cells.length !== target.length) return false;
  const a = cells.map(cellKey).sort();
  const b = target.map(cellKey).sort();
  return a.every((value, index) => value === b[index]);
}

export function orientationsEqual(left, right) {
  return sameCells(left, right);
}

export function scoreFor({ par, used, timeMs }) {
  const base = par * 1000;
  const extra = Math.max(0, used - par) * -220;
  const timeBonus = Math.max(0, 600 - Math.round(timeMs / 100) * 2);
  return Math.max(0, base + extra + timeBonus);
}
