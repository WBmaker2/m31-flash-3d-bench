// 레벨 8종과 전개도 보기. 순수 계산이라 Node 에서 그대로 테스트된다.
import { NETS, matchesTarget, squareColors } from "../../common/parts/net3d.js";

const P = {
  빨강: 0xff6b5c,
  파랑: 0x6fc9ff,
  노랑: 0xffd76a,
  초록: 0x7fe08a,
  보라: 0xc7a2ff,
  하양: 0xf2f5f8,
};

export const LEVELS = [
  {
    id: "n01",
    label: "첫 상자",
    hint: "어느 전개도가 이 상자가 될까요?",
    net: "cross",
    target: { down: P.빨강, up: P.파랑, north: P.노랑, south: P.초록, east: P.보라, west: P.하양 },
  },
  {
    id: "n02",
    label: "색 바꿔 보기",
    hint: "같은 모양인데 색이 달라졌어요.",
    net: "cross",
    target: { down: P.파랑, up: P.빨강, north: P.초록, south: P.하양, east: P.노랑, west: P.보라 },
  },
  {
    id: "n03",
    label: "지그재그",
    hint: "생각보다 돌렸을 때 모양이 달라져요.",
    net: "zigzag",
    target: { down: P.노랑, up: P.초록, north: P.빨강, south: P.보라, east: P.하양, west: P.파랑 },
  },
  {
    id: "n04",
    label: "들어간 모양",
    hint: "파인 부분이 어디에 붙는지 잘 살펴보세요.",
    net: "tee",
    target: { down: P.하양, up: P.노랑, north: P.파랑, south: P.빨강, east: P.초록, west: P.보라 },
  },
  {
    id: "n05",
    label: "계단 모양",
    hint: "오므린 모양을 접어 보세요.",
    net: "stair",
    target: { down: P.보라, up: P.하양, north: P.초록, south: P.파랑, east: P.빨강, west: P.노랑 },
  },
  {
    id: "n06",
    label: "긴 모양",
    hint: "길게 늘어진 전개도예요.",
    net: "longL",
    target: { down: P.초록, up: P.빨강, north: P.보라, south: P.파랑, east: P.하양, west: P.노랑 },
  },
  {
    id: "n07",
    label: "두 줄",
    hint: "두 줄로 접히는 모양이에요.",
    net: "belt",
    target: { down: P.파랑, up: P.노랑, north: P.하양, south: P.보라, east: P.초록, west: P.빨강 },
  },
  {
    id: "n08",
    label: "마지막 상자",
    hint: "마지막 퍼즐이에요. 천천히 접어 보세요.",
    net: "cross",
    target: { down: P.초록, up: P.노랑, north: P.보라, south: P.하양, east: P.빨강, west: P.파랑 },
  },
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function levelIndexById(id) {
  return LEVELS.findIndex((level) => level.id === id);
}

function swapColors(colors, first, second) {
  const next = new Map(colors);
  const a = next.get(first);
  next.set(first, next.get(second));
  next.set(second, a);
  return next;
}

/** 보기 4개. 첫 번째가 정답이다. */
export function levelOptions(level) {
  const cells = NETS[level.net];
  const correct = squareColors({ cells, target: level.target });
  const keys = cells.map((cell) => `${cell.col},${cell.row}`);
  return [
    correct,
    swapColors(correct, keys[0], keys[1]),
    swapColors(correct, keys[2], keys[4]),
    swapColors(correct, keys[1], keys[5]),
  ];
}

/** 정답이 몇 번 보기인지. */
export function correctIndex(level) {
  const options = levelOptions(level);
  const cells = NETS[level.net];
  return options.findIndex((colors) => matchesTarget({ cells, colors, target: level.target }));
}

export function evaluateLevel(level, index) {
  const options = levelOptions(level);
  const cells = NETS[level.net];
  const correct = correctIndex(level);
  const cleared = index === correct;
  return {
    cleared,
    stars: cleared ? 3 : 0,
    score: cleared ? 300 : 0,
    correct,
    picked: index,
  };
}

export { NETS, P as PALETTE };
