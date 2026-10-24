import { describe, expect, it } from "vitest";
import {
  FIXED_STEP,
  GRAVITY,
  JUMP_AIR_TIME,
  JUMP_HEIGHT,
  JUMP_REACH,
  JUMP_SPEED,
  MAX_FALL,
  MOVE_SPEED,
  canReach,
  collectCoin,
  createPlayer,
  makePlatform,
  overlapsPlatform,
  simulate,
  stepPlayer,
  sweepDown,
} from "./platform3d.js";

describe("중력 적분", () => {
  it("고정 스텝 60번의 낙하 거리는 누적 합과 같다", () => {
    const start = createPlayer({ x: 0, y: 0 });
    const { player } = simulate(start, { steps: 60, dt: FIXED_STEP, platforms: [] });
    let expected = 0;
    for (let k = 1; k <= 60; k += 1) expected += GRAVITY * k * FIXED_STEP * FIXED_STEP;
    expect(player.y).toBeCloseTo(-expected, 9);
  });

  it("해석해 ½gt² 와 2% 안에서 같다", () => {
    const start = createPlayer({ x: 0, y: 0 });
    const { player } = simulate(start, { steps: 60, dt: FIXED_STEP, platforms: [] });
    const analytic = 0.5 * GRAVITY * (60 * FIXED_STEP) ** 2;
    expect(Math.abs(player.y + analytic) / analytic).toBeLessThan(0.02);
  });

  it("낙하 속도는 한계를 넘지 않는다", () => {
    const start = createPlayer({ x: 0, y: 0 });
    const { player } = simulate(start, { steps: 600, dt: FIXED_STEP, platforms: [] });
    expect(player.vy).toBeGreaterThanOrEqual(-MAX_FALL);
  });
});

describe("점프 궤적", () => {
  it("최고 높이는 v²/2g 다", () => {
    expect(JUMP_HEIGHT).toBeCloseTo((JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY), 12);
  });

  it("비행 시간은 2v/g 다", () => {
    expect(JUMP_AIR_TIME).toBeCloseTo((2 * JUMP_SPEED) / GRAVITY, 12);
  });

  it("도달 거리는 이동 속도 × 비행 시간이다", () => {
    expect(JUMP_REACH).toBeCloseTo(MOVE_SPEED * JUMP_AIR_TIME, 12);
  });

  it("점프하면 위로 올라간다", () => {
    const start = { ...createPlayer({ x: 0, y: 0 }), onGround: true };
    const { player } = stepPlayer(start, { input: { jump: true }, platforms: [] });
    expect(player.vy).toBeGreaterThan(0);
  });
});

describe("스윕 착지", () => {
  const platform = makePlatform(0, 0, 0.9, 0.9);

  it("구름 위에서 멈춘다", () => {
    const start = createPlayer({ x: 0, y: 0.2 });
    const { player } = simulate(start, { steps: 30, dt: FIXED_STEP, platforms: [platform] });
    expect(player.y).toBeCloseTo(0, 9);
    expect(player.vy).toBe(0);
    expect(player.onGround).toBe(true);
  });

  it("스텝이 10배 커도 구름을 뚫지 않는다", () => {
    const start = createPlayer({ x: 0, y: 1.6 });
    const { player } = simulate(start, { steps: 12, dt: FIXED_STEP * 10, platforms: [platform] });
    expect(player.y).toBeCloseTo(0, 9);
    expect(player.onGround).toBe(true);
  });

  it("한 스텝에 크게 떨어져도 구름 위에서 멈춘다", () => {
    const start = createPlayer({ x: 0, y: 6 });
    const { player } = stepPlayer(start, { dt: 1, platforms: [platform] });
    expect(player.y).toBeCloseTo(0, 9);
  });

  it("스텝 크기가 달라도 같은 구름에 선다", () => {
    const start = createPlayer({ x: 0, y: 0.9 });
    const small = simulate(start, { steps: 30, dt: FIXED_STEP, platforms: [platform] });
    const large = simulate(start, { steps: 15, dt: FIXED_STEP * 2, platforms: [platform] });
    expect(small.player.y).toBeCloseTo(large.player.y, 9);
    expect(small.landed).toBeTruthy();
    expect(large.landed).toBeTruthy();
  });

  it("수평으로 벗어나면 떨어진다", () => {
    const start = createPlayer({ x: 3, y: 0.2 });
    const { player } = stepPlayer(start, { dt: FIXED_STEP, platforms: [platform] });
    expect(player.onGround).toBe(false);
    expect(player.y).toBeLessThan(0.2);
  });

  it("경계 위도 구름으로 본다", () => {
    const edge = makePlatform(0, 0, 0.2, 0.9);
    const hit = sweepDown({ fromY: 0.05, toY: -0.05, x: 0.4, z: 0, platforms: [edge] });
    expect(hit).not.toBeNull();
  });

  it("구름 안쪽에 박혀 있지 않다", () => {
    expect(overlapsPlatform({ x: 0, y: -0.2, z: 0, platform })).toBe(true);
    expect(overlapsPlatform({ x: 0, y: 0, z: 0, platform })).toBe(false);
    expect(overlapsPlatform({ x: 3, y: -0.2, z: 0, platform })).toBe(false);
  });
});

describe("동전", () => {
  it("가까이 있으면 모은다", () => {
    const player = createPlayer({ x: 0, y: 0 });
    expect(collectCoin(player, { x: 0, y: 0.2, z: 0 })).toBe(true);
    expect(collectCoin(player, { x: 2, y: 0.2, z: 0 })).toBe(false);
  });
});

describe("도달 가능성", () => {
  it("가까운 구름은 갈 수 있다", () => {
    expect(canReach(makePlatform(0, 0), makePlatform(1.7, 0.5))).toBe(true);
  });

  it("너무 먼 구름은 갈 수 없다", () => {
    expect(canReach(makePlatform(0, 0), makePlatform(JUMP_REACH + 1, 0))).toBe(false);
  });

  it("너무 높은 구름은 갈 수 없다", () => {
    expect(canReach(makePlatform(0, 0), makePlatform(1, JUMP_HEIGHT + 0.5))).toBe(false);
  });
});
