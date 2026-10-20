import { describe, expect, it } from "vitest";
import {
  ARM,
  armLinks,
  armMinReach,
  armReach,
  blendAngles,
  closestParam2D,
  forwardArm,
  linksHitPillars,
  normalizeAngle,
  planPlacement,
  pointSegmentDistance,
  segmentHitsCylinder,
  shortestAngleDelta,
  solveArm,
} from "./ik.js";
import {
  BLOCK_SIZE,
  LEVELS,
  RACK,
  evaluatePlacement,
  goalOf,
  goalPoint,
  pickupPoint,
} from "./levels.js";

const L1 = ARM.upperLength;
const L2 = ARM.forearmLength;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

describe("역기구학", () => {
  it("각도를 풀면 끝점이 목표에 정확히 닿는다", () => {
    const target = { x: 1.4, y: 0.17, z: 1.5 };
    const angles = solveArm(target, ARM, 1);
    expect(angles.reachable).toBe(true);
    expect(distance(forwardArm(angles, ARM).tip, target)).toBeLessThan(1e-9);
  });

  it("아래로 접은 해도 목표에 닿는다", () => {
    const target = { x: 1.4, y: 0.17, z: 1.5 };
    const angles = solveArm(target, ARM, -1);
    expect(angles.reachable).toBe(true);
    expect(distance(forwardArm(angles, ARM).tip, target)).toBeLessThan(1e-9);
  });

  it("여러 위치에서 왕복이 성립한다", () => {
    const targets = [
      { x: 0.5, y: 0.2, z: 0.4 },
      { x: -1.2, y: 0.0, z: 2.1 },
      { x: 2.0, y: 1.4, z: 1.2 },
      { x: 0.8, y: -0.4, z: -1.5 },
      { x: -2.2, y: 0.6, z: -0.7 },
    ];
    for (const target of targets) {
      for (const sign of [1, -1]) {
        const angles = solveArm(target, ARM, sign);
        expect(angles.reachable).toBe(true);
        expect(distance(forwardArm(angles, ARM).tip, target)).toBeLessThan(1e-9);
      }
    }
  });

  it("베이스 회전은 atan2(x, z) 다", () => {
    const angles = solveArm({ x: 1, y: 0.2, z: 1 }, ARM, 1);
    expect(angles.baseYaw).toBeCloseTo(Math.PI / 4, 12);
  });

  it("도달 반경 밖은 미도달이다", () => {
    const far = { x: 0, y: 0, z: armReach(ARM) + 0.5 };
    const angles = solveArm(far, ARM, 1);
    expect(angles.reachable).toBe(false);
    expect(angles.residual).toBeGreaterThan(0.4);
  });

  it("너무 가까우면 미도달이다", () => {
    const near = { x: 0, y: ARM.shoulderHeight, z: 0.001 };
    const angles = solveArm(near, ARM, 1);
    expect(angles.reachable).toBe(false);
  });

  it("도달 반경 경계는 도달 가능하다", () => {
    const edge = { x: 0, y: ARM.shoulderHeight, z: armReach(ARM) - 1e-7 };
    expect(solveArm(edge, ARM, 1).reachable).toBe(true);
  });

  it("최소 도달 거리 경계는 미도달이다", () => {
    const inside = { x: 0, y: ARM.shoulderHeight, z: armMinReach(ARM) - 1e-6 };
    expect(solveArm(inside, ARM, 1).reachable).toBe(false);
  });

  it("두 해는 서로 다른 관절 각을 갖는다", () => {
    const target = { x: 1.9, y: 0.17, z: 1.9 };
    const up = solveArm(target, ARM, 1);
    const down = solveArm(target, ARM, -1);
    expect(up.reachable).toBe(true);
    expect(down.reachable).toBe(true);
    expect(Math.abs(up.shoulder - down.shoulder)).toBeGreaterThan(1e-6);
    expect(Math.abs(up.elbow - down.elbow)).toBeGreaterThan(1e-6);
  });

  it("어깨 높이가 팔의 기준점이다", () => {
    const angles = solveArm({ x: 0.5, y: 0.2, z: 0.5 }, ARM, 1);
    const { shoulderPos } = forwardArm(angles, ARM);
    expect(shoulderPos.y).toBeCloseTo(ARM.shoulderHeight, 12);
    expect(shoulderPos.x).toBeCloseTo(0, 12);
    expect(shoulderPos.z).toBeCloseTo(0, 12);
  });

  it("정방향 변환은 관절 위치도 준다", () => {
    const angles = solveArm({ x: 1.2, y: 0.3, z: 1.1 }, ARM, 1);
    const { shoulderPos, elbowPos, tip } = forwardArm(angles, ARM);
    expect(distance(shoulderPos, elbowPos)).toBeCloseTo(L1, 12);
    expect(distance(elbowPos, tip)).toBeCloseTo(L2, 12);
  });
});

