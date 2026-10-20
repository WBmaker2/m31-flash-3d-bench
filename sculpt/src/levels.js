// 레벨 8종 · 기준 해법 · 채점 규칙. 순수 계산, three에 의존하지 않는다.
//
// 목표 형태는 플레이어가 쓸 수 있는 기본형보다 부자하다.
// (라운드 박스·타원체·매끈한 합) 그래서 근화가 필요하다.
//
// 각 레벨에는 `reference`(기준 해법) 가 함께 있다.
// 기준 해법의 실루엣 일치도를 목표값으로 삼는다.
// 목표값이 늘 달성 가능하므로 "손맛 파라미터"가 생기지 않는다.
// `maze/` 의 par = BFS 최적 경로와 같은 원칙이다.

import { makeSdf, silhouetteIou } from "./sdf.js";

/** 재사용하는 부품 생성기. */
function sphere(x, y, z, r, op = "union", extra = {}) {
  return { kind: "sphere", op, position: { x, y, z }, rotationY: 0, params: { r, ...extra } };
}

function box(x, y, z, hx, hy, hz, op = "union", extra = {}) {
  return { kind: "box", op, position: { x, y, z }, rotationY: 0, params: { hx, hy, hz, ...extra } };
}

function torus(x, y, z, R, r, op = "union", extra = {}) {
  return { kind: "torus", op, position: { x, y, z }, rotationY: 0, params: { R, r, ...extra } };
}

function capsule(x, y, z, r, h, op = "union", extra = {}) {
  return { kind: "capsule", op, position: { x, y, z }, rotationY: 0, params: { r, h, ...extra } };
}

function roundBox(x, y, z, hx, hy, hz, round, op = "union", extra = {}) {
  return {
    kind: "roundBox",
    op,
    position: { x, y, z },
    rotationY: 0,
    params: { hx, hy, hz, round, ...extra },
  };
}

function ellipsoid(x, y, z, rx, ry, rz, op = "union", extra = {}) {
  return {
    kind: "ellipsoid",
    op,
    position: { x, y, z },
    rotationY: 0,
    params: { rx, ry, rz, ...extra },
  };
}

