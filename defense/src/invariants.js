import { COLS, ROWS, inBounds, isPathCell } from "./grid.js";

export const MIN_PATH_CLEARANCE = 0.5;
export const MIN_ENEMY_GAP_M = 0.3;

export function checkInvariants({ towers, enemies, pathPoints }) {
  const problems = [];

  for (const tower of towers) {
    const position = tower.group.position;
    if (
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      problems.push({ code: "position-not-finite", message: "타워의 위치가 유한하지 않습니다." });
    }
    if (isPathCell(tower.cell.cx, tower.cell.cz)) {
      problems.push({
        code: "tower-on-path",
        message: `타워가 길 위에 있습니다 (${tower.cell.cx}, ${tower.cell.cz}).`,
      });
    }
    if (!inBounds(tower.cell.cx, tower.cell.cz)) {
      problems.push({
        code: "tower-out-of-board",
        message: `타워가 보드 밖에 있습니다 (${tower.cell.cx}, ${tower.cell.cz}).`,
      });
    }
    let clearance = Infinity;
    for (const point of pathPoints) {
      const distance = Math.hypot(point.x - position.x, point.z - position.z);
      clearance = Math.min(clearance, distance);
    }
    if (clearance < MIN_PATH_CLEARANCE) {
      problems.push({
        code: "tower-blocks-path",
        message: `타워가 길에 너무 가깝습니다 (최소 거리 ${clearance.toFixed(2)} < ${MIN_PATH_CLEARANCE}).`,
      });
    }
  }

  for (const enemy of enemies) {
    const position = enemy.group.position;
    if (
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      problems.push({ code: "position-not-finite", message: "적의 위치가 유한하지 않습니다." });
    }
    if (enemy.progress < 0) {
      problems.push({ code: "negative-progress", message: "적의 경로 진행도가 음수입니다." });
    }
  }

  // 두 적이 실제로 같은 자리에 있을 때만 겹침으로 본다.
  // 0.5 m 격자로 묶어 비교하면 살짝 가까운 경우도 겹침으로 잡혔다.
  for (let i = 0; i < enemies.length; i += 1) {
    for (let j = i + 1; j < enemies.length; j += 1) {
      const a = enemies[i].group.position;
      const b = enemies[j].group.position;
      const distance = Math.hypot(a.x - b.x, a.z - b.z);
      if (distance < MIN_ENEMY_GAP_M) {
        problems.push({
          code: "enemies-overlap",
          message: `두 적이 겹쳐 있습니다 (거리 ${distance.toFixed(2)} m).`,
        });
      }
    }
  }

  if (towers.length > COLS * ROWS) {
    problems.push({ code: "too-many-towers", message: "보드 칸 수보다 타워가 많습니다." });
  }

  return problems;
}
