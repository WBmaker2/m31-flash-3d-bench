import { describe, expect, it } from "vitest";
import {
  BLOCK_HALF_M,
  DEFAULT_STEP_SECONDS,
  GRAVITY_MPS2,
  closestPointOnAabb,
  findUnsupported,
  hitAlongSegment,
  scoreForShot,
  settleDebris,
  simulateFlight,
  sphereIntersectsAabb,
  starsForShots,
  stepProjectile,
} from "./physics.js";
import {
  anglesFromDirection,
  directionFromAngles,
  launchState,
  launchVelocity,
  muzzlePosition,
  predictTrajectory,
} from "./aim.js";
import { blocksBounds, cellBounds, cellCenter, moveOffset } from "./grid.js";
import { LEVELS, targetsOf } from "./levels.js";
import { resolveImpact, resolveOutcome } from "./session.js";

const DT = DEFAULT_STEP_SECONDS;

function box(minX, minY, minZ, maxX, maxY, maxZ) {
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

function runFlight(initial, options = {}) {
  return simulateFlight(initial, {
    dt: DT,
    gravity: GRAVITY_MPS2,
    wind: { x: 0, z: 0 },
    drag: 0,
    maxSteps: 900,
    ...options,
  });
}

function manualPath(initial, options = {}, count = 1) {
  let state = { position: { ...initial.position }, velocity: { ...initial.velocity } };
  const points = [{ ...state.position }];
  for (let i = 0; i < count; i += 1) {
    state = stepProjectile(state, options);
    points.push({ ...state.position });
  }
  return points;
}

describe("탄도 적분", () => {
  it("dt 가 0 이면 상태가 그대로다", () => {
    const state = { position: { x: 1, y: 2, z: 3 }, velocity: { x: 4, y: 5, z: 6 } };
    const next = stepProjectile(state, { dt: 0 });
    expect(next.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(next.velocity).toEqual({ x: 4, y: 5, z: 6 });
  });

  it("초기속도가 0 이고 무중력이면 위치가 그대로다", () => {
    const state = { position: { x: 1, y: 2, z: 3 }, velocity: { x: 0, y: 0, z: 0 } };
    const next = stepProjectile(state, { dt: DT, gravity: 0 });
    expect(next.position).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("중력 없이 수평 발사하면 x = v·t 다", () => {
    let state = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 10, y: 0, z: 0 } };
    for (let i = 0; i < 60; i += 1) state = stepProjectile(state, { dt: DT, gravity: 0 });
    expect(state.position.x).toBeCloseTo(10, 9);
    expect(state.position.y).toBeCloseTo(0, 9);
  });

  it("일정 가속도 적분이 해석해와 오차 1e-9 안에서 같다", () => {
    const p0 = { x: 1, y: 2, z: -4 };
    const v0 = { x: 3, y: 10, z: 7 };
    let state = { position: { ...p0 }, velocity: { ...v0 } };
    const steps = 120;
    for (let i = 0; i < steps; i += 1) state = stepProjectile(state, { dt: DT });

    const t = steps * DT;
    expect(state.position.x).toBeCloseTo(p0.x + v0.x * t, 7);
    expect(state.position.y).toBeCloseTo(p0.y + v0.y * t - 0.5 * GRAVITY_MPS2 * t * t, 7);
    expect(state.position.z).toBeCloseTo(p0.z + v0.z * t, 7);
  });

  it("에너지가 보존된다 (v²/2 + g·y)", () => {
    const energy = (state) =>
      0.5 *
      (state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2) +
      GRAVITY_MPS2 * state.position.y;

    let state = { position: { x: 0, y: 10, z: 0 }, velocity: { x: 5, y: 4, z: -2 } };
    const before = energy(state);
    for (let i = 0; i < 240; i += 1) state = stepProjectile(state, { dt: DT });
    expect(energy(state)).toBeCloseTo(before, 6);
  });

  it("바람 가속이 z 성분에 일정하게 쌓인다", () => {
    let state = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    const steps = 60;
    for (let i = 0; i < steps; i += 1) {
      state = stepProjectile(state, { dt: DT, gravity: 0, wind: { x: 0, z: 2 } });
    }
    const t = steps * DT;
    expect(state.position.z).toBeCloseTo(0.5 * 2 * t * t, 7);
  });

  it("드래그가 없으면 수평 속도가 유지된다", () => {
    let state = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 6, y: 0, z: -3 } };
    for (let i = 0; i < 120; i += 1) state = stepProjectile(state, { dt: DT });
    expect(state.velocity.x).toBeCloseTo(6, 9);
    expect(state.velocity.z).toBeCloseTo(-3, 9);
  });

  it("드래그가 있으면 속도가 줄어든다", () => {
    let state = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 10, y: 0, z: 0 } };
    for (let i = 0; i < 60; i += 1) {
      state = stepProjectile(state, { dt: DT, gravity: 0, drag: 0.5 });
    }
    const speed = Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z);
    expect(speed).toBeLessThan(10);
    expect(speed).toBeGreaterThan(5);
  });

  it("45° 발사의 최대 사거리가 v²/g 다", () => {
    const power = 20;
    const initial = {
      position: { x: 0, y: 0, z: 0 },
      velocity: launchVelocity({ yawDeg: 0, pitchDeg: 45, power }),
    };
    const { points } = runFlight(initial, { radius: 0 });

    let range = null;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      if (b.y <= 0 && a.y > 0) {
        const t = a.y / (a.y - b.y);
        range = a.z + (b.z - a.z) * t;
        break;
      }
    }
    expect(range).not.toBeNull();
    expect(range).toBeCloseTo((power * power) / GRAVITY_MPS2, 1);
  });

  it("simulateFlight 는 stepProjectile 연쇄와 같다", () => {
    const initial = { position: { x: 0, y: 1.6, z: 0 }, velocity: { x: 1, y: 10, z: 5 } };
    const { points } = runFlight(initial);
    const manual = manualPath(initial, { dt: DT, gravity: GRAVITY_MPS2 }, points.length - 1);

    expect(manual.length).toBe(points.length);
    for (let i = 0; i < points.length; i += 1) {
      expect(points[i].x).toBeCloseTo(manual[i].x, 10);
      expect(points[i].y).toBeCloseTo(manual[i].y, 10);
      expect(points[i].z).toBeCloseTo(manual[i].z, 10);
    }
  });

  it("예측 궤적과 실제 비행 경로가 같다", () => {
    const initial = { position: { x: 0, y: 1.6, z: 0 }, velocity: { x: 2, y: 12, z: 9 } };
    const points = predictTrajectory(initial);
    const manual = manualPath(initial, { dt: DT, gravity: GRAVITY_MPS2 }, points.length - 1);

    expect(manual.length).toBe(points.length);
    for (let i = 0; i < points.length; i += 1) {
      expect(points[i].x).toBeCloseTo(manual[i].x, 10);
      expect(points[i].y).toBeCloseTo(manual[i].y, 10);
      expect(points[i].z).toBeCloseTo(manual[i].z, 10);
    }
  });

  it("지면에 닿으면 landed 가 된다", () => {
    const initial = { position: { x: 0, y: 1.6, z: 0 }, velocity: { x: 0, y: 4, z: 6 } };
    const result = runFlight(initial);
    expect(result.landed).toBe(true);
    expect(result.state.position.y).toBeLessThanOrEqual(0.18);
  });

  it("표적과 만나지 않으면 hit 은 null 다", () => {
    const initial = { position: { x: 40, y: 1.6, z: 0 }, velocity: { x: 0, y: 6, z: 10 } };
    const result = runFlight(initial, { boxes: [box(0, 0, 0, 2, 2, 2)] });
    expect(result.hit).toBeNull();
  });
});