describe("링크와 장애물", () => {
  const segment = { a: { x: 0, y: 1, z: 0 }, b: { x: 0, y: 1, z: 2 } };

  it("기둥을 지나는 선분은 충돌한다", () => {
    const pillar = { x: 0, z: 1, radius: 0.3, height: 2 };
    expect(segmentHitsCylinder(segment, pillar)).toBe(true);
  });

  it("옆으로 지나가는 선분은 충돌하지 않는다", () => {
    const pillar = { x: 1.5, z: 1, radius: 0.3, height: 2 };
    expect(segmentHitsCylinder(segment, pillar)).toBe(false);
  });

  it("높이 밖에서는 충돌하지 않는다", () => {
    const pillar = { x: 0, z: 1, radius: 0.3, height: 0.5 };
    expect(segmentHitsCylinder(segment, pillar)).toBe(false);
  });

  it("기둥 꼭대기를 넘는 선분은 거리로 판정한다", () => {
    const pillar = { x: 0, z: 1, radius: 0.3, height: 0.9 };
    expect(segmentHitsCylinder(segment, pillar)).toBe(true);
  });

  it("선분 위 최근접 매개변수를 구한다", () => {
    expect(closestParam2D({ x: 0, z: 1 }, segment.a, segment.b)).toBeCloseTo(0.5, 12);
    expect(closestParam2D({ x: 5, z: 5 }, segment.a, segment.b)).toBeCloseTo(1, 12);
    expect(closestParam2D({ x: 5, z: -5 }, segment.a, segment.b)).toBeCloseTo(0, 12);
  });

  it("점과 선분의 거리를 구한다", () => {
    expect(pointSegmentDistance({ x: 0, y: 2, z: 1 }, segment.a, segment.b)).toBeCloseTo(1, 12);
    expect(pointSegmentDistance({ x: 3, y: 1, z: 1 }, segment.a, segment.b)).toBeCloseTo(3, 12);
  });

  it("링크는 어깨에서 팔꿈치, 팔꿈치에서 끝점으로 이어진다", () => {
    const angles = solveArm({ x: 1.2, y: 0.3, z: 1.1 }, ARM, 1);
    const links = armLinks(angles, ARM);
    expect(links).toHaveLength(2);
    expect(links[0].a.x).toBeCloseTo(0, 12);
    expect(links[1].b).toEqual(forwardArm(angles, ARM).tip);
  });

  it("장애물이 없으면 링크가 막히지 않는다", () => {
    const angles = solveArm({ x: 1.2, y: 0.3, z: 1.1 }, ARM, 1);
    expect(linksHitPillars(angles, [], ARM)).toBe(false);
  });

  it("막히지 않는 해를 고른다", () => {
    const goal = { x: 1.9, y: 0.17, z: 1.9 };
    const pillars = [{ x: 0.75, z: 1.05, radius: 0.26, height: 1.3 }];
    const up = solveArm(goal, ARM, 1);
    const down = solveArm(goal, ARM, -1);
    expect(linksHitPillars(up, pillars, ARM)).toBe(true);
    expect(linksHitPillars(down, pillars, ARM)).toBe(false);

    const plan = planPlacement(goal, pillars, ARM);
    expect(plan.reachable).toBe(true);
    expect(plan.blocked).toBe(false);
    expect(linksHitPillars(plan.angles, pillars, ARM)).toBe(false);
  });

  it("도달할 수 없으면 계획이 막혔다고 말한다", () => {
    const plan = planPlacement({ x: 0, y: 0, z: armReach(ARM) + 1 }, [], ARM);
    expect(plan.reachable).toBe(false);
    expect(plan.blocked).toBe(false);
  });
});

