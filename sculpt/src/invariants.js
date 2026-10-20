// 런타임 기하 불변식. 항상 참이어야 하는 것만 검사한다.
import { BOUNDS } from "./sdf.js";

export function checkInvariants({
  elements = [],
  maxParts = 0,
  resultVolume = 0,
  resultVertices = 0,
  ghostVertices = 0,
  iou = 0,
  volumeRatio = 0,
} = {}) {
  const problems = [];

  if (elements.length > maxParts) {
    problems.push({
      code: "part-limit",
      message: `부품이 ${elements.length} 개인데 제한은 ${maxParts} 개입니다.`,
    });
  }

  for (const element of elements) {
    const values = [
      element.position.x,
      element.position.y,
      element.position.z,
      element.rotationY ?? 0,
    ];
    if (!values.every((value) => Number.isFinite(value))) {
      problems.push({ code: "part-not-finite", message: "부품의 좌표가 유한하지 않습니다." });
      break;
    }
    if (
      Math.abs(element.position.x) > BOUNDS ||
      Math.abs(element.position.y) > BOUNDS ||
      Math.abs(element.position.z) > BOUNDS
    ) {
      problems.push({ code: "part-outside-bounds", message: "부품이 작업 범위 밖으로 나갔습니다." });
      break;
    }
  }

  if (!Number.isFinite(resultVolume) || resultVolume < 0) {
    problems.push({ code: "volume-invalid", message: "조각의 부피 값이 올바르지 않습니다." });
  }

  if (resultVertices <= 0) {
    problems.push({ code: "result-empty", message: "결과 조각이 비어 있습니다." });
  }

  if (ghostVertices <= 0) {
    problems.push({ code: "ghost-empty", message: "목표 고스트가 비어 있습니다." });
  }

  if (!Number.isFinite(iou) || iou < 0 || iou > 1) {
    problems.push({ code: "iou-invalid", message: "일치도 값이 0~1 사이가 아닙니다." });
  }

  if (!Number.isFinite(volumeRatio) || volumeRatio < 0) {
    problems.push({ code: "volume-ratio-invalid", message: "부피 비율 값이 올바르지 않습니다." });
  }

  return problems;
}
