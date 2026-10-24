// 기하 불변식. 항상 참이어야 하는 것만 검사한다.
export function checkInvariants({ built, colors, surfaceCount, rate }) {
  const problems = [];

  if (!built) return problems;

  if (built.surface.size !== surfaceCount) {
    problems.push({
      code: "surface",
      message: `표면 복셀 수가 ${built.surface.size} 에서 ${surfaceCount} 로 바뀌었습니다`,
    });
  }

  if (built.adjacency.size !== built.surface.size) {
    problems.push({
      code: "adjacency",
      message: "인접 그래프와 표면 복셀 수가 다릅니다",
    });
  }

  for (const [key, color] of colors) {
    if (!Number.isFinite(color)) {
      problems.push({ code: "color", message: `${key} 복셀의 색이 유한하지 않습니다` });
      break;
    }
  }

  if (built.overlaps.length > 0) {
    problems.push({
      code: "overlap",
      message: `${built.overlaps[0].partId} 와 ${built.overlaps[0].other} 조각이 겹칩니다`,
    });
  }

  if (!(rate >= 0 && rate <= 1)) {
    problems.push({ code: "rate", message: `일치율이 ${rate} 로 범위를 벗어났습니다` });
  }

  return problems;
}
