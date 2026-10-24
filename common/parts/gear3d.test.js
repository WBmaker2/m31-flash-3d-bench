import { describe, expect, it } from "vitest";
import {
  GEAR_SIZES,
  INPUT_REV_PER_SEC,
  MESH_TOLERANCE,
  PHASE_TOLERANCE,
  RADIUS_PER_TOOTH,
  SPEED_TOLERANCE,
  TOOTH_MODULE,
  buildMeshGraph,
  canPlaceAt,
  crankAngle,
  gearAngles,
  gearDiameter,
  gearRadius,
  gearRatio,
  isMeshing,
  meshAlignment,
  meshingPairs,
  meshDistance,
  overlappingPairs,
  overlaps,
  modDistance,
  normalizeAngle,
  phaseOffsets,
  phaseValue,
  propagateRotation,
  slotDistance,
} from "./gear3d.js";

function gear(id, teeth, x, z) {
  return { id, teeth, x, z };
}

const CRANK = gear("c", 12, 0, 0);

describe("톱니바퀴 반지름", () => {
  it("모듈은 0.02 m 다", () => {
    expect(TOOTH_MODULE).toBe(0.02);
    expect(RADIUS_PER_TOOTH).toBe(0.01);
  });

  it("반지름은 톱니 수에 비례한다", () => {
    expect(gearRadius(8)).toBeCloseTo(0.08, 12);
    expect(gearRadius(12)).toBeCloseTo(0.12, 12);
    expect(gearRadius(16)).toBeCloseTo(0.16, 12);
    expect(gearRadius(20)).toBeCloseTo(0.2, 12);
    expect(gearRadius(24)).toBeCloseTo(0.24, 12);
  });

  it("지름은 반지름의 두 배다", () => {
    expect(gearDiameter(16)).toBeCloseTo(0.32, 12);
  });

  it("크기 종류는 8 12 16 20 24 다", () => {
    expect(GEAR_SIZES).toEqual([8, 12, 16, 20, 24]);
  });
});

describe("기어비", () => {
  it("비율은 톱니 수의 역수 관계다", () => {
    expect(gearRatio(12, 8)).toBeCloseTo(1.5, 12);
    expect(gearRatio(8, 12)).toBeCloseTo(2 / 3, 12);
    expect(gearRatio(24, 8)).toBeCloseTo(3, 12);
  });

  it("비율과 그 역수를 곱하면 1 이다", () => {
    for (const from of GEAR_SIZES) {
      for (const to of GEAR_SIZES) {
        expect(gearRatio(from, to) * gearRatio(to, from)).toBeCloseTo(1, 12);
      }
    }
  });
});

describe("메시 판정", () => {
  const a = gear("a", 8, 0, 0);
  const b = gear("b", 12, 0.2, 0);

  it("메시 거리는 두 반지름의 합이다", () => {
    expect(meshDistance(8, 12)).toBeCloseTo(0.2, 12);
    expect(slotDistance(a, b)).toBeCloseTo(0.2, 12);
  });

  it("거리가 합과 같으면 맞물린다", () => {
    expect(isMeshing(a, b, 8, 12)).toBe(true);
  });

  it("허용 오차 밖이면 맞물리지 않는다", () => {
    const near = gear("b", 12, 0.2 + MESH_TOLERANCE * 10, 0);
    expect(isMeshing(a, near, 8, 12)).toBe(false);
    const far = gear("b", 12, 0.2 + 1e-3, 0);
    expect(isMeshing(a, far, 8, 12)).toBe(false);
  });

  it("겹치는 판정은 맞물림과 반대다", () => {
    const close = gear("b", 12, 0.19, 0);
    expect(overlaps(a, close, 8, 12)).toBe(true);
    expect(overlaps(a, b, 8, 12)).toBe(false);
  });
});

