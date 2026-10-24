// 기하 불변식. 항상 참이어야 하는 것만 검사한다.
import { MAX_FALL } from "../../common/parts/platform3d.js";
import { overlapsPlatform } from "../../common/parts/platform3d.js";

export function checkInvariants({ player, platforms, coins, collected, goalReached }) {
  const problems = [];

  if (!Number.isFinite(player.x) || !Number.isFinite(player.y) || !Number.isFinite(player.z)) {
    problems.push({ code: "position", message: "캐릭터 위치가 유한하지 않습니다" });
    return problems;
  }

  if (player.vy < -MAX_FALL - 1e-9) {
    problems.push({ code: "fall", message: "낙하 속도가 한계를 넘었습니다" });
  }

  if (player.onGround && player.vy !== 0) {
    problems.push({ code: "ground", message: "땅에 서 있는데 아직 떨어지고 있습니다" });
  }

  for (const platform of platforms) {
    if (overlapsPlatform({ x: player.x, y: player.y, z: player.z, platform })) {
      problems.push({ code: "clip", message: "캐릭터가 구름 안에 박혀 있습니다" });
      break;
    }
  }

  for (const [index, coin] of coins.entries()) {
    if (collected.has(index)) continue;
    if (!Number.isFinite(coin.x) || !Number.isFinite(coin.y)) {
      problems.push({ code: "coin", message: "동전 위치가 유한하지 않습니다" });
      break;
    }
  }

  if (goalReached && !collected) {
    problems.push({ code: "goal", message: "결승 상태가 올바르지 않습니다" });
  }

  return problems;
}
