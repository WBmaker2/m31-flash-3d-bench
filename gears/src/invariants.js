// 기하 불변식. 항상 참이어야 하는 것만 검사한다.
import {
  MESH_TOLERANCE,
  PHASE_TOLERANCE,
  meshingPairs,
  meshDistance,
  overlappingPairs,
  phaseValue,
  slotDistance,
} from "../../common/parts/gear3d.js";

export function checkInvariants({ nodes, angles, previousAngles, conflicts }) {
  const problems = [];

  for (const [id, angle] of angles) {
    if (!Number.isFinite(angle)) {
      problems.push({ code: "angle", message: `${id} 톱니바퀴의 각도가 유한하지 않습니다` });
    }
  }

  for (const [a, b] of meshingPairs(nodes)) {
    const error = Math.abs(slotDistance(a, b) - meshDistance(a.teeth, b.teeth));
    if (error > MESH_TOLERANCE) {
      problems.push({
        code: "mesh-distance",
        message: `${a.id} 와 ${b.id} 의 중심 거리가 맞물림 거리와 ${error.toExponential(2)} 만큼 다릅니다`,
      });
    }
  }

  const overlaps = overlappingPairs(nodes);
  if (overlaps.length > 0) {
    problems.push({
      code: "overlap",
      message: `${overlaps[0][0].id} 와 ${overlaps[0][1].id} 톱니바퀴가 겹칩니다`,
    });
  }

  if (conflicts && conflicts.length > 0) {
    problems.push({
      code: "conflict",
      message: `${conflicts[0].a} 와 ${conflicts[0].b} 가 고리로 맞물려 회전할 수 없습니다`,
    });
  }

  if (previousAngles) {
    for (const [a, b] of meshingPairs(nodes)) {
      const before = phaseValue(previousAngles.get(a.id), a.teeth, previousAngles.get(b.id), b.teeth);
      const after = phaseValue(angles.get(a.id), a.teeth, angles.get(b.id), b.teeth);
      const drift = Math.abs(after - before);
      if (drift > PHASE_TOLERANCE * 1000) {
        problems.push({
          code: "phase",
          message: `${a.id} 와 ${b.id} 의 톱니 위상이 ${drift.toExponential(2)} 만큼 어긋났습니다`,
        });
      }
    }
  }

  return problems;
}
