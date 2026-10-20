import { describe, expect, it } from "vitest";
import {
  FLOCK,
  alignmentSteer,
  boundarySteer,
  cohesionSteer,
  createRandom,
  dot,
  flockMetrics,
  length,
  neighborsWithin,
  normalize,
  scatterFlock,
  separationSteer,
  stepFlock,
  targetSteer,
  throughGate,
  vec,
} from "./flock.js";
import { ARENA, GATE_RADIUS, LEVELS, buildGates, evaluateFlock, levelById, scoreForFlock } from "./levels.js";

function bird(x, y, z, vx = 0, vy = 0, vz = 0) {
  return {
    position: { x, y, z },
    velocity: { x: vx, y: vy, z: vz },
  };
}

const ONLY_SEPARATION = {
  ...FLOCK,
  alignmentWeight: 0,
  cohesionWeight: 0,
  targetWeight: 0,
  wallWeight: 0,
};

const ONLY_ALIGNMENT = { ...ONLY_SEPARATION, alignmentWeight: 1, separationWeight: 0 };
const ONLY_COHESION = { ...ONLY_SEPARATION, cohesionWeight: 1, separationWeight: 0 };

describe("이웃 탐색", () => {
  it("반경 안의 이웃만 찾는다", () => {
    const birds = [bird(0, 0, 0), bird(1, 0, 0), bird(5, 0, 0)];
    expect(neighborsWithin(birds, 0, 2)).toEqual([1]);
  });

  it("경계 거리의 이웃도 포함한다", () => {
    const birds = [bird(0, 0, 0), bird(2, 0, 0)];
    expect(neighborsWithin(birds, 0, 2)).toEqual([1]);
  });

  it("자기 자신은 제외한다", () => {
    const birds = [bird(0, 0, 0), bird(0.5, 0, 0)];
    expect(neighborsWithin(birds, 0, 3)).toEqual([1]);
    expect(neighborsWithin(birds, 1, 3)).toEqual([0]);
  });
});

describe("분리 규칙", () => {
  it("가까운 이웃을 밀어내는 방향을 가리킨다", () => {
    // 이웃이 +X 에 있으므로첫 새는 -X 로 밀려난다.
    const birds = [bird(0, 0, 0), bird(0.5, 0, 0)];
    const steer = separationSteer(birds, 0, FLOCK);
    expect(steer.x).toBeCloseTo(-1, 9);
  });

  it("가까운 두 새는 서로 멀어진다", () => {
    const birds = [bird(0, 0, 0, 0, 0, 0), bird(0.6, 0, 0, 0, 0, 0)];
    const next = stepFlock(birds, ONLY_SEPARATION, 1 / 60, null);
    const before = length(next[1].position);
    const after = Math.hypot(
      next[1].position.x - next[0].position.x,
      next[1].position.y - next[0].position.y,
      next[1].position.z - next[0].position.z,
    );
    expect(after).toBeGreaterThan(before);
  });

  it("떨어진 새에게는 힘이 없다", () => {
    const birds = [bird(0, 0, 0), bird(10, 0, 0)];
    expect(length(separationSteer(birds, 0, FLOCK))).toBe(0);
  });
});

describe("정렬 규칙", () => {
  it("이웃과 같은 방향을 가리킨다", () => {
    const birds = [bird(0, 0, 0, 0, 0, 0), bird(1, 0, 0, 6, 0, 0), bird(-1, 0, 0, 6, 0, 0)];
    const steer = alignmentSteer(birds, 0, FLOCK);
    expect(steer.x).toBeGreaterThan(0.9);
  });

  it("이웃이 없으면 힘이 없다", () => {
    const birds = [bird(0, 0, 0), bird(20, 0, 0)];
    expect(length(alignmentSteer(birds, 0, FLOCK))).toBe(0);
  });
});

describe("응집 규칙", () => {
  it("무리 중심을 가리킨다", () => {
    const birds = [bird(0, 0, 0), bird(2, 0, 0), bird(3, 0, 0)];
    const steer = cohesionSteer(birds, 0, FLOCK);
    expect(steer.x).toBeCloseTo(1, 9);
  });

  it("가운데에 혼자 있으면 힘이 없다", () => {
    const birds = [bird(0, 0, 0), bird(20, 0, 0), bird(-20, 0, 0)];
    expect(length(cohesionSteer(birds, 0, FLOCK))).toBe(0);
  });
});

