import { describe, expect, it } from "vitest";
import {
  BOUNDS,
  PLAYER_KINDS,
  PLAYER_OPS,
  TARGET_KINDS,
  TARGET_OPS,
  combine,
  makeSdf,
  marchRay,
  maskIou,
  sdBox,
  sdCapsule,
  sdEllipsoid,
  sdRoundBox,
  sdSphere,
  sdTorus,
  shapeSdf,
  silhouette,
  silhouetteIou,
  smoothMin,
} from "./sdf.js";
import { edgeCounts, extractSurface, signedVolume } from "./mesh.js";
import { LEVELS, evaluateSculpt, levelById, levelPar, scoreForSculpt } from "./levels.js";

function sphere(x, y, z, r, op = "union", extra = {}) {
  return { kind: "sphere", op, position: { x, y, z }, rotationY: 0, params: { r, ...extra } };
}

function capsule(x, y, z, r, h, op = "union", extra = {}) {
  return { kind: "capsule", op, position: { x, y, z }, rotationY: 0, params: { r, h, ...extra } };
}

function torus(x, y, z, R, r, op = "union", extra = {}) {
  return { kind: "torus", op, position: { x, y, z }, rotationY: 0, params: { R, r, ...extra } };
}

const SPHERE_UNIT = sphere(0, 0, 0, 1);

describe("기본형 SDF", () => {
  it("구 중심에서 0이다", () => {
    expect(sdSphere({ x: 0, y: 0, z: 0 }, { r: 1 })).toBeCloseTo(-1, 12);
  });

  it("구 표면에서 0이다", () => {
    expect(sdSphere({ x: 1, y: 0, z: 0 }, { r: 1 })).toBeCloseTo(0, 12);
  });

  it("구 바깥 거리는 |p| - r 이다", () => {
    expect(sdSphere({ x: 3, y: 0, z: 0 }, { r: 1 })).toBeCloseTo(2, 12);
  });

  it("구 안쪽은 음수다", () => {
    expect(sdSphere({ x: 0.5, y: 0, z: 0 }, { r: 1 })).toBeLessThan(0);
  });

  it("박스 안쪽은 음수이고 면 위에서는 0이다", () => {
    expect(sdBox({ x: 0, y: 0, z: 0 }, { hx: 1, hy: 1, hz: 1 })).toBeCloseTo(-1, 12);
    expect(sdBox({ x: 1, y: 0, z: 0 }, { hx: 1, hy: 1, hz: 1 })).toBeCloseTo(0, 12);
  });

  it("박스 모서리 거리는 정확하다", () => {
    expect(sdBox({ x: 2, y: 0, z: 0 }, { hx: 1, hy: 1, hz: 1 })).toBeCloseTo(1, 12);
  });

  it("토러스 관절(구멍 안쪽)은 양수다", () => {
    expect(sdTorus({ x: 0, y: 0, z: 0 }, { R: 1, r: 0.3 })).toBeCloseTo(0.7, 12);
  });

  it("토러스 튜브 안쪽은 음수다", () => {
    expect(sdTorus({ x: 1, y: 0, z: 0 }, { R: 1, r: 0.3 })).toBeCloseTo(-0.3, 12);
  });

  it("토러스 튜브 표면은 0이다", () => {
    expect(sdTorus({ x: 1.3, y: 0, z: 0 }, { R: 1, r: 0.3 })).toBeCloseTo(0, 12);
  });

  it("캡슐 끝은 둥글고 가운데는 직선이다", () => {
    // 캡슐의 반원 끝은 y = h/2 + r 에 있다.
    expect(sdCapsule({ x: 0, y: 0.75, z: 0 }, { r: 0.25, h: 1 })).toBeCloseTo(0, 12);
    expect(sdCapsule({ x: 0.3, y: 0, z: 0 }, { r: 0.25, h: 1 })).toBeCloseTo(0.05, 12);
  });

  it("라운드 박스는 모서리가 둥글다", () => {
    const corner = sdRoundBox({ x: 0.8, y: 0.8, z: 0.8 }, { hx: 1, hy: 1, hz: 1, round: 0.2 });
    const plain = sdBox({ x: 0.8, y: 0.8, z: 0.8 }, { hx: 1, hy: 1, hz: 1 });
    expect(corner).toBeLessThan(plain);
  });

  it("타원체는 축 위에서 정확하다", () => {
    expect(sdEllipsoid({ x: 0.5, y: 0, z: 0 }, { rx: 0.5, ry: 1, rz: 0.5 })).toBeCloseTo(0, 12);
  });

  it("타원체 중심에서 0이 아니다(음수)", () => {
    expect(sdEllipsoid({ x: 0, y: 0, z: 0 }, { rx: 0.5, ry: 1, rz: 0.5 })).toBeLessThan(0);
  });
});

