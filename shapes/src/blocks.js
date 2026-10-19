export const BLOCKS = {
  cube: {
    id: "cube",
    label: "정육면체",
    cells: [[0, 0, 0]],
    color: 0xe0a94a,
  },
  bar2: {
    id: "bar2",
    label: "막대 2칸",
    cells: [
      [0, 0, 0],
      [1, 0, 0],
    ],
    color: 0xd08a3a,
  },
  bar3: {
    id: "bar3",
    label: "막대 3칸",
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ],
    color: 0xc9762f,
  },
  square2x2: {
    id: "square2x2",
    label: "2×2 판",
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
    ],
    color: 0xb9622a,
  },
  cube2x2x2: {
    id: "cube2x2x2",
    label: "큰 정육면체",
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [0, 0, 1],
      [1, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
    ],
    color: 0xa84f26,
  },
  corner3: {
    id: "corner3",
    label: "모서리",
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
    color: 0xd9b455,
  },
  tee4: {
    id: "tee4",
    label: "T자",
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [1, 0, 1],
    ],
    color: 0xc9a044,
  },
  step4: {
    id: "step4",
    label: "계단",
    cells: [
      [1, 0, 0],
      [2, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
    ],
    color: 0xb98b3c,
  },
};

export const BLOCK_ORDER = ["cube", "bar2", "bar3", "square2x2", "cube2x2x2", "corner3", "tee4", "step4"];