describe("충돌 판정", () => {
  const target = box(0, 0, 0, 2, 2, 2);

  it("구가 상자 중심에 있으면 충돌한다", () => {
    expect(sphereIntersectsAabb({ x: 1, y: 1, z: 1 }, 0.18, target)).toBe(true);
  });

  it("구가 상자에서 멀면 충돌하지 않는다", () => {
    expect(sphereIntersectsAabb({ x: 5, y: 1, z: 1 }, 0.18, target)).toBe(false);
  });

  it("경계에 닿는 경우도 충돌이다", () => {
    expect(sphereIntersectsAabb({ x: 1, y: 2.18, z: 1 }, 0.18, target)).toBe(true);
    expect(sphereIntersectsAabb({ x: 1, y: 2.2, z: 1 }, 0.18, target)).toBe(false);
  });

  it("closestPointOnAabb 는 경계 안쪽으로 당긴다", () => {
    const closest = closestPointOnAabb({ x: 5, y: -3, z: 1 }, target);
    expect(closest).toEqual({ x: 2, y: 0, z: 1 });
  });

  it("선분이 상자를 통과하면 hit 이 나온다", () => {
    const found = hitAlongSegment({ x: 1, y: 1, z: -5 }, { x: 1, y: 1, z: 5 }, 0.18, [target]);
    expect(found).not.toBeNull();
    expect(found.box).toBe(target);
    expect(found.t).toBeGreaterThan(0);
    expect(found.t).toBeLessThan(1);
  });

  it("선분이 빗나가면 hit 이 없다", () => {
    const found = hitAlongSegment({ x: 9, y: 1, z: -5 }, { x: 9, y: 1, z: 5 }, 0.18, [target]);
    expect(found).toBeNull();
  });

  it("한 스텝에 지나가도 관통하지 않는다", () => {
    const initial = { position: { x: 1, y: 1, z: -3 }, velocity: { x: 0, y: 0, z: 60 } };
    const result = runFlight(initial, { boxes: [target] });
    expect(result.hit).not.toBeNull();
    expect(result.hit.box).toBe(target);
  });

  it("벽에 먼저 닿으면 표적에는 닿지 않는다", () => {
    const wall = { ...box(0, 0, 0, 2, 2, 2), id: "wall", kind: "wall" };
    const crate = { ...box(0, 0, 4, 2, 2, 6), id: "crate", kind: "target" };
    const initial = { position: { x: 1, y: 1, z: -3 }, velocity: { x: 0, y: 0, z: 10 } };
    const result = runFlight(initial, { boxes: [wall, crate] });
    expect(result.hit.box.kind).toBe("wall");
  });
});

