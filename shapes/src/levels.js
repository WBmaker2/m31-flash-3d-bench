function box(x0, x1, y0, y1, z0, z1) {
  const cells = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      for (let z = z0; z <= z1; z += 1) {
        cells.push([x, y, z]);
      }
    }
  }
  return cells;
}

export const LEVELS = [
  {
    id: "corners",
    label: "네 모서리",
    hint: "네 칸을 정육면체로 채워 보세요.",
    target: box(0, 1, 0, 0, 0, 1),
    blocks: ["cube", "cube", "cube", "cube"],
    par: 4,
  },
  {
    id: "plate",
    label: "판자 하나로",
    hint: "아까와 같은 모양입니다. 이번엔 판자 하나로 채워 보세요.",
    target: box(0, 1, 0, 0, 0, 1),
    blocks: ["square2x2", "cube", "cube"],
    par: 1,
  },
  {
    id: "bar",
    label: "긴 막대",
    hint: "막대를 돌려 길게 눕혀 보세요.",
    target: box(0, 2, 0, 0, 0, 0),
    blocks: ["bar3", "cube", "cube", "cube"],
    par: 1,
  },
  {
    id: "corner",
    label: "모서리",
    hint: "모서리 모양은 어느 방향으로 돌려야 할까요?",
    target: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
    blocks: ["corner3", "cube", "cube", "cube"],
    par: 1,
  },
  {
    id: "bigbox",
    label: "큰 상자",
    hint: "여덟 칸을 큰 정육면체 하나로 채워 보세요.",
    target: box(0, 1, 0, 1, 0, 1),
    blocks: ["cube2x2x2", "cube", "cube"],
    par: 1,
  },
  {
    id: "tee",
    label: "T자",
    hint: "T자 모양을 맞추려면 막대를 어느 방향으로 놓아야 할까요?",
    target: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [1, 0, 1],
    ],
    blocks: ["tee4", "cube", "cube", "cube", "cube"],
    par: 1,
  },
  {
    id: "twolines",
    label: "두 줄",
    hint: "막대 두 개가 필요해요. 하나는 쓸모없습니다.",
    target: [
      ...box(0, 2, 0, 0, 0, 0),
      ...box(0, 2, 1, 1, 0, 0),
    ],
    blocks: ["bar3", "bar3", "square2x2"],
    par: 2,
  },
  {
    id: "tower",
    label: "탑",
    hint: "맨 위에 막대를 올리면 탑이 됩니다.",
    target: [
      ...box(0, 1, 0, 1, 0, 1),
      ...box(0, 2, 2, 2, 0, 0),
    ],
    blocks: ["cube2x2x2", "bar3", "bar3"],
    par: 2,
  },
  {
    id: "cross",
    label: "십자",
    hint: "막대 하나와 정육면체 둘로 십자를 만드세요.",
    target: [
      [1, 0, 0],
      [0, 0, 0],
      [2, 0, 0],
      [1, 0, 1],
      [1, 0, 2],
    ],
    blocks: ["bar3", "cube", "cube"],
    par: 3,
  },
  {
    id: "stairs",
    label: "계단",
    hint: "계단 블록 하나와 정육면체 둘로 계단을 만드세요.",
    target: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
      [2, 0, 2],
    ],
    blocks: ["step4", "cube", "cube"],
    par: 3,
  },
  {
    id: "pillar",
    label: "기둥",
    hint: "큰 정육면체 위에 2×2 판을 얹으면 두 층짜리 기둥이 돼요.",
    target: [
      ...box(0, 1, 0, 1, 0, 1),
      ...box(0, 1, 2, 2, 0, 1),
    ],
    blocks: ["cube2x2x2", "square2x2", "square2x2"],
    par: 3,
  },
  {
    id: "castle",
    label: "성",
    hint: "가운데 큰 상자, 위쪽 막대, 옆쪽 모서리 하나씩.",
    target: [
      ...box(0, 1, 0, 1, 0, 1),
      ...box(0, 2, 2, 2, 0, 0),
      [2, 0, 0],
      [2, 0, 1],
      [2, 1, 0],
    ],
    blocks: ["cube2x2x2", "bar3", "corner3"],
    par: 3,
  },
];

export const GRID_SIZE = 3;
