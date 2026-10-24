// 기하 불변식. 항상 참이어야 하는 것만 검사한다.
import { MAX_TILT } from "../../common/parts/balance3d.js";

export function checkInvariants({ geometry, placement, viewAngle, computedAngle, count }) {
  const problems = [];

  if (!geometry) return problems;

  if (placement.length !== count) {
    problems.push({ code: "count", message: `추 개수가 ${placement.length} 에서 ${count} 로 바뀌었습니다` });
  }

  for (const item of placement) {
    const slot = geometry.slots.find((entry) => entry.id === item.slot);
    if (!slot) {
      problems.push({ code: "slot", message: `${item.slot} 칸이 저울에 없습니다` });
      continue;
    }
    if (!Number.isFinite(slot.x)) {
      problems.push({ code: "position", message: `${item.slot} 칸의 위치가 유한하지 않습니다` });
    }
  }

  if (Math.abs(viewAngle - computedAngle) > 1e-9) {
    problems.push({
      code: "angle",
      message: `저울판 각도 ${viewAngle.toFixed(9)} 가 계산값 ${computedAngle.toFixed(9)} 와 다릅니다`,
    });
  }

  if (Math.abs(computedAngle) > MAX_TILT + 1e-9) {
    problems.push({ code: "tilt", message: "저울판이 너무 많이 기울어졌습니다" });
  }

  return problems;
}