describe("지지 검사와 붕괴", () => {
  it("바닥에 있는 블록은 받침이 있다", () => {
    const blocks = [{ id: "a", i: 0, j: 0, k: 3 }];
    expect(findUnsupported(blocks)).toEqual([]);
  });

  it("아래 블록이 받쳐 주면 떨어지지 않는다", () => {
    const blocks = [
      { id: "a", i: 0, j: 0, k: 3 },
      { id: "b", i: 0, j: 1, k: 3 },
    ];
    expect(findUnsupported(blocks)).toEqual([]);
  });

  it("밑블록이 사라지면 위 블록이 무너진다", () => {
    const blocks = [{ id: "b", i: 0, j: 1, k: 3 }];
    expect(findUnsupported(blocks)).toEqual(["b"]);
  });

  it("무너짐은 연쇄된다", () => {
    const blocks = [
      { id: "b", i: 0, j: 1, k: 3 },
      { id: "c", i: 0, j: 2, k: 3 },
    ];
    expect(findUnsupported(blocks)).toEqual(["b", "c"]);
  });

  it("세 층 탑도 끝까지 무너진다", () => {
    const blocks = [
      { id: "b", i: 0, j: 1, k: 3 },
      { id: "c", i: 0, j: 2, k: 3 },
      { id: "d", i: 0, j: 3, k: 3 },
    ];
    expect(findUnsupported(blocks)).toEqual(["b", "c", "d"]);
  });

  it("벽도 받침이 된다", () => {
    const blocks = [
      { id: "wall", i: 0, j: 0, k: 3, kind: "wall" },
      { id: "target", i: 0, j: 1, k: 3, kind: "target" },
    ];
    expect(findUnsupported(blocks)).toEqual([]);
  });

  it("움직이는 표적은 떨어지지 않는다", () => {
    const blocks = [{ id: "m", i: 0, j: 1, k: 3, floating: true }];
    expect(findUnsupported(blocks)).toEqual([]);
  });

  it("움직이는 표적은 받침이 없어도 떨어지지 않는다", () => {
    const blocks = [{ id: "m", i: 0, j: 1, k: 3, move: { axis: "x", amplitude: 2, period: 5 } }];
    expect(findUnsupported(blocks)).toEqual([]);
  });
});

