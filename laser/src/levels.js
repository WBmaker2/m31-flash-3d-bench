// 레벨 8종. 순수 계산이라 Node 에서 그대로 테스트된다.
import { key, solveAll, traceBeam } from "../../common/parts/optic3d.js";

const LEVELS = [
  {
    id: "l01",
    label: "첫 반사",
    hint: "거울을 눌러 방향을 바꾸면 빛이 목표로 가요.",
    size: 7,
    emitter: { col: 0, row: 0, direction: "east" },
    target: { col: 6, row: 4 },
    mirrors: [
      { col: 4, row: 0, orientation: "slash" },
      { col: 4, row: 4, orientation: "slash" },
    ],
  },
  {
    id: "l02",
    label: "위로 꺾기",
    hint: "빛을 위로 보내 보세요.",
    size: 7,
    emitter: { col: 0, row: 6, direction: "east" },
    target: { col: 5, row: 2 },
    mirrors: [
      { col: 2, row: 6, orientation: "backslash" },
      { col: 2, row: 2, orientation: "backslash" },
    ],
  },
  {
    id: "l03",
    label: "지그재그",
    hint: "세 번 꺾이는 길도 있어요.",
    size: 8,
    emitter: { col: 0, row: 0, direction: "east" },
    target: { col: 5, row: 6 },
    mirrors: [
      { col: 2, row: 0, orientation: "slash" },
      { col: 2, row: 4, orientation: "slash" },
      { col: 5, row: 4, orientation: "slash" },
    ],
  },
  {
    id: "l04",
    label: "왼쪽으로",
    hint: "빛을 왼쪽으로 보내 보세요.",
    size: 8,
    emitter: { col: 7, row: 0, direction: "south" },
    target: { col: 5, row: 6 },
    mirrors: [
      { col: 7, row: 3, orientation: "backslash" },
      { col: 3, row: 3, orientation: "backslash" },
      { col: 3, row: 6, orientation: "slash" },
    ],
  },
  {
    id: "l05",
    label: "막다른 길",
    hint: "한 군데가 막혀 있어요. 거울을 바꿔 보세요.",
    size: 8,
    emitter: { col: 0, row: 0, direction: "east" },
    target: { col: 2, row: 7 },
    mirrors: [
      { col: 4, row: 0, orientation: "slash" },
      { col: 4, row: 3, orientation: "slash" },
      { col: 2, row: 3, orientation: "slash" },
    ],
  },
  {
    id: "l06",
    label: "다섯 번 꺾기",
    hint: "거울이 다섯 개 있어요.",
    size: 8,
    emitter: { col: 4, row: 0, direction: "south" },
    target: { col: 1, row: 6 },
    mirrors: [
      { col: 4, row: 2, orientation: "backslash" },
      { col: 2, row: 2, orientation: "backslash" },
      { col: 2, row: 6, orientation: "backslash" },
      { col: 6, row: 6, orientation: "backslash" },
      { col: 6, row: 1, orientation: "backslash" },
    ],
  },
  {
    id: "l07",
    label: "돌아서 가기",
    hint: "빛이 돌아서 다녀요.",
    size: 8,
    emitter: { col: 0, row: 3, direction: "east" },
    target: { col: 7, row: 1 },
    mirrors: [
      { col: 2, row: 3, orientation: "slash" },
      { col: 2, row: 6, orientation: "slash" },
      { col: 5, row: 6, orientation: "slash" },
      { col: 5, row: 1, orientation: "slash" },
    ],
  },
  {
    id: "l08",
    label: "최종 거울",
    hint: "가장 긴 빛길이에요.",
    size: 9,
    emitter: { col: 0, row: 8, direction: "east" },
    target: { col: 8, row: 1 },
    mirrors: [
      { col: 2, row: 8, orientation: "backslash" },
      { col: 2, row: 5, orientation: "backslash" },
      { col: 5, row: 5, orientation: "backslash" },
      { col: 5, row: 2, orientation: "backslash" },
      { col: 8, row: 2, orientation: "backslash" },
    ],
  },
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function levelIndexById(id) {
  return LEVELS.findIndex((level) => level.id === id);
}

export function mirrorMap(level) {
  const map = new Map();
  for (const mirror of level.mirrors) {
    map.set(key(mirror.col, mirror.row), mirror.orientation);
  }
  return map;
}

export function traceLevel(level, mirrors) {
  return traceBeam({
    start: { col: level.emitter.col, row: level.emitter.row },
    direction: level.emitter.direction,
    mirrors,
    size: level.size,
    target: level.target,
  });
}

export function levelSolution(level) {
  const initial = mirrorMap(level);
  const solutions = solveAll({
    start: { col: level.emitter.col, row: level.emitter.row },
    direction: level.emitter.direction,
    mirrors: initial,
    size: level.size,
    target: level.target,
  });
  if (solutions.length === 0) return null;
  // 가장 적게 뒤집는 해답을 고른다.
  let best = solutions[0];
  let bestFlips = Infinity;
  for (const candidate of solutions) {
    let flips = 0;
    for (const [cell, orientation] of candidate) {
      if (initial.get(cell) !== orientation) flips += 1;
    }
    if (flips < bestFlips) {
      bestFlips = flips;
      best = candidate;
    }
  }
  return best;
}

/** 목표에 닿는 데 필요한 최소 뒤집기 횟수. */
export function levelPar(level) {
  const initial = mirrorMap(level);
  const solutions = solveAll({
    start: { col: level.emitter.col, row: level.emitter.row },
    direction: level.emitter.direction,
    mirrors: initial,
    size: level.size,
    target: level.target,
  });
  let best = Infinity;
  for (const solution of solutions) {
    let flips = 0;
    for (const [cell, orientation] of solution) {
      if (initial.get(cell) !== orientation) flips += 1;
    }
    best = Math.min(best, flips);
  }
  return best;
}

export function evaluateLevel(level, mirrors) {
  const trace = traceLevel(level, mirrors);
  const flipped = level.mirrors.filter(
    (mirror) => mirrors.get(key(mirror.col, mirror.row)) !== mirror.orientation,
  ).length;
  const par = levelPar(level);
  let stars = 0;
  if (trace.reached) stars = flipped <= par ? 3 : 2;
  return {
    cleared: trace.reached,
    stars,
    score: stars * 100 + Math.max(0, 60 - flipped * 10),
    reflections: trace.reflections,
    flipped,
    par,
  };
}

export { LEVELS };
