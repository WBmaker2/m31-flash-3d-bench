// 레벨 8종과 선로 판정. 순수 계산이라 Node 에서 그대로 테스트된다.
import { cellKey, findPath, piecePorts, requiredPieces } from "../../common/parts/rail3d.js";

const LEVELS = [
  {
    id: "r01",
    label: "첫 선로",
    hint: "빈 칸을 눌러 선로를 놓고, 방향을 정해 주세요.",
    size: 6,
    start: { col: 0, row: 2 },
    goal: { col: 5, row: 2 },
    fixed: [{ col: 0, row: 2, kind: "straight", orientation: 1 }],
    par: 4,
  },
  {
    id: "r02",
    label: "꺾인 길",
    hint: "기차가 갈아타야 하는 곳이 있어요.",
    size: 6,
    start: { col: 0, row: 0 },
    goal: { col: 5, row: 4 },
    fixed: [
      { col: 0, row: 0, kind: "straight", orientation: 1 },
      { col: 5, row: 4, kind: "straight", orientation: 0 },
    ],
    par: 8,
  },
  {
    id: "r03",
    label: "지그재그",
    hint: "커브 선로를 써 보세요.",
    size: 7,
    start: { col: 0, row: 3 },
    goal: { col: 6, row: 3 },
    fixed: [{ col: 0, row: 3, kind: "straight", orientation: 1 }],
    par: 5,
  },
  {
    id: "r04",
    label: "우회하기",
    hint: "돌아가서 가는 길도 있어요.",
    size: 7,
    start: { col: 0, row: 0 },
    goal: { col: 6, row: 6 },
    fixed: [
      { col: 0, row: 0, kind: "straight", orientation: 1 },
      { col: 6, row: 6, kind: "straight", orientation: 0 },
    ],
    par: 11,
  },
  {
    id: "r05",
    label: "긴 선로",
    hint: "많이 놓아야 하는 레벨이에요.",
    size: 8,
    start: { col: 0, row: 4 },
    goal: { col: 7, row: 4 },
    fixed: [{ col: 0, row: 4, kind: "straight", orientation: 1 }],
    par: 6,
  },
  {
    id: "r06",
    label: "역에서 출발",
    hint: "역과 역을 이어 보세요.",
    size: 7,
    start: { col: 0, row: 6 },
    goal: { col: 6, row: 0 },
    fixed: [
      { col: 0, row: 6, kind: "straight", orientation: 1 },
      { col: 6, row: 0, kind: "straight", orientation: 0 },
    ],
    par: 11,
  },
  {
    id: "r07",
    label: "알 수 없는 길",
    hint: "놓인 선로를 믿고 가 보세요.",
    size: 7,
    start: { col: 1, row: 3 },
    goal: { col: 5, row: 3 },
    fixed: [
      { col: 1, row: 3, kind: "straight", orientation: 1 },
      { col: 3, row: 3, kind: "straight", orientation: 1 },
      { col: 5, row: 3, kind: "straight", orientation: 1 },
    ],
    par: 2,
  },
  {
    id: "r08",
    label: "마지막 선로",
    hint: "역에서 역까지 정확히 이어 보세요.",
    size: 8,
    start: { col: 0, row: 0 },
    goal: { col: 7, row: 7 },
    fixed: [
      { col: 0, row: 0, kind: "straight", orientation: 1 },
      { col: 7, row: 7, kind: "straight", orientation: 0 },
    ],
    par: 13,
  },
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function levelIndexById(id) {
  return LEVELS.findIndex((level) => level.id === id);
}

/** 현재 놓인 선로를 Map 으로 만든다. */
export function levelGrid(level, placement) {
  const grid = new Map();
  for (const piece of level.fixed ?? []) {
    grid.set(cellKey(piece.col, piece.row), { kind: piece.kind, orientation: piece.orientation });
  }
  for (const piece of placement ?? []) {
    if (!piece) continue;
    grid.set(cellKey(piece.col, piece.row), { kind: piece.kind, orientation: piece.orientation });
  }
  return grid;
}

export function findLevelPath(level, placement) {
  return findPath({
    grid: levelGrid(level, placement),
    size: level.size,
    start: level.start,
    goal: level.goal,
  });
}

export function levelPar(level) {
  return requiredPieces(level);
}

export function evaluateLevel(level, placement) {
  const path = findLevelPath(level, placement);
  const placed = (placement ?? []).filter(Boolean).length;
  let stars = 0;
  if (path) stars = placed <= level.par ? 3 : 2;
  return {
    cleared: Boolean(path),
    stars,
    score: stars * 100,
    path,
    placed,
    par: level.par,
  };
}

export { piecePorts, LEVELS };
