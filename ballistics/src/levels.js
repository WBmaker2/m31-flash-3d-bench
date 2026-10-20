// 레벨 데이터. 파라미터의 단일 진실 공급원이다.
// 칸 좌표 (i, j, k) 는 2 m 격자. i 는 좌우, j 는 높이, k 는 사거리 방향.

export const DEFAULT_AIM = { yawDeg: 0, pitchDeg: 30, power: 11 };

export const LEVELS = [
  {
    id: "first",
    label: "첫 발사",
    hint: "고도각 30°, 파워 11 로 앞 상자를 맞혀 보세요. 발사하면 궤적이 그려집니다.",
    shots: 4,
    par: 2,
    wind: { x: 0, z: 0 },
    drag: 0,
    defaultAim: { yawDeg: 0, pitchDeg: 30, power: 11 },
    solution: { yawDeg: 0, pitchDeg: 30, power: 11 },
    blocks: [
      { id: "t1", i: 0, j: 0, k: 5, kind: "target" },
    ],
  },
  {
    id: "pair",
    label: "양쪽 상자",
    hint: "상자가 좌우로 떨어져 있습니다. 방위각을 틀어 옆 상자를 노리세요.",
    shots: 4,
    par: 3,
    wind: { x: 0, z: 0 },
    drag: 0,
    defaultAim: { yawDeg: 0, pitchDeg: 30, power: 11 },
    solution: { yawDeg: -11, pitchDeg: 30, power: 11 },
    blocks: [
      { id: "left", i: -1, j: 0, k: 5, kind: "target" },
      { id: "right", i: 1, j: 0, k: 5, kind: "target" },
    ],
  },
  {
    id: "wind",
    label: "바람",
    hint: "오른쪽으로 바람이 붑니다. 조준을 바람보다 반대로 틀어 보세요.",
    shots: 5,
    par: 3,
    wind: { x: 1.5, z: 0 },
    drag: 0,
    defaultAim: { yawDeg: 0, pitchDeg: 18, power: 15 },
    solution: { yawDeg: -2, pitchDeg: 18, power: 15 },
    blocks: [
      { id: "near", i: 0, j: 0, k: 6, kind: "target" },
      { id: "far", i: 0, j: 0, k: 7, kind: "target" },
    ],
  },
  {
    id: "tower",
    label: "탑 무너뜨리기",
    hint: "두 상자가 쌓여 있습니다. 아래를 맞히면 위 상자도 함께 무너집니다.",
    shots: 5,
    par: 3,
    wind: { x: 0, z: 0 },
    drag: 0,
    defaultAim: { yawDeg: 0, pitchDeg: 17, power: 15.9 },
    solution: { yawDeg: 0, pitchDeg: 17, power: 15.9 },
    blocks: [
      { id: "base", i: 0, j: 0, k: 8, kind: "target" },
      { id: "top", i: 0, j: 1, k: 8, kind: "target" },
    ],
  },
  {
    id: "obstacle",
    label: "장애물",
    hint: "벽이 앞을 막습니다. 벽 너머 상자는 높게 던져 넘어뜨리세요.",
    shots: 5,
    par: 3,
    wind: { x: 0, z: 0 },
    drag: 0,
    defaultAim: { yawDeg: 0, pitchDeg: 45, power: 11.7 },
    solution: { yawDeg: 0, pitchDeg: 45, power: 11.7 },
    blocks: [
      { id: "wall-low", i: 0, j: 0, k: 3, kind: "wall" },
      { id: "wall-high", i: 0, j: 1, k: 3, kind: "wall" },
      { id: "behind", i: 0, j: 0, k: 7, kind: "target" },
      { id: "side", i: -2, j: 0, k: 5, kind: "target" },
    ],
  },
  {
    id: "mover",
    label: "움직이는 표적",
    hint: "표적이 좌우로 움직입니다. 도착할 위치를 미리 계산해 앞질러 맞히세요.",
    shots: 5,
    par: 3,
    wind: { x: 0, z: 0 },
    drag: 0,
    defaultAim: { yawDeg: 8, pitchDeg: 20, power: 14 },
    solution: { yawDeg: 8, pitchDeg: 20, power: 14 },
    blocks: [
      { id: "slider", i: 0, j: 0, k: 6, kind: "target", move: { axis: "x", amplitude: 2.5, period: 6 } },
      { id: "still", i: 1, j: 0, k: 7, kind: "target" },
    ],
  },
  {
    id: "keep",
    label: "성",
    hint: "네 상자가 쌓였습니다. 밑단을 무너뜨리면 위쪽도 함께 무너집니다.",
    shots: 5,
    par: 3,
    wind: { x: 0, z: 0 },
    drag: 0,
    defaultAim: { yawDeg: 6, pitchDeg: 22, power: 13 },
    solution: { yawDeg: 6, pitchDeg: 22, power: 13 },
    blocks: [
      { id: "a", i: 0, j: 0, k: 6, kind: "target" },
      { id: "b", i: 1, j: 0, k: 6, kind: "target" },
      { id: "c", i: 0, j: 1, k: 6, kind: "target" },
      { id: "d", i: 1, j: 1, k: 6, kind: "target" },
    ],
  },
  {
    id: "finale",
    label: "최종",
    hint: "벽 뒤로 흩어진 세 상자. 순서를 잘 짜면 적은 샷으로 끝납니다.",
    shots: 6,
    par: 4,
    wind: { x: 0, z: 0 },
    drag: 0.05,
    defaultAim: { yawDeg: -12, pitchDeg: 22, power: 14 },
    solution: { yawDeg: -12, pitchDeg: 22, power: 14 },
    blocks: [
      { id: "wall-low", i: 0, j: 0, k: 5, kind: "wall" },
      { id: "wall-high", i: 0, j: 1, k: 5, kind: "wall" },
      { id: "left", i: -2, j: 0, k: 8, kind: "target" },
      { id: "right", i: 2, j: 0, k: 8, kind: "target" },
      { id: "far", i: 0, j: 0, k: 9, kind: "target" },
    ],
  },
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

export function targetsOf(level) {
  return level.blocks.filter((block) => block.kind === "target");
}

export function wallsOf(level) {
  return level.blocks.filter((block) => block.kind === "wall");
}