export const LEVELS = [
  {
    id: "first",
    label: "첫 조각",
    hint: "구 하나를 만들어 보세요. 반지름을 고르면 표면이 맞물립니다.",
    maxParts: 2,
    target: { elements: [sphere(0, 0.9, 0, 0.9)] },
    reference: { elements: [sphere(0, 0.9, 0, 0.9)] },
  },
  {
    id: "blend",
    label: "두 덩어리",
    hint: "목표는 두 덩어리가 매끄럽게 이어졌습니다. 합집합으로 이어 보세요.",
    maxParts: 3,
    target: {
      elements: [
        sphere(-0.45, 0.8, 0, 0.8, "union", { k: 0.5 }),
        sphere(0.45, 0.8, 0, 0.8, "smooth", { k: 0.5 }),
      ],
    },
    reference: {
      elements: [sphere(-0.45, 0.8, 0, 0.8), sphere(0.45, 0.8, 0, 0.8)],
    },
  },
  {
    id: "carve",
    label: "구면 조각",
    hint: "구 한 덩어리를 깎았습니다. 차집합으로 파낸 자리를 옮겨 보세요.",
    maxParts: 3,
    target: {
      elements: [sphere(0, 1, 0, 1), sphere(0.62, 1.25, 0, 0.6, "subtract")],
    },
    reference: {
      elements: [sphere(0, 1, 0, 1), sphere(0.62, 1.25, 0, 0.6, "subtract")],
    },
  },
  {
    id: "lens",
    label: "렌즈",
    hint: "두 구가 겹친 부분만 남긴 모양입니다. 교집합으로 잘라 보세요.",
    maxParts: 3,
    target: {
      elements: [sphere(-0.45, 0.8, 0, 0.8), sphere(0.45, 0.8, 0, 0.8, "intersect")],
    },
    reference: {
      elements: [sphere(-0.45, 0.8, 0, 0.8), sphere(0.45, 0.8, 0, 0.8, "intersect")],
    },
  },
  {
    id: "mushroom",
    label: "버섯",
    hint: "긴 기둥에 둥근 몸통이 매끄럽게 붙었습니다. 둘을 합쳐 보세요.",
    maxParts: 4,
    target: {
      elements: [
        capsule(0, 0.5, 0, 0.4, 1, "union", { k: 0.35 }),
        sphere(0, 1.28, 0, 0.72, "smooth", { k: 0.35 }),
      ],
    },
    reference: {
      elements: [capsule(0, 0.5, 0, 0.4, 1), sphere(0, 1.28, 0, 0.72)],
    },
  },
  {
    id: "egg",
    label: "긴 알",
    hint: "목표는 살짝 길쭉한 공입니다. 캡슐로 폭과 길이를 나눠 맞춰 보세요.",
    maxParts: 4,
    target: { elements: [ellipsoid(0, 0.95, 0, 0.75, 0.95, 0.75)] },
    reference: { elements: [capsule(0, 0.95, 0, 0.7, 0.5)] },
  },
  {
    id: "block",
    label: "각진 상자",
    hint: "목표는 모서리가 둥근 상자입니다. 박스로 가까이 맞춰 보세요.",
    maxParts: 4,
    target: { elements: [roundBox(0, 0.8, 0, 0.8, 0.8, 0.8, 0.28)] },
    reference: { elements: [box(0, 0.8, 0, 0.8, 0.8, 0.8)] },
  },
  {
    id: "finale",
    label: "마지막 조각",
    hint: "고리 위에 구가 얹혔고 한쪽이 깎였습니다. 세 부품을 이어 보세요.",
    maxParts: 6,
    target: {
      elements: [
        torus(0, 0.8, 0, 0.8, 0.28, "union", { k: 0.4 }),
        sphere(0, 1.65, 0, 0.5, "smooth", { k: 0.4 }),
        sphere(0.95, 0.95, 0, 0.42, "subtract"),
      ],
    },
    reference: {
      elements: [
        torus(0, 0.8, 0, 0.8, 0.28),
        sphere(0, 1.65, 0, 0.5),
        sphere(0.95, 0.95, 0, 0.42, "subtract"),
      ],
    },
  },
];

/** 채점 기준. 실루엣 일치도(정면·옆 평균)와 부피 오차를 함께 본다. */
export const SCORE_RULES = {
  stars: [0.94, 0.88, 0.8],
  volumeTolerance: 0.2,
};

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

export function levelIndexById(id) {
  const index = LEVELS.findIndex((level) => level.id === id);
  return index < 0 ? 0 : index;
}

const parCache = new Map();

/**
 * 레벨의 목표 일치도.
 * 기준 해법으로 실제로 얻는 값이라 항상 달성 가능하다.
 */
export function levelPar(level) {
  const id = level.id;
  if (parCache.has(id)) return parCache.get(id);
  const reference = makeSdf(level.reference.elements);
  const target = makeSdf(level.target.elements);
  const par = silhouetteIou(reference, target);
  parCache.set(id, par);
  return par;
}

/**
 * 채점. 실루엣 일치도와 부피 오차를 함께 본다.
 * @param {{iou:number, volumeRatio:number}} result
 */
export function evaluateSculpt(result, level) {
  const iou = Number.isFinite(result?.iou) ? result.iou : 0;
  const volumeRatio = Number.isFinite(result?.volumeRatio) ? result.volumeRatio : 0;
  const volumeOk = Math.abs(volumeRatio - 1) <= SCORE_RULES.volumeTolerance;
  const [three, two, one] = SCORE_RULES.stars;
  let stars = 0;
  if (iou >= three) stars = 3;
  else if (iou >= two) stars = 2;
  else if (iou >= one) stars = 1;
  const cleared = stars >= 1 && volumeOk;
  return { cleared, stars, iou, volumeRatio, volumeOk };
}

/** 점수. 일치도가 높고 부피가 맞을수록 높다. */
export function scoreForSculpt(result) {
  const iou = Number.isFinite(result?.iou) ? result.iou : 0;
  const volumeRatio = Number.isFinite(result?.volumeRatio) ? result.volumeRatio : 0;
  const volumeScore = Math.max(0, 1 - Math.abs(volumeRatio - 1) * 2);
  return Math.round(iou * 800 + volumeScore * 200);
}
