// 부호거리장(SDF) 기본형 · CSG 결합 · 레이마칭 · 실루엣 IoU.
// 순수 계산 모듈이다. three에 묶지 않아 Node에서 그대로 테스트된다.
//
// 표면을 좌표가 아니라 함수로 정의한다. 좌표와 수의 관계를 직접 다루므로
// 단위(길이) 하나만 정하면 모든 값이 그 단위를 따른다.

/** 격자 반경. 이 안의 [-BOUNDS, BOUNDS]³ 공간에서만 계산한다. */
export const BOUNDS = 2;

/** 아무것도 없는 형태의 거리값. 충분히 크면 않으면 최소 연산에서 이 값이 고르게 된다. */
export const FAR = 1e3;

/** 플레이어가 쓸 수 있는 기본형. */
export const PLAYER_KINDS = ["sphere", "box", "torus", "capsule"];

/** 목표 형태는 기본형보다 부자하다. 라운드 박스와 매끈한 합은 목표로만 쓴다. */
export const TARGET_KINDS = [...PLAYER_KINDS, "roundBox", "ellipsoid"];

/** 부피를 조합하는 연산. */
export const PLAYER_OPS = ["union", "intersect", "subtract"];

/** 목표 어휘는 매끈한 합(smooth)까지 넣는다. */
export const TARGET_OPS = [...PLAYER_OPS, "smooth"];

export const OP_LABELS = {
  union: "합집합",
  intersect: "교집합",
  subtract: "차집합",
  smooth: "매끈한 합",
};

export const KIND_LABELS = {
  sphere: "구",
  box: "박스",
  torus: "토러스",
  capsule: "캡슐",
  roundBox: "라운드 박스",
  ellipsoid: "타원체",
};

/** 레이마칭 기본값. */
export const MARCH = {
  maxSteps: 72,
  maxDist: 8,
  eps: 1e-4,
  stepFactor: 0.9,
};

/** 실루엣 채점 기본값. 정면·옆 두 시점을 본다. */
export const SILHOUETTE = {
  resolution: 80,
  halfSize: 2.2,
  distance: 2.6,
};

/**
 * 채점용 직교 시점.
 * forward 는 시선이 향하는 방향, right 는 화면 오른쪽, up 은 화면 위쪽이다.
 * 카메라와 무관하게 고정이라 점수가 흔들리지 않는다.
 */
export const SILHOUETTE_VIEWS = [
  { id: "front", forward: { x: 0, y: 0, z: -1 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } },
  { id: "side", forward: { x: -1, y: 0, z: 0 }, right: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 } },
];

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function length3(x, y, z) {
  return Math.sqrt(x * x + y * y + z * z);
}

/** 세계 좌표를 부품의 로컬 좌표로 옮긴다. 부품은 Y축 기준 회전만 가진다. */
export function toLocal(point, element) {
  const dx = point.x - element.position.x;
  const dy = point.y - element.position.y;
  const dz = point.z - element.position.z;
  const c = Math.cos(element.rotationY ?? 0);
  const s = Math.sin(element.rotationY ?? 0);
  return { x: dx * c - dz * s, y: dy, z: dx * s + dz * c };
}

/** 구. 중심에서 0, 표면에서 r, 그 밖에서는 |p| - r. */
export function sdSphere(point, params) {
  return length3(point.x, point.y, point.z) - params.r;
}

/** 축 정렬 박스. 안쪽에서는 음수, 모서리 근처에서 정확한 거리를 준다. */
export function sdBox(point, params) {
  const qx = Math.abs(point.x) - params.hx;
  const qy = Math.abs(point.y) - params.hy;
  const qz = Math.abs(point.z) - params.hz;
  const outside = length3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  const inside = Math.min(Math.max(qx, Math.max(qy, qz)), 0);
  return outside + inside;
}

/** 모서리를 둥글게 깎은 박스. */
export function sdRoundBox(point, params) {
  const round = params.round ?? 0.1;
  const qx = Math.abs(point.x) - (params.hx - round);
  const qy = Math.abs(point.y) - (params.hy - round);
  const qz = Math.abs(point.z) - (params.hz - round);
  const outside = length3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  const inside = Math.min(Math.max(qx, Math.max(qy, qz)), 0);
  return outside + inside - round;
}

/** 토러스. Y축이 중심축이다. 관절(구멍 안쪽)에서는 양수. */
export function sdTorus(point, params) {
  const radial = length3(point.x, 0, point.z) - params.R;
  return length3(radial, point.y, 0) - params.r;
}

/** 캡슐. Y축 방향으로 길이 h, 반지름 r. */
export function sdCapsule(point, params) {
  const half = params.h / 2;
  const y = point.y - clamp(point.y, -half, half);
  return length3(point.x, y, point.z) - params.r;
}

/**
 * 타원체. 축 위에서는 정확하고 축 사이에서는 근사다.
 * 근사식이라 표면 근처에서 거리가 살짝 틀어날 수 있다.
 */
export function sdEllipsoid(point, params) {
  const rx = params.rx;
  const ry = params.ry;
  const rz = params.rz;
  const k0 = length3(point.x / rx, point.y / ry, point.z / rz);
  const k1 = length3(point.x / (rx * rx), point.y / (ry * ry), point.z / (rz * rz));
  if (k1 < 1e-12) return -Math.min(rx, ry, rz);
  return (k0 * (k0 - 1)) / k1;
}