describe("목표와 경계", () => {
  it("목표를 향한다", () => {
    const steer = targetSteer({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
    expect(steer.x).toBeCloseTo(1, 9);
  });

  it("목표가 없으면 힘이 없다", () => {
    expect(length(targetSteer({ x: 0, y: 0, z: 0 }, null))).toBe(0);
  });

  it("경계에서는 안쪽을 가리킨다", () => {
    const steer = boundarySteer({ x: ARENA.halfX - 1, y: 0, z: 0 }, FLOCK);
    expect(steer.x).toBeLessThan(0);
  });

  it("경기장 한가운데에서는 힘이 없다", () => {
    expect(length(boundarySteer({ x: 0, y: 0, z: 0 }, FLOCK))).toBe(0);
  });
});

describe("무리 갱신", () => {
  it("속도가 상한을 넘지 않는다", () => {
    const birds = [bird(0, 0, 0, 0, 0, 0)];
    const next = stepFlock(birds, FLOCK, 1 / 60, { x: 100, y: 0, z: 0 });
    expect(length(next[0].velocity)).toBeLessThanOrEqual(FLOCK.maxSpeed + 1e-9);
  });

  it("움직이는 새의 속도가 하한 아래로 떨어지지 않는다", () => {
    const birds = [bird(0, 0, 0, 6, 0, 0)];
    const next = stepFlock(birds, FLOCK, 1 / 60, { x: 0.01, y: 0, z: 0 });
    expect(length(next[0].velocity)).toBeGreaterThanOrEqual(FLOCK.minSpeed - 1e-9);
  });

  it("입력 배열을 바꾸지 않는다", () => {
    const birds = [bird(0, 0, 0, 6, 0, 0), bird(1, 0, 0, 6, 0, 0)];
    const before = JSON.stringify(birds);
    stepFlock(birds, FLOCK, 1 / 60, { x: 5, y: 0, z: 0 });
    expect(JSON.stringify(birds)).toBe(before);
  });

  it("같은 입력은 같은 결과를 낸다", () => {
    const birds = scatterFlock(30, 77);
    const target = { x: 3, y: 2, z: -4 };
    const a = stepFlock(birds, FLOCK, 1 / 60, target);
    const b = stepFlock(birds, FLOCK, 1 / 60, target);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("스텝 크기를 절반으로 나눠 두 번 해도 거의 같다", () => {
    const birds = scatterFlock(24, 909);
    const target = { x: 6, y: 1, z: -6 };
    const one = stepFlock(birds, FLOCK, 1 / 60, target);
    const half = stepFlock(birds, FLOCK, 1 / 120, target);
    const two = stepFlock(half, FLOCK, 1 / 120, target);
    const diff = Math.hypot(
      one[0].position.x - two[0].position.x,
      one[0].position.y - two[0].position.y,
      one[0].position.z - two[0].position.z,
    );
    expect(diff).toBeLessThan(1.5);
  });

  it("경기장 밖으로 나가지 않는다", () => {
    let birds = scatterFlock(60, 31337);
    for (let i = 0; i < 240; i += 1) {
      birds = stepFlock(birds, FLOCK, 1 / 60, { x: 60, y: 0, z: 60 });
    }
    for (const b of birds) {
      expect(Math.abs(b.position.x)).toBeLessThanOrEqual(ARENA.halfX + 1);
      expect(Math.abs(b.position.y)).toBeLessThanOrEqual(ARENA.halfY + 1);
      expect(Math.abs(b.position.z)).toBeLessThanOrEqual(ARENA.halfZ + 1);
    }
  });

  it("불빛을 향해 모여든다", () => {
    let birds = scatterFlock(40, 5150);
    const target = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 400; i += 1) birds = stepFlock(birds, FLOCK, 1 / 60, target);
    const after = flockMetrics(birds);
    // 무리의 중심이 불빛 쪽으로 모인다.
    expect(Math.hypot(after.centroid.x, after.centroid.z)).toBeLessThan(8);
    expect(after.spread).toBeLessThan(20);
  });
});

describe("무리 지표", () => {
  it("중심과 평균 속도를 정확히 낸다", () => {
    const birds = [bird(0, 0, 0, 3, 0, 0), bird(2, 0, 0, 3, 0, 0)];
    const metrics = flockMetrics(birds);
    expect(metrics.centroid.x).toBeCloseTo(1, 9);
    expect(metrics.meanSpeed).toBeCloseTo(3, 9);
    expect(metrics.count).toBe(2);
  });

  it("흩어짐은 중심으로부터의 평균 거리다", () => {
    const birds = [bird(-1, 0, 0), bird(1, 0, 0)];
    expect(flockMetrics(birds).spread).toBeCloseTo(1, 9);
  });

  it("빈 무리는 0 을 준다", () => {
    const metrics = flockMetrics([]);
    expect(metrics.count).toBe(0);
    expect(metrics.spread).toBe(0);
  });
});

describe("게이트 통과 판정", () => {
  const gate = { center: { x: 0, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 }, radius: 3 };

  it("링 안을 지나면 통과다", () => {
    expect(throughGate({ x: -2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, gate)).toBe(true);
  });

  it("링 바깥을 지나면 통과가 아니다", () => {
    expect(throughGate({ x: -2, y: 0, z: 8 }, { x: 2, y: 0, z: 8 }, gate)).toBe(false);
  });

  it("평면을 넘지 않으면 통과가 아니다", () => {
    // 둘 다 평면의 같은 쪽에 있다.
    expect(throughGate({ x: -2, y: 0, z: 1 }, { x: -1, y: 0, z: 1 }, gate)).toBe(false);
  });

  it("반대 방향으로 넘어가면 통과가 아니다", () => {
    expect(throughGate({ x: 2, y: 0, z: 0 }, { x: -2, y: 0, z: 0 }, gate)).toBe(false);
  });

  it("평행하게 지나가면 통과가 아니다", () => {
    expect(throughGate({ x: -2, y: 0, z: 0 }, { x: -2, y: 0, z: 4 }, gate)).toBe(false);
  });
});

describe("레벨 데이터", () => {
  it("레벨 id 가 유일하다", () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("게이트 수가 레벨 설정과 같다", () => {
    for (const level of LEVELS) {
      expect(buildGates(level)).toHaveLength(level.gates);
    }
  });

  it("게이트가 경기장 안에 있다", () => {
    for (const level of LEVELS) {
      for (const gate of buildGates(level)) {
        expect(Math.abs(gate.center.x)).toBeLessThan(ARENA.halfX);
        expect(Math.abs(gate.center.z)).toBeLessThan(ARENA.halfZ);
        expect(gate.center.y).toBeGreaterThan(0);
        expect(gate.center.y).toBeLessThan(ARENA.halfY);
        expect(gate.radius).toBe(GATE_RADIUS);
      }
    }
  });

  it("게이트끼리 너무 붙어 있지 않다", () => {
    for (const level of LEVELS) {
      const gates = buildGates(level);
      for (let i = 1; i < gates.length; i += 1) {
        const a = gates[i - 1].center;
        const b = gates[i].center;
        expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(5);
      }
    }
  });

  it("게이트의 법선은 길 방향과 수직이다", () => {
    for (const level of LEVELS) {
      for (const gate of buildGates(level)) {
        expect(Math.abs(dot(gate.normal, gate.normal) - 1)).toBeLessThan(1e-9);
      }
    }
  });

  it("무리 규모와 시간이 늘어난다", () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      expect(LEVELS[i].birds).toBeGreaterThan(LEVELS[i - 1].birds);
      expect(LEVELS[i].timeLimit).toBeGreaterThan(LEVELS[i - 1].timeLimit);
    }
  });

  it("흩어짐 허용은 줄어든다", () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      expect(LEVELS[i].scatterLimit).toBeLessThan(LEVELS[i - 1].scatterLimit);
    }
  });

  it("id 로 레벨을 찾는다", () => {
    expect(levelById("finale").id).toBe("finale");
    expect(levelById("없는 레벨").id).toBe(LEVELS[0].id);
  });
});

describe("판정", () => {
  const level = LEVELS[0];

  it("모든 링을 통과하면 클리어다", () => {
    const result = evaluateFlock({ gatesPassed: level.gates, gatesTotal: level.gates, timeLeft: 20, spread: 4 }, level);
    expect(result.cleared).toBe(true);
    expect(result.stars).toBe(3);
  });

  it("흩어지면 별이 줄어든다", () => {
    const spread = level.scatterLimit * 1.3;
    expect(evaluateFlock({ gatesPassed: level.gates, gatesTotal: level.gates, timeLeft: 20, spread }, level).stars).toBe(2);
    const wide = level.scatterLimit * 2;
    expect(evaluateFlock({ gatesPassed: level.gates, gatesTotal: level.gates, timeLeft: 20, spread: wide }, level).stars).toBe(1);
  });

  it("링을 다 못 통과하면 실패다", () => {
    const result = evaluateFlock({ gatesPassed: level.gates - 1, gatesTotal: level.gates, timeLeft: 20, spread: 1 }, level);
    expect(result.cleared).toBe(false);
    expect(result.stars).toBe(0);
  });

  it("점수는 통과한 링과 남은 시간에 따라 오른다", () => {
    const more = scoreForFlock({ gatesPassed: 3, timeLeft: 30, spread: 2 }, level);
    const less = scoreForFlock({ gatesPassed: 1, timeLeft: 5, spread: 2 }, level);
    expect(more).toBeGreaterThan(less);
  });

  it("흩어지면 점수가 깎인다", () => {
    const tight = scoreForFlock({ gatesPassed: 3, timeLeft: 20, spread: 2 }, level);
    const loose = scoreForFlock({ gatesPassed: 3, timeLeft: 20, spread: 30 }, level);
    expect(tight).toBeGreaterThan(loose);
  });
});

describe("난수와 산포", () => {
  it("같은 시드는 같은 수열을 낸다", () => {
    const a = createRandom(5);
    const b = createRandom(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("산포한 무리는 경기장 안에 있다", () => {
    const birds = scatterFlock(50, 12);
    expect(birds).toHaveLength(50);
    for (const b of birds) {
      expect(Math.abs(b.position.x)).toBeLessThanOrEqual(ARENA.halfX);
      expect(Math.abs(b.position.z)).toBeLessThanOrEqual(ARENA.halfZ);
    }
  });
});