describe("낙하 잔해", () => {
  it("바닥에 닿으면 y = 1 에서 멈춘다", () => {
    let body = { position: { x: 0, y: 5, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    for (let i = 0; i < 600; i += 1) body = settleDebris(body, DT);
    expect(body.position.y).toBeCloseTo(BLOCK_HALF_M, 9);
    expect(body.velocity.y).toBe(0);
    expect(body.grounded).toBe(true);
  });

  it("지면 아래로 내려가지 않는다", () => {
    let body = { position: { x: 0, y: 4, z: 0 }, velocity: { x: 0, y: -20, z: 0 } };
    for (let i = 0; i < 120; i += 1) {
      body = settleDebris(body, DT);
      expect(body.position.y).toBeGreaterThanOrEqual(BLOCK_HALF_M);
    }
  });

  it("착지하면 마찰로 미끄러짐이 줄어든다", () => {
    let body = { position: { x: 0, y: 0.9, z: 0 }, velocity: { x: 4, y: 0, z: 0 } };
    body = settleDebris(body, DT);
    expect(body.velocity.x).toBeLessThan(4);
    expect(body.velocity.x).toBeGreaterThanOrEqual(0);
  });
});

describe("조준 변환", () => {
  it("yaw 0 / pitch 0 은 +Z 다", () => {
    const direction = directionFromAngles(0, 0);
    expect(direction.x).toBeCloseTo(0, 12);
    expect(direction.y).toBeCloseTo(0, 12);
    expect(direction.z).toBeCloseTo(1, 12);
  });

  it("yaw 90° 는 +X 다", () => {
    const direction = directionFromAngles(90, 0);
    expect(direction.x).toBeCloseTo(1, 12);
    expect(direction.z).toBeCloseTo(0, 12);
  });

  it("pitch 90° 는 +Y 다", () => {
    const direction = directionFromAngles(0, 90);
    expect(direction.y).toBeCloseTo(1, 12);
    expect(direction.x).toBeCloseTo(0, 12);
    expect(direction.z).toBeCloseTo(0, 12);
  });

  it("각도 → 방향 → 각도 왕복이 같다", () => {
    for (const yawDeg of [-40, -11, 0, 18, 45]) {
      for (const pitchDeg of [5, 18, 30, 45, 80]) {
        const angles = anglesFromDirection(directionFromAngles(yawDeg, pitchDeg));
        expect(angles.yawDeg).toBeCloseTo(yawDeg, 9);
        expect(angles.pitchDeg).toBeCloseTo(pitchDeg, 9);
      }
    }
  });

  it("발사 속력은 파워와 같다", () => {
    const velocity = launchVelocity({ yawDeg: 20, pitchDeg: 35, power: 17 });
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(17, 9);
  });

  it("발사 위치는 발사구 높이다", () => {
    expect(launchState({ yawDeg: 0, pitchDeg: 30, power: 11 }).position).toEqual(muzzlePosition());
    expect(muzzlePosition().y).toBeCloseTo(1.6, 9);
  });
});

describe("격자 변환", () => {
  it("칸 중심은 2 m 격자 위에 있다", () => {
    const center = cellCenter({ i: 1, j: 2, k: 5 });
    expect(center.x).toBe(2);
    expect(center.y).toBe(5);
    expect(center.z).toBe(10);
  });

  it("가장 아래 칸은 지면에 닿는다", () => {
    const bounds = cellBounds({ i: 0, j: 0, k: 5 });
    expect(bounds.min.y).toBe(0);
    expect(bounds.max.y).toBe(2);
  });

  it("이동 블록은 시각에 따라 좌우로 움직인다", () => {
    const block = { move: { axis: "x", amplitude: 2.5, period: 6 } };
    expect(moveOffset(block, 0).x).toBeCloseTo(0, 9);
    expect(moveOffset(block, 1.5).x).toBeCloseTo(2.5, 6);
    expect(moveOffset(block, 4.5).x).toBeCloseTo(-2.5, 6);
  });
});

describe("레벨 데이터", () => {
  it("레벨 id 가 유일하다", () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모든 레벨의 샷 수가 표적 수 이상이다", () => {
    for (const level of LEVELS) {
      expect(level.shots).toBeGreaterThanOrEqual(targetsOf(level).length);
    }
  });

  it("모든 레벨의 par 이 샷 수를 넘지 않는다", () => {
    for (const level of LEVELS) {
      expect(level.par).toBeLessThanOrEqual(level.shots);
      expect(level.par).toBeGreaterThanOrEqual(1);
    }
  });

  it("블록 좌표는 유한 정수다", () => {
    for (const level of LEVELS) {
      for (const block of level.blocks) {
        for (const key of ["i", "j", "k"]) {
          expect(Number.isInteger(block[key])).toBe(true);
        }
        expect(block.j).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("기본 조준이 허용 범위 안이다", () => {
    for (const level of LEVELS) {
      const aim = level.defaultAim;
      expect(aim.yawDeg).toBeGreaterThanOrEqual(-45);
      expect(aim.yawDeg).toBeLessThanOrEqual(45);
      expect(aim.pitchDeg).toBeGreaterThanOrEqual(5);
      expect(aim.pitchDeg).toBeLessThanOrEqual(80);
      expect(aim.power).toBeGreaterThanOrEqual(6);
      expect(aim.power).toBeLessThanOrEqual(30);
    }
  });

  it("레벨마다 해법이 존재한다 (해법으로 표적을 맞힌다)", () => {
    const failed = [];
    for (const level of LEVELS) {
      const initial = launchState(level.solution);
      const result = runFlight(initial, {
        wind: level.wind,
        drag: level.drag,
        boxes: (time) => blocksBounds(level.blocks, time),
      });
      const hitTarget = result.hit && result.hit.box.kind === "target";
      if (!hitTarget) {
        failed.push(`${level.id}: ${result.hit ? result.hit.box.kind : "아예 안 맞음"}`);
      }
    }
    expect(failed).toEqual([]);
  });
});

describe("레벨 진행 규칙", () => {
  const blocks = [
    { id: "base", i: 0, j: 0, k: 6, kind: "target" },
    { id: "mid", i: 0, j: 1, k: 6, kind: "target" },
    { id: "top", i: 0, j: 2, k: 6, kind: "target" },
    { id: "wall", i: 1, j: 0, k: 6, kind: "wall" },
  ];

  it("명중한 표적과 연쇄 붕괴 대상을 함께 계산한다", () => {
    const result = resolveImpact(blocks, "base");
    expect(result.destroyed.id).toBe("base");
    expect(result.falling.map((block) => block.id)).toEqual(["mid", "top"]);
    expect(result.remaining.map((block) => block.id)).toEqual(["wall"]);
  });

  it("벽에 맞으면 아무것도 사라지지 않는다", () => {
    const result = resolveImpact(blocks, "wall");
    expect(result.destroyed).toBeNull();
    expect(result.remaining).toHaveLength(blocks.length);
  });

  it("없는 블록을 맞혀도 상태가 흔들리지 않는다", () => {
    const result = resolveImpact(blocks, "none");
    expect(result.destroyed).toBeNull();
    expect(result.remaining).toHaveLength(blocks.length);
  });

  it("표적을 다 없애면 클리어다", () => {
    expect(resolveOutcome({ targetsLeft: 0, shotsUsed: 3, shotsLimit: 5 })).toBe("won");
  });

  it("샷을 다 쓰면 실패다", () => {
    expect(resolveOutcome({ targetsLeft: 1, shotsUsed: 5, shotsLimit: 5 })).toBe("lost");
  });

  it("아직 진행 중이면 계속한다", () => {
    expect(resolveOutcome({ targetsLeft: 1, shotsUsed: 2, shotsLimit: 5 })).toBe("continue");
  });
});

describe("점수와 별점", () => {
  it("별점 경계가 맞다", () => {
    expect(starsForShots(0, 2)).toBe(0);
    expect(starsForShots(1, 2)).toBe(3);
    expect(starsForShots(2, 2)).toBe(3);
    expect(starsForShots(3, 2)).toBe(2);
    expect(starsForShots(4, 2)).toBe(1);
  });

  it("점수는 맞힌 수와 남은 샷으로 계산한다", () => {
    expect(scoreForShot({ hitTargets: 2, toppledTargets: 1, shotsLeft: 2 })).toBe(360);
    expect(scoreForShot({})).toBe(0);
  });
});