describe("CSG 결합", () => {
  it("합집합은 min 이다", () => {
    expect(combine(-2, 3, "union")).toBe(-2);
    expect(combine(2, -3, "union")).toBe(-3);
  });

  it("교집합은 max 이다", () => {
    expect(combine(-2, 3, "intersect")).toBe(3);
    expect(combine(2, -3, "intersect")).toBe(2);
  });

  it("차집합은 max(a, -b) 이다", () => {
    expect(combine(-2, 3, "subtract")).toBe(-2);
    expect(combine(2, -3, "subtract")).toBe(3);
  });

  it("매끈한 합은 컴볼루션보다 작다", () => {
    expect(smoothMin(0, 0, 0.5)).toBeLessThan(0);
    expect(smoothMin(0, 0, 0.5)).toBeCloseTo(-0.125, 12);
  });

  it("연산 순서가 결과를 바꾼다", () => {
    const a = sphere(0, 0, 0, 1);
    const b = sphere(1.5, 0, 0, 1);
    const cutThenAdd = makeSdf([a, { ...b, op: "subtract" }, { ...sphere(1.5, 0, 0, 1), op: "union" }]);
    const addThenCut = makeSdf([a, { ...b, op: "union" }, { ...sphere(1.5, 0, 0, 1), op: "subtract" }]);
    expect(shapeSdf([a, { ...b, op: "subtract" }], { x: 1.5, y: 0, z: 0 })).toBeGreaterThan(0);
    expect(cutThenAdd({ x: 1.5, y: 0, z: 0 })).toBeLessThan(0);
    expect(addThenCut({ x: 1.5, y: 0, z: 0 })).toBeGreaterThan(0);
  });

  it("부품이 없으면 아무것도 없는 형태다", () => {
    expect(shapeSdf([], { x: 0, y: 0, z: 0 })).toBeGreaterThan(100);
  });
});

