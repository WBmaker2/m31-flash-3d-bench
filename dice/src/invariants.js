// 기하 불변식. 항상 참이어야 하는 것만 검사한다.
import { faceFromUp, upFromQuaternion } from "../../common/parts/board3d.js";

export function checkInvariants({ game, dieQuaternion, reportedValue, tokenPositions, expectedPositions, moving, rolling }) {
  const problems = [];

  // 굴러가는 주사위와 이동 중인 말은 중간 상태라 검사하지 않는다.
  if (dieQuaternion && reportedValue > 0 && !rolling) {
    const up = upFromQuaternion(dieQuaternion);
    const { face, dot } = faceFromUp(up);
    if (face !== reportedValue) {
      problems.push({
        code: "die-face",
        message: `주사위 자세를 읽으면 ${face} 이 나오는데 ${reportedValue} 로 보고 있습니다`,
      });
    }
    if (dot < 0.99) {
      problems.push({
        code: "die-settle",
        message: `주사위가 아직 멈추지 않았습니다 (정렬도 ${dot.toFixed(3)})`,
      });
    }
  }

  if (moving) return problems;

  game.players.forEach((player, index) => {
    const visual = tokenPositions[index];
    const expected = expectedPositions[index];
    if (!visual || !expected) return;
    const distance = Math.hypot(visual.x - expected.x, visual.z - expected.z);
    if (!Number.isFinite(distance)) {
      problems.push({ code: "token", message: `${player.name} 의 위치가 유한하지 않습니다` });
      return;
    }
    if (distance > 1e-6) {
      problems.push({
        code: "token",
        message: `${player.name} 이 ${player.position} 번 칸이 아닌 곳에 있습니다 (오차 ${distance.toExponential(2)} m)`,
      });
    }
  });

  return problems;
}
