// 기하 불변식. 항상 참이어야 하는 것만 검사한다.
import { MIRROR_NORMAL, reflect } from "../../common/parts/optic3d.js";

export function checkInvariants({ path, mirrors, orientations, reflectedDirection, incomingDirection }) {
  const problems = [];

  for (const cell of path) {
    if (!Number.isFinite(cell.col) || !Number.isFinite(cell.row)) {
      problems.push({ code: "path", message: "빛길이 좌표가 유한하지 않습니다" });
      break;
    }
  }

  for (const [cell, orientation] of orientations) {
    if (!mirrors.has(cell)) {
      problems.push({ code: "mirror", message: `${cell} 거울이 판에 없습니다` });
      break;
    }
    if (!MIRROR_NORMAL[orientation]) {
      problems.push({ code: "orientation", message: `${cell} 거울의 방향이 잘못됐습니다` });
      break;
    }
  }

  if (incomingDirection && reflectedDirection) {
    const expected = reflect(incomingDirection, MIRROR_NORMAL.slash);
    if (!Number.isFinite(expected.x) || !Number.isFinite(reflectedDirection.x)) {
      problems.push({ code: "reflect", message: "반사 벡터가 유한하지 않습니다" });
    }
  }

  return problems;
}