describe("레이마칭", () => {
  const sdf = makeSdf([sphere(0, 0, 0, 1)]);

  it("정면으로 쏘면 표면에서 멈춘다", () => {
    const result = marchRay({ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: -1 }, sdf);
    expect(result.hit).toBe(true);
    expect(result.t).toBeCloseTo(2, 2);
  });

  it("빗나가면 히트하지 않는다", () => {
    const result = marchRay({ x: 5, y: 5, z: 3 }, { x: 0, y: 0, z: -1 }, sdf);
    expect(result.hit).toBe(false);
  });

  it("같은 입력은 같은 결과를 낸다", () => {
    const a = marchRay({ x: 0.2, y: 0.1, z: 3 }, { x: 0, y: 0, z: -1 }, sdf);
    const b = marchRay({ x: 0.2, y: 0.1, z: 3 }, { x: 0, y: 0, z: -1 }, sdf);
    expect(a).toEqual(b);
  });

  it("안쪽에서 시작하면 즉시 히트다", () => {
    const result = marchRay({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, sdf);
    expect(result.hit).toBe(true);
    expect(result.t).toBe(0);
  });
});

describe("실루엣 IoU", () => {
  it("같은 형태는 1 이다", () => {
    const sdf = makeSdf([sphere(0, 0, 0, 1)]);
    expect(silhouetteIou(sdf, sdf)).toBeCloseTo(1, 6);
  });

  it("겹치지 않는 형태는 0 이다", () => {
    // 두 시점에서 모두 어긋나야 한다. x 만 벌리면 옆시점에서는 겹쳐 보인다.
    const a = makeSdf([sphere(-1.2, 0, -1.2, 0.4)]);
    const b = makeSdf([sphere(1.2, 0, 1.2, 0.4)]);
    expect(silhouetteIou(a, b)).toBe(0);
  });

  it("대칭이다", () => {
    const a = makeSdf([sphere(0, 0, 0, 1)]);
    const b = makeSdf([sphere(0.3, 0.1, 0, 0.8)]);
    expect(silhouetteIou(a, b)).toBeCloseTo(silhouetteIou(b, a), 12);
  });

  it("비슷할수록 값이 커진다", () => {
    const target = makeSdf([sphere(0, 0, 0, 1)]);
    const near = silhouetteIou(makeSdf([sphere(0.05, 0, 0, 1)]), target);
    const far = silhouetteIou(makeSdf([sphere(0.4, 0, 0, 1)]), target);
    expect(near).toBeGreaterThan(far);
  });

  it("마스크 IoU 는 0~1 사이다", () => {
    const left = silhouette(makeSdf([sphere(0, 0, 0, 1)]), { id: "front", forward: { x: 0, y: 0, z: -1 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } });
    expect(maskIou(left.mask, left.mask)).toBeCloseTo(1, 12);
    expect(maskIou(left.mask, new Uint8Array(left.mask.length))).toBe(0);
  });
});

describe("메시 추출", () => {
  it("꼭짓점과 삼각형이 생긴다", () => {
    const mesh = extractSurface(makeSdf([sphere(0, 0, 0, 0.9)]), { resolution: 24 });
    expect(mesh.positions.length / 3).toBeGreaterThan(100);
    expect(mesh.triangles).toBeGreaterThan(100);
  });

  it("모든 간선이 정확히 두 번 쓰인다(맨폴드)", () => {
    const mesh = extractSurface(makeSdf([sphere(0, 0, 0, 0.9)]), { resolution: 24 });
    const counts = edgeCounts(mesh.indices);
    let broken = 0;
    for (const count of counts.values()) if (count !== 2) broken += 1;
    expect(broken).toBe(0);
  });

  it("부호 체적이 양수다(방향이 바깥쪽)", () => {
    const mesh = extractSurface(makeSdf([sphere(0, 0, 0, 0.9)]), { resolution: 24 });
    expect(mesh.volume).toBeGreaterThan(0);
  });

  it("꼭짓점은 표면 위에 있다", () => {
    const sdf = makeSdf([sphere(0, 0, 0, 0.9)]);
    const mesh = extractSurface(sdf, { resolution: 24 });
    for (let index = 0; index < mesh.positions.length; index += 3) {
      const distance = sdf({
        x: mesh.positions[index],
        y: mesh.positions[index + 1],
        z: mesh.positions[index + 2],
      });
      expect(Math.abs(distance)).toBeLessThan(0.02);
    }
  });

  it("해석해 부피와 48³ 에서 5% 안에 들면", () => {
    const mesh = extractSurface(makeSdf([sphere(0, 0, 0, 0.9)]), { resolution: 48 });
    const analytic = (4 / 3) * Math.PI * 0.9 ** 3;
    expect(Math.abs(mesh.volume - analytic) / analytic).toBeLessThan(0.05);
  });

  it("해상도가 올라갈수록 부피 오차가 줄어든다", () => {
    const analytic = (4 / 3) * Math.PI * 0.9 ** 3;
    const errors = [24, 32, 48].map((resolution) => {
      const mesh = extractSurface(makeSdf([sphere(0, 0, 0, 0.9)]), { resolution });
      return Math.abs(mesh.volume - analytic) / analytic;
    });
    expect(errors[0]).toBeGreaterThan(errors[1]);
    expect(errors[1]).toBeGreaterThan(errors[2]);
  });

  it("발산정리 공식은 정육면체에서 8 이다", () => {
    const positions = [];
    const indices = [];
    const faces = [
      [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
      [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
      [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]],
      [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
      [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
      [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]],
    ];
    for (const face of faces) {
      const base = positions.length / 3;
      for (const point of face) positions.push(point[0], point[1], point[2]);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    expect(signedVolume(new Float32Array(positions), new Uint32Array(indices))).toBeCloseTo(8, 9);
  });

  it("차집합 형태도 닫힌 메시가 된다", () => {
    const sdf = makeSdf([sphere(0, 0, 0, 1), sphere(0.6, 0.2, 0, 0.6, "subtract")]);
    const mesh = extractSurface(sdf, { resolution: 32 });
    const counts = edgeCounts(mesh.indices);
    let broken = 0;
    for (const count of counts.values()) if (count !== 2) broken += 1;
    expect(broken).toBe(0);
    expect(mesh.volume).toBeGreaterThan(0);
  });
});

describe("레벨", () => {
  it("레벨이 8종 있다", () => {
    expect(LEVELS).toHaveLength(8);
  });

  it("기준 해법은 모든 레벨에서 3성급이다", () => {
    for (const level of LEVELS) {
      const iou = silhouetteIou(makeSdf(level.reference.elements), makeSdf(level.target.elements));
      expect(iou, `${level.id} 기준 해법`).toBeGreaterThanOrEqual(0.94);
    }
  });

  it("기준 해법은 부품 수 제한 안에 있다", () => {
    for (const level of LEVELS) {
      expect(level.reference.elements.length, level.id).toBeLessThanOrEqual(level.maxParts);
    }
  });

  it("레벨 목표값은 기준 해법의 실측값이다", () => {
    for (const level of LEVELS) {
      const measured = silhouetteIou(makeSdf(level.reference.elements), makeSdf(level.target.elements));
      expect(levelPar(level)).toBeCloseTo(measured, 9);
    }
  });

  it("아이디로 레벨을 찾는다", () => {
    expect(levelById("finale").id).toBe("finale");
    expect(levelById("없는 레벨").id).toBe(LEVELS[0].id);
  });

  it("판정은 일치도와 부피를 함께 본다", () => {
    const level = LEVELS[0];
    const good = evaluateSculpt({ iou: 0.95, volumeRatio: 1 }, level);
    expect(good.cleared).toBe(true);
    expect(good.stars).toBe(3);
    const thin = evaluateSculpt({ iou: 0.95, volumeRatio: 0.4 }, level);
    expect(thin.cleared).toBe(false);
    expect(thin.stars).toBe(3);
    const miss = evaluateSculpt({ iou: 0.4, volumeRatio: 1 }, level);
    expect(miss.cleared).toBe(false);
    expect(miss.stars).toBe(0);
  });

  it("점수는 일치도가 높을수록 크다", () => {
    const near = scoreForSculpt({ iou: 0.95, volumeRatio: 1 });
    const far = scoreForSculpt({ iou: 0.5, volumeRatio: 1 });
    expect(near).toBeGreaterThan(far);
  });

  it("모든 연산과 기본형이 레벨에 등장한다", () => {
    const ops = new Set();
    const kinds = new Set();
    for (const level of LEVELS) {
      for (const element of [...level.target.elements, ...level.reference.elements]) {
        ops.add(element.op);
        kinds.add(element.kind);
      }
    }
    for (const op of PLAYER_OPS) expect(ops.has(op), `연산 ${op}`).toBe(true);
    for (const kind of PLAYER_KINDS) expect(kinds.has(kind), `기본형 ${kind}`).toBe(true);
    // 목표만 쓰는 어휘도 실제로 등장해야 한다.
    for (const kind of TARGET_KINDS) expect(kinds.has(kind), `목표 어휘 ${kind}`).toBe(true);
    for (const op of TARGET_OPS) expect(ops.has(op), `목표 연산 ${op}`).toBe(true);
  });
});

describe("범위", () => {
  it("격자 범위는 [-2, 2] 다", () => {
    expect(BOUNDS).toBe(2);
  });

  it("모든 레벨의 부품이 격자 안에 있다", () => {
    for (const level of LEVELS) {
      for (const element of level.target.elements) {
        for (const axis of ["x", "y", "z"]) {
          expect(Math.abs(element.position[axis])).toBeLessThan(BOUNDS);
        }
      }
    }
  });

  it("캡슐과 토러스도 거리 함수를 낸다", () => {
    expect(sdCapsule({ x: 0, y: 0, z: 0 }, { r: 0.3, h: 1 })).toBeCloseTo(-0.3, 12);
    expect(sdTorus({ x: 0, y: 0, z: 0 }, { R: 1, r: 0.3 })).toBeCloseTo(0.7, 12);
    expect(capsule(0, 0, 0, 0.3, 1).kind).toBe("capsule");
    expect(torus(0, 0, 0, 1, 0.3).kind).toBe("torus");
  });
});
