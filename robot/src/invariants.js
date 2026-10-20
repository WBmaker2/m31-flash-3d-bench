// 런타임 기하 불변식. 항상 참이어야 하는 것만 검사한다.
import { ARM } from "./ik.js";
import { BLOCK_SIZE } from "./levels.js";
import { linksHitPillars } from "./ik.js";

const MAX_ERROR_M = 12;

export function checkInvariants({
  angles = null,
  tip = null,
  pillars = [],
  blockPosition = null,
  error = null,
  attempts = 0,
} = {}) {
  const problems = [];

  if (angles) {
    const values = [angles.baseYaw, angles.shoulder, angles.elbow];
    if (!values.every((value) => Number.isFinite(value))) {
      problems.push({ code: "angles-not-finite", message: "관절 각이 유한하지 않습니다." });
    } else {
      if (Math.abs(angles.shoulder) > Math.PI + 1e-6 || Math.abs(angles.elbow) > Math.PI + 1e-6) {
        problems.push({ code: "angle-out-of-range", message: "관절 각이 범위를 벗어났습니다." });
      }
      if (linksHitPillars(angles, pillars, ARM)) {
        problems.push({ code: "link-hits-pillar", message: "팔의 링크가 기둥을 관통하고 있습니다." });
      }
    }
  }

  if (tip) {
    if (![tip.x, tip.y, tip.z].every((value) => Number.isFinite(value))) {
      problems.push({ code: "tip-not-finite", message: "그리퍼 끝점 좌표가 유한하지 않습니다." });
    } else {
      const distance = Math.hypot(tip.x, tip.z);
      const reach = ARM.upperLength + ARM.forearmLength;
      if (distance > reach + 1e-6) {
        problems.push({
          code: "tip-out-of-reach",
          message: `그리퍼가 도달 반경(${reach.toFixed(2)} m) 밖입니다 (${distance.toFixed(2)} m).`,
        });
      }
      if (tip.y < -1.5) {
        problems.push({ code: "tip-below-floor", message: "그리퍼가 바닥 아래로 내려갔습니다." });
      }
    }
  }

  if (blockPosition) {
    if (!Number.isFinite(blockPosition.y)) {
      problems.push({ code: "block-not-finite", message: "블록 좌표가 유한하지 않습니다." });
    } else if (blockPosition.y < -1.5) {
      problems.push({
        code: "block-below-floor",
        message: `블록이 작업대 아래로 떨어졌습니다 (y=${blockPosition.y.toFixed(2)}).`,
      });
    }
  }

  if (error !== null && (!Number.isFinite(error) || error > MAX_ERROR_M)) {
    problems.push({ code: "error-invalid", message: "배치 오차 값이 올바르지 않습니다." });
  }

  if (attempts < 0) {
    problems.push({ code: "attempts-negative", message: "시도 횟수가 음수입니다." });
  }

  void BLOCK_SIZE;
  return problems;
}
