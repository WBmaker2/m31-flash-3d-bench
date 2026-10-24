// 기하 불변식. 항상 참이어야 하는 것만 검사한다.
export function checkInvariants({ options, cells, target, picked }) {
  const problems = [];

  if (options.length !== 4) {
    problems.push({ code: "options", message: `보기가 ${options.length} 개입니다` });
  }

  for (const colors of options) {
    if (colors.size !== cells.length) {
      problems.push({ code: "colors", message: "보기의 색 개수가 칸 수와 다릅니다" });
      break;
    }
    for (const value of colors.values()) {
      if (!Number.isFinite(value)) {
        problems.push({ code: "color", message: "보기의 색이 유한하지 않습니다" });
        break;
      }
    }
  }

  for (const face of Object.keys(target)) {
    if (!Number.isFinite(target[face])) {
      problems.push({ code: "target", message: "목표 상자의 색이 유한하지 않습니다" });
      break;
    }
  }

  if (picked !== null && (picked < 0 || picked >= options.length)) {
    problems.push({ code: "picked", message: "고른 보기가 범위를 벗어났습니다" });
  }

  return problems;
}
