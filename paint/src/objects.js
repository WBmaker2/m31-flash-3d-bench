// 인형별 복셀 조각 표. 단일 진실 공급원이다.
// 상자 좌표는 복셀 단위의 정수. x0<x1, y0<y1, z0<z1.

function box(x0, y0, z0, x1, y1, z1) {
  return { x0, y0, z0, x1, y1, z1 };
}

function part(id, label, boxes) {
  return { id, label, boxes };
}

export const MODELS = {
  robot: [
    part("r-head", "머리", [box(-2, 4, -1, 2, 6, 1)]),
    part("r-eyes", "눈", [box(-1, 5, 1, 0, 6, 2), box(1, 5, 1, 2, 6, 2)]),
    part("r-mouth", "입", [box(0, 4, 1, 1, 5, 2)]),
    part("r-body", "몸통", [box(-2, 1, -1, 2, 4, 1)]),
    part("r-arms", "팔", [box(-3, 2, -1, -2, 4, 1), box(2, 2, -1, 3, 4, 1)]),
    part("r-legs", "다리", [box(-2, 0, -1, -1, 1, 1), box(1, 0, -1, 2, 1, 1)]),
  ],
  mushroom: [
    part("m-cap", "개울", [box(-3, 3, -2, 3, 5, 2)]),
    part("m-spots", "점", [
      box(-2, 5, 2, -1, 6, 3),
      box(0, 5, 2, 1, 6, 3),
      box(-1, 3, -3, 0, 4, -2),
    ]),
    part("m-stem", "줄기", [box(-1, 0, -1, 1, 3, 1)]),
  ],
  car: [
    part("c-body", "차체", [box(-3, 1, -1, 3, 3, 1)]),
    part("c-cabin", "캐빈", [box(-1, 3, -1, 1, 4, 1)]),
    part("c-window", "창문", [box(-1, 3, 1, 1, 4, 2)]),
    part("c-wheels", "바퀴", [
      box(-3, 0, -2, -2, 1, -1),
      box(-3, 0, 1, -2, 1, 2),
      box(2, 0, -2, 3, 1, -1),
      box(2, 0, 1, 3, 1, 2),
    ]),
  ],
  rocket: [
    part("k-body", "몸통", [box(-1, 0, -1, 1, 5, 1)]),
    part("k-nose", "코", [box(-1, 5, -1, 1, 7, 1)]),
    part("k-window", "창문", [box(-1, 3, 1, 0, 4, 2)]),
    part("k-fins", "날개", [box(-2, 0, -1, -1, 2, 1), box(1, 0, -1, 2, 2, 1)]),
    part("k-flame", "불꽃", [box(-1, -2, -1, 1, 0, 1)]),
  ],
  cat: [
    part("t-head", "머리", [box(-1, 2, 0, 1, 4, 2)]),
    part("t-ears", "귀", [box(-1, 4, 0, 0, 5, 1), box(0, 4, 0, 1, 5, 1)]),
    part("t-body", "몸", [box(-1, 0, -1, 1, 2, 3)]),
    part("t-tail", "꼬리", [box(1, 1, 3, 2, 2, 4)]),
    part("t-legs", "다리", [box(-1, -1, 0, 0, 0, 1), box(0, -1, 0, 1, 0, 1)]),
  ],
};

export const PART_LABELS = (() => {
  const labels = {};
  for (const parts of Object.values(MODELS)) {
    for (const entry of parts) labels[entry.id] = entry.label;
  }
  return labels;
})();

/** 인형 안에서 조각을 찾는다. 어느 인형의 조각인지도 알려 준다. */
export function findPart(partId) {
  for (const [name, parts] of Object.entries(MODELS)) {
    const found = parts.find((entry) => entry.id === partId);
    if (found) return { model: name, part: found };
  }
  return null;
}