describe("메시 그래프", () => {
  it("맞물리는 쌍만 간선으로 잇는다", () => {
    const nodes = [CRANK, gear("s1", 8, 0.2, 0), gear("far", 12, 0.8, 0)];
    const graph = buildMeshGraph(nodes);
    expect(graph.get("c")).toEqual(["s1"]);
    expect(graph.get("s1")).toEqual(["c"]);
    expect(graph.get("far")).toEqual([]);
  });

  it("맞물리는 쌍 목록도 같다", () => {
    const nodes = [CRANK, gear("s1", 8, 0.2, 0)];
    const pairs = meshingPairs(nodes);
    expect(pairs).toHaveLength(1);
    expect(pairs[0][0].id).toBe("c");
    expect(pairs[0][1].id).toBe("s1");
  });
});

describe("회전 전파", () => {
  it("한 단 맞물리면 방향이 반대다", () => {
    const nodes = [CRANK, gear("s1", 8, 0.2, 0)];
    const { ratio, omega } = propagateRotation({ nodes, inputId: "c" });
    expect(ratio.get("s1")).toBeCloseTo(-1.5, 12);
    expect(omega.get("s1")).toBeCloseTo(-1.5 * INPUT_REV_PER_SEC, 12);
  });

  it("속도는 톱니 수의 역비만큼 달라진다", () => {
    const nodes = [CRANK, gear("s1", 8, 0.2, 0)];
    const { omega } = propagateRotation({ nodes, inputId: "c" });
    expect(Math.abs(omega.get("s1"))).toBeCloseTo(
      Math.abs(omega.get("c")) * gearRatio(12, 8),
      12,
    );
  });

  it("두 단 연결하면 방향이 같고 비율은 곱해진다", () => {
    const nodes = [CRANK, gear("s1", 8, 0.2, 0), gear("s2", 16, 0.44, 0)];
    const { ratio, omega } = propagateRotation({ nodes, inputId: "c" });
    expect(ratio.get("s1")).toBeCloseTo(-1.5, 12);
    expect(ratio.get("s2")).toBeCloseTo(0.75, 12);
    expect(omega.get("s2")).toBeCloseTo(0.75 * INPUT_REV_PER_SEC, 12);
  });

  it("크랭크와 연결되지 않은 톱니는 멈춰 있다", () => {
    const nodes = [CRANK, gear("s1", 8, 0.2, 0), gear("idle", 16, 0.9, 0.3)];
    const { ratio, omega } = propagateRotation({ nodes, inputId: "c" });
    expect(ratio.get("idle")).toBe(0);
    expect(omega.get("idle")).toBe(0);
  });

  it("홀수 개의 고리는 모순으로 탐지된다", () => {
    const nodes = [
      gear("a", 12, 0, 0),
      gear("b", 12, 0.24, 0),
      gear("c", 12, 0.12, 0.2078460969),
    ];
    const { conflicts } = propagateRotation({ nodes, inputId: "a" });
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it("짝수 개의 고리는 모순이 없다", () => {
    const nodes = [
      gear("a", 12, 0, 0),
      gear("b", 12, 0.24, 0),
      gear("c", 12, 0.24, 0.24),
      gear("d", 12, 0, 0.24),
    ];
    const { conflicts, ratio } = propagateRotation({ nodes, inputId: "a" });
    expect(conflicts).toHaveLength(0);
    expect(ratio.get("c")).toBeCloseTo(1, 12);
  });

  it("고리 밖의 톱니는 영향을 받지 않는다", () => {
    const nodes = [
      gear("a", 12, 0, 0),
      gear("b", 12, 0.24, 0),
      gear("c", 12, 0.12, 0.2078460969),
      gear("far", 20, 1.2, 1.2),
    ];
    const { omega } = propagateRotation({ nodes, inputId: "a" });
    expect(omega.get("far")).toBe(0);
  });
});

describe("회전 위상", () => {
  const nodes = [CRANK, gear("s1", 8, 0.2, 0), gear("s2", 16, 0.44, 0)];

  it("크랭크 각도는 각속도 × 시간이다", () => {
    expect(crankAngle(INPUT_REV_PER_SEC, 3)).toBeCloseTo(Math.PI * 6, 12);
  });

  it("시간이 지나도 맞물린 쌍의 위상량이 일정하다", () => {
    const { ratio, graph } = propagateRotation({ nodes, inputId: "c" });
    const offsets = phaseOffsets(nodes, graph, "c");
    const first = gearAngles(ratio, INPUT_REV_PER_SEC, 0, offsets);
    const later = gearAngles(ratio, INPUT_REV_PER_SEC, 3, offsets);
    for (const [a, b] of meshingPairs(nodes)) {
      const before = phaseValue(first.get(a.id), a.teeth, first.get(b.id), b.teeth);
      const after = phaseValue(later.get(a.id), a.teeth, later.get(b.id), b.teeth);
      expect(Math.abs(after - before)).toBeLessThan(PHASE_TOLERANCE);
    }
  });

  it("위상 오프셋은 톱니가 접촉선 위에 오게 한다", () => {
    const { graph } = propagateRotation({ nodes, inputId: "c" });
    const offsets = phaseOffsets(nodes, graph, "c");
    for (const [a, b] of meshingPairs(nodes)) {
      const psi = Math.atan2(b.z - a.z, b.x - a.x);
      const alignment = meshAlignment({
        a,
        b,
        psi,
        thetaA: offsets.get(a.id),
        thetaB: offsets.get(b.id),
      });
      expect(alignment.aligned, `${a.id}-${b.id} 톱니와 홈이 마주 보지 않습니다`).toBe(true);
    }
  });

  it("대각선으로 맞물려도 톱니와 홈이 마주 본다", () => {
    const diagonal = [gear("c", 16, 0, 0), gear("n", 8, 0.16, Math.sqrt(0.032))];
    const { graph } = propagateRotation({ nodes: diagonal, inputId: "c" });
    const offsets = phaseOffsets(diagonal, graph, "c");
    for (const [a, b] of meshingPairs(diagonal)) {
      const psi = Math.atan2(b.z - a.z, b.x - a.x);
      const alignment = meshAlignment({
        a,
        b,
        psi,
        thetaA: offsets.get(a.id),
        thetaB: offsets.get(b.id),
      });
      expect(alignment.aligned).toBe(true);
    }
  });

  it("삼각 고리는 톱니 위상이 맞지 않는다", () => {
    const triangle = [
      gear("c", 16, 0, 0),
      gear("n", 8, 0.16, Math.sqrt(0.032)),
      gear("m", 16, 0.32, 0),
    ];
    const { graph, conflicts } = propagateRotation({ nodes: triangle, inputId: "c" });
    expect(conflicts.length).toBeGreaterThan(0);
    const offsets = phaseOffsets(triangle, graph, "c");
    const alignments = meshingPairs(triangle).map(([a, b]) => {
      const psi = Math.atan2(b.z - a.z, b.x - a.x);
      return meshAlignment({
        a,
        b,
        psi,
        thetaA: offsets.get(a.id),
        thetaB: offsets.get(b.id),
      });
    });
    expect(alignments.some((entry) => !entry.aligned)).toBe(true);
  });

  it("오프셋은 0 이상 2π 미만이다", () => {
    const { graph } = propagateRotation({ nodes, inputId: "c" });
    const offsets = phaseOffsets(nodes, graph, "c");
    for (const value of offsets.values()) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(Math.PI * 2);
    }
  });
});

describe("끼우기 규칙", () => {
  const nodes = [CRANK];

  it("겹치지 않으면 끼울 수 있다", () => {
    expect(canPlaceAt(nodes, gear("s1", 8, 0.2, 0), 8)).toBe(true);
  });

  it("겹치면 끼울 수 없다", () => {
    expect(canPlaceAt(nodes, gear("s1", 16, 0.2, 0), 16)).toBe(false);
  });

  it("겹치는 쌍을 찾아낸다", () => {
    const pair = overlappingPairs([CRANK, gear("s1", 16, 0.2, 0)]);
    expect(pair).toHaveLength(1);
    expect(overlappingPairs([CRANK, gear("s1", 8, 0.2, 0)])).toHaveLength(0);
  });
});

describe("판정 상수", () => {
  it("허용 오차와 목표 속도가 정해져 있다", () => {
    expect(MESH_TOLERANCE).toBe(1e-6);
    expect(SPEED_TOLERANCE).toBe(0.01);
    expect(INPUT_REV_PER_SEC).toBe(1);
  });
});
