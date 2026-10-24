// 레벨 8종 · 목표 색 · 최소 칠하기 횟수(par) · 채점. 순수 계산이다.
import {
  buildAdjacency,
  countComponents,
  expandBoxes,
  matchRate,
  surfaceVoxels,
} from "../../common/parts/paint3d.js";
import { MODELS, findPart } from "./objects.js";

export const COLORS = {
  빨강: 0xff6b5c,
  파랑: 0x6fc9ff,
  노랑: 0xffd76a,
  초록: 0x7fe08a,
  하양: 0xf2f5f8,
  보라: 0xc7a2ff,
  주황: 0xffa45b,
  검정: 0x3a3f4b,
};

export const UNPAINTED = 0xd8b48a;

const LEVELS = [
  {
    id: "p01",
    label: "로봇 얼굴",
    models: [{ name: "robot", offset: [0, 0, 0] }],
    parts: ["r-head", "r-eyes", "r-mouth"],
    palette: ["빨강", "하양", "노랑", "파랑"],
    target: { "r-head": "빨강", "r-eyes": "하양", "r-mouth": "노랑" },
  },
  {
    id: "p02",
    label: "로봇 전체",
    models: [{ name: "robot", offset: [0, 0, 0] }],
    parts: ["r-head", "r-eyes", "r-mouth", "r-body", "r-arms", "r-legs"],
    palette: ["빨강", "파랑", "초록", "노랑", "하양"],
    target: {
      "r-head": "빨강",
      "r-eyes": "하양",
      "r-mouth": "노랑",
      "r-body": "파랑",
      "r-arms": "초록",
      "r-legs": "노랑",
    },
  },
  {
    id: "p03",
    label: "색을 바꿔 로봇",
    models: [{ name: "robot", offset: [0, 0, 0] }],
    parts: ["r-head", "r-eyes", "r-mouth", "r-body", "r-arms", "r-legs"],
    palette: ["보라", "하양", "초록", "파랑", "빨강"],
    target: {
      "r-head": "보라",
      "r-eyes": "하양",
      "r-mouth": "초록",
      "r-body": "파랑",
      "r-arms": "빨강",
      "r-legs": "초록",
    },
    done: ["r-eyes"],
  },
  {
    id: "p04",
    label: "버섯",
    models: [{ name: "mushroom", offset: [0, 0, 0] }],
    parts: ["m-cap", "m-spots", "m-stem"],
    palette: ["빨강", "하양", "노랑", "초록"],
    target: { "m-cap": "빨강", "m-spots": "하양", "m-stem": "노랑" },
  },
  {
    id: "p05",
    label: "자동차",
    models: [{ name: "car", offset: [0, 0, 0] }],
    parts: ["c-body", "c-cabin", "c-window", "c-wheels"],
    palette: ["빨강", "파랑", "하양", "검정", "노랑"],
    target: {
      "c-body": "빨강",
      "c-cabin": "파랑",
      "c-window": "하양",
      "c-wheels": "검정",
    },
  },
  {
    id: "p06",
    label: "우주선",
    models: [{ name: "rocket", offset: [0, 0, 0] }],
    parts: ["k-body", "k-nose", "k-window", "k-fins", "k-flame"],
    palette: ["하양", "빨강", "파랑", "주황", "노랑"],
    target: {
      "k-body": "하양",
      "k-nose": "빨강",
      "k-window": "파랑",
      "k-fins": "빨강",
      "k-flame": "주황",
    },
  },
  {
    id: "p07",
    label: "고양이",
    models: [{ name: "cat", offset: [0, 0, 0] }],
    parts: ["t-head", "t-ears", "t-body", "t-tail", "t-legs"],
    palette: ["주황", "하양", "검정", "노랑"],
    target: {
      "t-head": "주황",
      "t-ears": "주황",
      "t-body": "주황",
      "t-tail": "주황",
      "t-legs": "주황",
    },
    done: ["t-ears"],
  },
  {
    id: "p08",
    label: "최종 완성",
    models: [
      { name: "robot", offset: [0, 0, 0] },
      { name: "rocket", offset: [9, 0, 0] },
    ],
    parts: [
      "r-head",
      "r-eyes",
      "r-mouth",
      "r-body",
      "r-arms",
      "r-legs",
      "k-body",
      "k-nose",
      "k-window",
      "k-fins",
      "k-flame",
    ],
    palette: ["빨강", "파랑", "초록", "노랑", "하양", "주황"],
    target: {
      "r-head": "노랑",
      "r-eyes": "빨강",
      "r-mouth": "파랑",
      "r-body": "초록",
      "r-arms": "빨강",
      "r-legs": "파랑",
      "k-body": "하양",
      "k-nose": "빨강",
      "k-window": "파랑",
      "k-fins": "노랑",
      "k-flame": "주황",
    },
    done: ["r-legs", "k-flame"],
  },
];

/** 레벨의 복셀·인접 그래프·목표 색·시작 색을 만든다. */
export function buildLevel(level) {
  const boxes = [];
  for (const entry of level.models) {
    const model = MODELS[entry.name];
    if (!model) continue;
    const [dx, dy, dz] = entry.offset ?? [0, 0, 0];
    for (const part of model) {
      if (!level.parts.includes(part.id)) continue;
      for (const source of part.boxes) {
        boxes.push({
          partId: part.id,
          box: {
            x0: source.x0 + dx,
            y0: source.y0 + dy,
            z0: source.z0 + dz,
            x1: source.x1 + dx,
            y1: source.y1 + dy,
            z1: source.z1 + dz,
          },
        });
      }
    }
  }

  const { voxels, overlaps } = expandBoxes(boxes);
  const surface = surfaceVoxels(voxels);
  const adjacency = buildAdjacency(surface);

  const done = new Set(level.done ?? []);
  const target = new Map();
  const initial = new Map();
  for (const [key, voxel] of surface) {
    const name = level.target[voxel.partId];
    const color = COLORS[name] ?? UNPAINTED;
    target.set(key, color);
    if (done.has(voxel.partId)) {
      initial.set(key, color);
      continue;
    }
    // 시작 상태는 나무색이다. 조각마다 색이 다르면 어디가 어디인지 헷갈린다.
    initial.set(key, UNPAINTED);
  }

  let par = 0;
  for (const partId of level.parts) {
    if (done.has(partId)) continue;
    par += countComponents(surface, adjacency, partId);
  }

  return { voxels, surface, adjacency, target, initial, par, overlaps };
}

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function levelIndexById(id) {
  return LEVELS.findIndex((level) => level.id === id);
}

/** 목표 그림 문구. */
export function targetText(level) {
  const rows = [];
  for (const partId of level.parts) {
    const found = findPart(partId);
    if (!found) continue;
    rows.push(`${found.part.label} ${level.target[partId]}`);
  }
  return rows.join(" · ");
}

export function evaluatePaint(level, built, current, clicks) {
  const rate = matchRate({ current, target: built.target, surface: built.surface });
  const cleared = rate >= 0.999;
  let stars = 0;
  if (cleared) stars = clicks <= built.par ? 3 : 2;
  else if (rate >= 0.5) stars = 1;
  return {
    cleared,
    stars,
    score: stars * 100 + Math.round(rate * 50),
    rate,
    clicks,
    par: built.par,
  };
}

export { LEVELS };
