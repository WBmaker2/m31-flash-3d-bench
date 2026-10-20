// 런타임 기하 불변식. 항상 참이어야 하는 것만 검사한다.
import { BLOCK_HALF_M, GRAVITY_MPS2 } from "./physics.js";
import { cellKey } from "./grid.js";

const MAX_SPEED_MPS = 80;
const MAX_HEIGHT_M = 80;

export function checkInvariants({
  projectile = null,
  debris = [],
  blocks = [],
  shotsUsed = 0,
  shotsLimit = 0,
  targetsLeft = 0,
  speedLimit = MAX_SPEED_MPS,
} = {}) {
  const problems = [];

  if (projectile) {
    const { position, velocity } = projectile;
    const finite = [position.x, position.y, position.z, velocity.x, velocity.y, velocity.z];
    if (!finite.every((value) => Number.isFinite(value))) {
      problems.push({ code: "projectile-not-finite", message: "발사체의 좌표나 속도가 유한하지 않습니다." });
    }
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    if (speed > speedLimit) {
      problems.push({
        code: "projectile-speed",
        message: `발사체 속도가 ${speed.toFixed(1)} m/s 로 상한(${speedLimit})을 넘었습니다.`,
      });
    }
    if (position.y > MAX_HEIGHT_M) {
      problems.push({
        code: "projectile-height",
        message: `발사체 높이가 ${position.y.toFixed(1)} m 로 상한(${MAX_HEIGHT_M})을 넘었습니다.`,
      });
    }
  }

  for (const piece of debris) {
    if (!Number.isFinite(piece.position?.y)) {
      problems.push({ code: "debris-not-finite", message: "잔해의 좌표가 유한하지 않습니다." });
      continue;
    }
    if (piece.position.y < BLOCK_HALF_M - 1e-6) {
      problems.push({
        code: "debris-below-ground",
        message: `잔해가 지면 아래로 내려갔습니다 (y=${piece.position.y.toFixed(2)}).`,
      });
    }
  }

  const occupied = new Map();
  for (const block of blocks) {
    if (!Number.isFinite(block.i) || !Number.isFinite(block.j) || !Number.isFinite(block.k)) {
      problems.push({ code: "block-not-finite", message: "블록의 격자 좌표가 유한하지 않습니다." });
      continue;
    }
    if (block.j < 0) {
      problems.push({ code: "block-below-ground", message: "블록이 지면 아래 칸에 있습니다." });
    }
    const key = cellKey(block);
    if (occupied.has(key)) {
      problems.push({
        code: "block-overlap",
        message: `두 블록이 같은 칸 (${key}) 을 차지하고 있습니다.`,
      });
    } else {
      occupied.set(key, block.id);
    }
  }

  if (shotsUsed > shotsLimit) {
    problems.push({
      code: "shots-over-limit",
      message: `사용한 샷(${shotsUsed})이 제한(${shotsLimit})을 넘었습니다.`,
    });
  }
  if (shotsUsed < 0 || targetsLeft < 0) {
    problems.push({ code: "counter-negative", message: "샷이나 표적 개수가 음수가 되었습니다." });
  }

  if (!Number.isFinite(GRAVITY_MPS2)) {
    problems.push({ code: "gravity-invalid", message: "중력 값이 유한하지 않습니다." });
  }

  return problems;
}