const PRIMITIVES = {
  sphere: sdSphere,
  box: sdBox,
  roundBox: sdRoundBox,
  torus: sdTorus,
  capsule: sdCapsule,
  ellipsoid: sdEllipsoid,
};

/** 부품 하나가 world 점 p 에 만드는 거리. */
export function elementSdf(element, point) {
  const primitive = PRIMITIVES[element.kind];
  if (!primitive) return FAR;
  return primitive(toLocal(point, element), element.params ?? {});
}

/** 매끈한 합. 두 형태가 겹치는 경계를 둥글게 잇는다. */
export function smoothMin(a, b, k) {
  if (!(k > 0)) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/**
 * CSG 결합.
 * union 은 min, intersect 는 max, subtract 는 max(a, -b).
 * smooth 는 다항식 매끈한 합이라 컴볼루션보다 작고 경계가 둥글다.
 */
export function combine(a, b, op, k = 0.4) {
  if (op === "intersect") return Math.max(a, b);
  if (op === "subtract") return Math.max(a, -b);
  if (op === "smooth") return smoothMin(a, b, k);
  return Math.min(a, b);
}

/**
 * 부품 목록을 순서대로 쌓아 만든 형태의 거리 함수.
 * 첫 부품이 밑바닥이고, 뒤 부품의 연산이 앞 결과에 적용된다.
 */
export function shapeSdf(elements, point) {
  if (!elements || elements.length === 0) return FAR;
  let distance = elementSdf(elements[0], point);
  for (let index = 1; index < elements.length; index += 1) {
    const element = elements[index];
    const own = elementSdf(element, point);
    distance = combine(distance, own, element.op ?? "union", element.params?.k);
  }
  return distance;
}

/** 부품 목록을 거리 함수로 감싼다. */
export function makeSdf(elements) {
  return (point) => shapeSdf(elements, point);
}

/**
 * 스피어 트레이싱. 표면까지의 거리를 이용해 앞으로만 이동한다.
 * @returns {{hit:boolean, t:number}} hit 이면 표면까지의 거리 t.
 */
export function marchRay(origin, direction, sdf, options = {}) {
  const maxSteps = options.maxSteps ?? MARCH.maxSteps;
  const maxDist = options.maxDist ?? MARCH.maxDist;
  const eps = options.eps ?? MARCH.eps;
  const factor = options.stepFactor ?? MARCH.stepFactor;

  let t = 0;
  for (let step = 0; step < maxSteps; step += 1) {
    const sample = {
      x: origin.x + direction.x * t,
      y: origin.y + direction.y * t,
      z: origin.z + direction.z * t,
    };
    const distance = sdf(sample);
    if (!Number.isFinite(distance)) return { hit: false, t: maxDist };
    if (distance < eps) return { hit: true, t };
    t += Math.max(distance, eps) * factor;
    if (t > maxDist) break;
  }
  return { hit: false, t };
}

/**
 * 한 시점의 실루엣. 히트한 픽셀과 깊이를 돌려준다.
 * @returns {{mask:Uint8Array, depth:Float32Array, resolution:number}}
 */
export function silhouette(sdf, view, options = {}) {
  const resolution = options.resolution ?? SILHOUETTE.resolution;
  const halfSize = options.halfSize ?? SILHOUETTE.halfSize;
  const distance = options.distance ?? SILHOUETTE.distance;
  const mask = new Uint8Array(resolution * resolution);
  const depth = new Float32Array(resolution * resolution);

  for (let row = 0; row < resolution; row += 1) {
    const v = halfSize - ((row + 0.5) / resolution) * 2 * halfSize;
    for (let column = 0; column < resolution; column += 1) {
      const u = ((column + 0.5) / resolution) * 2 * halfSize - halfSize;
      const origin = {
        x: view.right.x * u + view.up.x * v - view.forward.x * distance,
        y: view.right.y * u + view.up.y * v - view.forward.y * distance,
        z: view.right.z * u + view.up.z * v - view.forward.z * distance,
      };
      const result = marchRay(origin, view.forward, sdf, options);
      const index = row * resolution + column;
      if (result.hit) {
        mask[index] = 1;
        depth[index] = result.t;
      }
    }
  }
  return { mask, depth, resolution };
}

/** 두 마스크의 교집합 비율. */
export function maskIou(a, b) {
  let intersection = 0;
  let union = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index] === 1;
    const right = b[index] === 1;
    if (left && right) intersection += 1;
    if (left || right) union += 1;
  }
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * 실루엣 일치도. 정면·옆 두 시점의 IoU 평균.
 * 카메라를 돌려도 값이 바뀌지 않는다.
 */
export function silhouetteIou(sdfA, sdfB, options = {}) {
  const views = options.views ?? SILHOUETTE_VIEWS;
  let total = 0;
  for (const view of views) {
    const left = silhouette(sdfA, view, options);
    const right = silhouette(sdfB, view, options);
    total += maskIou(left.mask, right.mask);
  }
  return total / views.length;
}
