// 런타임 기하 불변식. 항상 참이어야 하는 것만 검사한다.
import { cellOf } from "./maze.js";

export function checkInvariants({
  maze = null,
  cell = 0,
  heldMask = 0,
  rig = null,
  steps = 0,
  par = 0,
} = {}) {
  const problems = [];

  if (maze) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= maze.cells.length) {
      problems.push({ code: "cell-out-of-range", message: "플레이어의 칸이 격자 밖에 있습니다." });
    } else {
      const { col, row } = cellOf(maze, cell);
      if (col < 0 || col >= maze.cols || row < 0 || row >= maze.rows) {
        problems.push({ code: "cell-outside-maze", message: "플레이어가 미로 밖에 있습니다." });
      }
    }
    const keyCount = maze.keys.length;
    if (heldMask < 0 || heldMask >= 1 << keyCount) {
      problems.push({ code: "key-mask-invalid", message: "가지고 있는 열쇠 상태가 올바르지 않습니다." });
    }
  }

  if (rig) {
    const values = [rig.x, rig.z, rig.yaw, rig.pitch];
    if (!values.every((value) => Number.isFinite(value))) {
      problems.push({ code: "rig-not-finite", message: "시점 값이 유한하지 않습니다." });
    }
    if (Math.abs(rig.pitch) > Math.PI * 0.5) {
      problems.push({ code: "pitch-out-of-range", message: "시선이 수직을 넘었습니다." });
    }
  }

  if (steps < 0) {
    problems.push({ code: "steps-negative", message: "걸은 칸 수가 음수입니다." });
  }
  if (!Number.isFinite(par) || par < 0) {
    problems.push({ code: "par-invalid", message: "최적 경로 길이가 올바르지 않습니다." });
  }

  return problems;
}
