// 런타임 기하 불변식. 항상 참이어야 하는 것만 검사한다.
import { FLOCK, length } from "./flock.js";
import { ARENA } from "./levels.js";

export function checkInvariants({
  birds = [],
  light = null,
  gates = [],
  activeIndex = 0,
  spread = 0,
  timeLeft = 0,
  count = 0,
} = {}) {
  const problems = [];

  if (birds.length !== count) {
    problems.push({
      code: "bird-count",
      message: `무리 개체 수가 ${birds.length} 인데 ${count} 를 기대합니다.`,
    });
  }

  for (const bird of birds) {
    const values = [bird.position.x, bird.position.y, bird.position.z, bird.velocity.x, bird.velocity.y, bird.velocity.z];
    if (!values.every((value) => Number.isFinite(value))) {
      problems.push({ code: "bird-not-finite", message: "새의 좌표나 속도가 유한하지 않습니다." });
      break;
    }
    const speed = length(bird.velocity);
    if (speed > FLOCK.maxSpeed + 1e-6) {
      problems.push({
        code: "bird-too-fast",
        message: `새의 속도가 ${speed.toFixed(1)} m/s 로 상한(${FLOCK.maxSpeed})을 넘었습니다.`,
      });
      break;
    }
    if (
      Math.abs(bird.position.x) > ARENA.halfX + 0.5 ||
      Math.abs(bird.position.y) > ARENA.halfY + 0.5 ||
      Math.abs(bird.position.z) > ARENA.halfZ + 0.5
    ) {
      problems.push({ code: "bird-outside-arena", message: "새가 경기장 밖으로 나갔습니다." });
      break;
    }
  }

  if (light) {
    const values = [light.x, light.y, light.z];
    if (!values.every((value) => Number.isFinite(value))) {
      problems.push({ code: "light-not-finite", message: "불빛 좌표가 유한하지 않습니다." });
    } else if (
      Math.abs(light.x) > ARENA.halfX + 0.5 ||
      Math.abs(light.y) > ARENA.halfY + 0.5 ||
      Math.abs(light.z) > ARENA.halfZ + 0.5
    ) {
      problems.push({ code: "light-outside-arena", message: "불빛이 경기장 밖으로 나갔습니다." });
    }
  }

  if (!Number.isFinite(spread) || spread < 0) {
    problems.push({ code: "spread-invalid", message: "흩어짐 값이 올바르지 않습니다." });
  }
  if (!Number.isFinite(timeLeft)) {
    problems.push({ code: "time-invalid", message: "남은 시간 값이 올바르지 않습니다." });
  }
  if (activeIndex < 0 || activeIndex > gates.length) {
    problems.push({ code: "gate-index-invalid", message: "현재 링 번호가 범위를 벗어났습니다." });
  }

  return problems;
}
