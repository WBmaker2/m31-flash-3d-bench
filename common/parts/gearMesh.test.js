import { describe, expect, it } from "vitest";
import { ADDENDUM, DEDENDUM, createGearGeometry, createGearMesh, gearShape } from "./gearMesh.js";
import { gearRadius } from "./gear3d.js";

describe("톱니바퀴 단면", () => {
  it("톱니마다 점이 5개다", () => {
    expect(gearShape(8).getPoints(1).length).toBe(5 * 8);
    expect(gearShape(24).getPoints(1).length).toBe(5 * 24);
  });

  it("바깥 반지름은 피치 반지름 + 덧높이다", () => {
    const shape = gearShape(12);
    const points = shape.getPoints(1);
    const maxRadius = Math.max(...points.map((point) => point.length()));
    expect(maxRadius).toBeCloseTo(gearRadius(12) + ADDENDUM, 9);
  });

  it("홈은 톱니보다 넓다", () => {
    expect(DEDENDUM).toBeGreaterThan(ADDENDUM * 0.5);
    const shape = gearShape(8);
    const points = shape.getPoints(1);
    const radii = points.map((point) => point.length());
    const minRadius = Math.min(...radii);
    expect(minRadius).toBeCloseTo(Math.max(gearRadius(8) - DEDENDUM, gearRadius(8) * 0.55), 9);
  });

  it("구멍은 축 구멍과 가벼운 구멍이다", () => {
    expect(gearShape(8).holes).toHaveLength(5);
    expect(gearShape(24).holes).toHaveLength(7);
  });
});

describe("톱니바퀴 지오메트리", () => {
  it("꼭짓점이 있다", () => {
    const geometry = createGearGeometry({ teeth: 12 });
    expect(geometry.getAttribute("position").count).toBeGreaterThan(100);
  });

  it("바닥에 눕혀 있다", () => {
    const geometry = createGearGeometry({ teeth: 12, thickness: 0.026 });
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    expect(box.max.y).toBeLessThanOrEqual(0.026);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.026);
  });

  it("크기는 피치 반지름에 덧높이를 더한 값이다", () => {
    for (const teeth of [8, 12, 24]) {
      const geometry = createGearGeometry({ teeth });
      const position = geometry.getAttribute("position");
      let maxRadius = 0;
      for (let i = 0; i < position.count; i += 1) {
        const x = position.getX(i);
        const z = position.getZ(i);
        maxRadius = Math.max(maxRadius, Math.hypot(x, z));
      }
      expect(maxRadius).toBeGreaterThan(gearRadius(teeth) + ADDENDUM);
      expect(maxRadius).toBeLessThan(gearRadius(teeth) + ADDENDUM + 0.005);
    }
  });

  it("피치 반지름은 톱니 수에 비례한다", () => {
    expect(gearRadius(24) / gearRadius(8)).toBeCloseTo(3, 12);
  });

  it("메시로 만들 수 있다", () => {
    const mesh = createGearMesh({ teeth: 16 });
    expect(mesh.geometry.getAttribute("position").count).toBeGreaterThan(100);
    expect(mesh.castShadow).toBe(true);
  });
});