describe("각도 보간", () => {
  it("각도를 정규화한다", () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 12);
    expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(Math.PI, 12);
    expect(normalizeAngle(0.5)).toBeCloseTo(0.5, 12);
  });

  it("최단 회전량을 구한다", () => {
    expect(shortestAngleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6, 12);
    expect(shortestAngleDelta(0, 1)).toBeCloseTo(1, 12);
  });

  it("보간 끝점이 목표 각도가 된다", () => {
    const from = { baseYaw: 0, shoulder: 0, elbow: 0 };
    const to = { baseYaw: 1, shoulder: 0.5, elbow: -0.25 };
    const end = blendAngles(from, to, 1);
    expect(end.baseYaw).toBeCloseTo(1, 12);
    expect(end.shoulder).toBeCloseTo(0.5, 12);
    expect(end.elbow).toBeCloseTo(-0.25, 12);
  });

  it("보간 중간은 두 각 사이에 있다", () => {
    const from = { baseYaw: 0, shoulder: 0, elbow: 0 };
    const to = { baseYaw: 1, shoulder: 1, elbow: 1 };
    const mid = blendAngles(from, to, 0.5);
    expect(mid.shoulder).toBeCloseTo(0.5, 12);
  });
});

describe("레벨 데이터", () => {
  it("레벨 id 가 유일하다", () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모든 레벨에 정답 표적이 있다", () => {
    for (const level of LEVELS) {
      const goal = goalOf(level);
      expect(goal).toBeTruthy();
      expect(goal.kind).toBe("goal");
    }
  });

  it("표적 좌표는 유한하다", () => {
    for (const level of LEVELS) {
      for (const target of level.targets) {
        expect(Number.isFinite(target.x)).toBe(true);
        expect(Number.isFinite(target.z)).toBe(true);
        expect(Number.isFinite(target.y)).toBe(true);
      }
    }
  });

  it("허용 오차와 별점 구간이 정렬돼 있다", () => {
    for (const level of LEVELS) {
      expect(level.stars.three).toBeLessThan(level.stars.two);
      expect(level.stars.two).toBeLessThan(level.tolerance);
      expect(level.tolerance).toBeGreaterThan(0);
    }
  });

  it("정답 표적에는 항상 해가 있다", () => {
    for (const level of LEVELS) {
      const plan = planPlacement(goalPoint(level), level.pillars, ARM);
      expect(plan.reachable).toBe(true);
      expect(plan.blocked).toBe(false);
      expect(plan.residual).toBeLessThan(1e-9);
    }
  });

  it("미끼 표적은 도달할 수 없다", () => {
    for (const level of LEVELS) {
      for (const target of level.targets) {
        if (target.kind !== "decoy") continue;
        const plan = planPlacement({ x: target.x, y: target.y + BLOCK_SIZE / 2, z: target.z }, level.pillars, ARM);
        expect(plan.reachable).toBe(false);
      }
    }
  });

  it("블록을 집을 자리에는 항상 팔이 닿는다", () => {
    for (const level of LEVELS) {
      const plan = planPlacement(pickupPoint(level), level.pillars, ARM);
      expect(plan.reachable).toBe(true);
      expect(plan.blocked).toBe(false);
    }
  });

  it("레벨은 점점 어려워진다", () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      expect(LEVELS[i].tolerance).toBeLessThan(LEVELS[i - 1].tolerance);
    }
  });

  it("장작대 위치는 모든 레벨에서 같다", () => {
    expect(RACK.x).toBeLessThan(0);
    expect(pickupPoint(LEVELS[0]).x).toBe(RACK.x);
  });
});

describe("배치 판정", () => {
  const level = LEVELS[0];

  it("정확히 맞추면 별 3개", () => {
    expect(evaluatePlacement(0, level)).toEqual({ cleared: true, stars: 3, error: 0 });
  });

  it("조금 벗어나도 통과한다", () => {
    expect(evaluatePlacement(level.stars.two - 0.01, level).stars).toBe(2);
    expect(evaluatePlacement(level.stars.two + 0.01, level).stars).toBe(1);
    expect(evaluatePlacement(level.tolerance - 0.01, level).stars).toBe(1);
  });

  it("허용 오차를 넘으면 실패다", () => {
    const result = evaluatePlacement(level.tolerance + 0.01, level);
    expect(result.cleared).toBe(false);
    expect(result.stars).toBe(0);
  });

  it("숫자가 아니면 실패로 처리한다", () => {
    expect(evaluatePlacement(Number.NaN, level).cleared).toBe(false);
  });

  it("오차가 작을수록 별이 많다", () => {
    expect(evaluatePlacement(0.01, level).stars).toBeGreaterThan(evaluatePlacement(0.2, level).stars);
  });
});
