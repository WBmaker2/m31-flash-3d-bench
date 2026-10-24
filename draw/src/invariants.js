// 기하 불변식. 항상 참이어야 하는 것만 검사한다.
export function checkInvariants({ placement, rate, matched, total, extra }) {
  const problems = [];

  for (const [key, color] of placement) {
    if (typeof color !== "string" || color.length === 0) {
      problems.push({ code: "color", message: `${key} 칸의 색이 올바르지 않습니다` });
      break;
    }
    const [col, row] = key.split(",").map(Number);
    if (!Number.isFinite(col) || !Number.isFinite(row)) {
      problems.push({ code: "position", message: `${key} 칸의 좌표가 유한하지 않습니다` });
      break;
    }
  }

  if (!(rate >= 0 && rate <= 1)) {
    problems.push({ code: "rate", message: `일치율이 ${rate} 로 범위를 벗어났습니다` });
  }
  if (matched < 0 || matched > total) {
    problems.push({ code: "matched", message: "맞은 칸 수가 범위를 벗어났습니다" });
  }
  if (extra < 0) {
    problems.push({ code: "extra", message: "잘못 놓은 칸 수가 음수입니다" });
  }

  return problems;
}
