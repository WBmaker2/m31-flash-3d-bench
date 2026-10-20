// 레벨 진행 규칙. 순수 함수.
import { findUnsupported } from "./physics.js";

/**
 * 표적이 파괴됐을 때의 결과를 계산한다. 지지를 잃고 무너지는 블록도 함께 구한다.
 * @returns {{hit:object|null, destroyed:object|null, remaining:Array, falling:Array}}
 */
export function resolveImpact(blocks = [], hitId) {
  const hit = blocks.find((block) => block.id === hitId) ?? null;
  if (!hit || hit.kind !== "target") {
    return { hit, destroyed: null, remaining: blocks, falling: [] };
  }

  const without = blocks.filter((block) => block.id !== hitId);
  const fallingIds = new Set(findUnsupported(without));
  return {
    hit,
    destroyed: hit,
    falling: without.filter((block) => fallingIds.has(block.id)),
    remaining: without.filter((block) => !fallingIds.has(block.id)),
  };
}

/**
 * 한 발이 끝났을 때 레벨이 끝났는지 판단한다.
 * @returns {"won"|"lost"|"continue"}
 */
export function resolveOutcome({ targetsLeft = 0, shotsUsed = 0, shotsLimit = 0 } = {}) {
  if (targetsLeft <= 0) return "won";
  if (shotsUsed >= shotsLimit) return "lost";
  return "continue";
}
