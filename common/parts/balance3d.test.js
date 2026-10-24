import { describe, expect, it } from "vitest";
import {
  GRAVITY,
  beamAngle,
  centerOfMass,
  evaluateBalance,
  findSolution,
  isLevel,
  minimumWeights,
  momentSum,
} from "./balance3d.js";

const SLOTS = [-0.44, -0.33, -0.22, -0.11, 0, 0.11, 0.22, 0.33, 0.44].map((x, index) => ({ id: `s${index}`, x }));

describe("모멘트", () => {
  it("추 하나의 모멘트는 m·g·팔길이다", () => {
    const { torque } = momentSum([{ slot: "s5", x: 0.11, mass: 2 }], 0);
    expect(torque).toBeCloseTo(2 * GRAVITY * 0.11, 9);
  });

  it("반대편 추는 부호가 반대다", () => {
    const { torque } = momentSum(
      [
        { slot: "s5", x: 0.11, mass: 2 },
        { slot: "s3", x: -0.11, mass: 2 },
      ],
      0,
    );
    expect(torque).toBeCloseTo(0, 12);
  });

  it("무게 합이 나온다", () => {
    const { totalMass } = momentSum(
      [
        { slot: "s1", x: -0.33, mass: 1 },
        { slot: "s5", x: 0.11, mass: 5 },
      ],
      0,
    );
    expect(totalMass).toBeCloseTo(6, 12);
  });

  it("추가 없으면 모멘트도 0 이다", () => {
    const { torque, totalMass } = momentSum([], 0);
    expect(torque).toBe(0);
    expect(totalMass).toBe(0);
  });
});

describe("기울기", () => {
  it("수평이면 기울기가 0 이다", () => {
    const { torque, totalMass } = momentSum(
      [
        { slot: "s3", x: -0.11, mass: 3 },
        { slot: "s5", x: 0.11, mass: 3 },
      ],
      0,
    );
    expect(beamAngle({ torque, totalMass })).toBeCloseTo(0, 12);
  });

  it("무게중심이 받침대 위면 수평이다", () => {
    const weights = [
      { slot: "s3", x: -0.11, mass: 2 },
      { slot: "s5", x: 0.11, mass: 2 },
    ];
    expect(centerOfMass(weights)).toBeCloseTo(0, 12);
    expect(isLevel(weights, 0)).toBe(true);
  });

  it("무게중심이 받침대보다 오른쪽이면 오른쪽으로 기운다", () => {
    const { torque, totalMass } = momentSum([{ slot: "s7", x: 0.33, mass: 3 }], 0);
    expect(beamAngle({ torque, totalMass })).toBeGreaterThan(0);
  });

  it("같은 무게라도 팔 길이가 다르면 기울기가 다르다", () => {
    const near = momentSum([{ slot: "s5", x: 0.11, mass: 3 }], 0);
    const far = momentSum([{ slot: "s7", x: 0.33, mass: 3 }], 0);
    expect(Math.abs(far.torque)).toBeGreaterThan(Math.abs(near.torque));
  });
});

describe("두 조건 미션", () => {
  it("수평이고 무게가 맞아야 통과한다", () => {
    const result = evaluateBalance({
      weights: [
        { slot: "s3", x: -0.11, mass: 1 },
        { slot: "s5", x: 0.11, mass: 1 },
      ],
      fulcrumX: 0,
      targetMass: 2,
    });
    expect(result.cleared).toBe(true);
    expect(result.level).toBe(true);
    expect(result.massOk).toBe(true);
  });

  it("무게가 다르면 통과하지 못한다", () => {
    const result = evaluateBalance({
      weights: [
        { slot: "s3", x: -0.11, mass: 1 },
        { slot: "s5", x: 0.11, mass: 1 },
      ],
      fulcrumX: 0,
      targetMass: 5,
    });
    expect(result.level).toBe(true);
    expect(result.massOk).toBe(false);
    expect(result.cleared).toBe(false);
  });
});

describe("최소 추 개수", () => {
  it("최소 개수를 찾는다", () => {
    const par = minimumWeights({
      slots: SLOTS,
      masses: [1, 2, 3, 5],
      fulcrumX: 0,
      targetMass: 4,
    });
    expect(par).toBe(2);
  });

  it("해 하나를 찾는다", () => {
    const solution = findSolution({
      slots: SLOTS,
      masses: [1, 2, 3, 5],
      fulcrumX: 0,
      targetMass: 4,
    });
    expect(solution).not.toBeNull();
    const weights = solution.map((item) => ({ slot: item.slot, x: SLOTS[item.slot].x, mass: item.mass }));
    const result = evaluateBalance({ weights, fulcrumX: 0, targetMass: 4 });
    expect(result.cleared).toBe(true);
  });
});
