// 기하 불변식. 항상 참이어야 하는 것만 검사한다.
export function checkInvariants({ placement, grid, path, trainProgress }) {
  const problems = [];

  for (const item of placement) {
    if (!item) continue;
    if (!Number.isFinite(item.col) || !Number.isFinite(item.row)) {
      problems.push({ code: "position", message: "선로 위치가 유한하지 않습니다" });
      break;
    }
    if (item.orientation < 0 || item.orientation > 3) {
      problems.push({ code: "orientation", message: "선로 방향이 범위를 벗어났습니다" });
      break;
    }
  }

  if (path && path.length > 0) {
    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1];
      const b = path[i];
      if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) !== 1) {
        problems.push({ code: "path", message: "기차 길이 끊겼습니다" });
        break;
      }
    }
  }

  if (!(trainProgress >= 0 && trainProgress <= 1)) {
    problems.push({ code: "train", message: "기차 위치가 범위를 벗어났습니다" });
  }

  if (grid && grid.size < 0) {
    problems.push({ code: "grid", message: "격자 상태가 잘못됐습니다" });
  }

  return problems;
}
