// 레벨 8종과 그림 비교. 순수 계산이라 Node 에서 그대로 테스트된다.
import { comparePicture, pictureColors } from "../../common/parts/draw3d.js";

export const COLORS = {
  R: 0xff6b5c,
  Y: 0xffd76a,
  G: 0x7fe08a,
  B: 0x6fc9ff,
  P: 0xc7a2ff,
  O: 0xffa45b,
  W: 0xf2f5f8,
  K: 0x3a3f4b,
};

export const LEVELS = [
  {
    id: "d01",
    label: "하트",
    hint: "목표 그림을 보고 큐브로 그려 보세요.",
    rows: ["..RR..", ".RRRR.", "RRRRRR", "RRRRRR", ".RRRR.", "..RR.."],
  },
  {
    id: "d02",
    label: "해바라기",
    hint: "꽃잎과 가운데를 다르게 칠해 보세요.",
    rows: ["..YYYY..", ".YRRRRY.", "YRROORRY", "YRROORRY", "YRROORRY", "YRROORRY", ".YRRRRY.", "..YYYY.."],
  },
  {
    id: "d03",
    label: "집",
    hint: "지붕과 벽과 문을 나눠서 칠해 보세요.",
    rows: ["....RR....", "..RRRRRR..", ".RRRRRRRR.", "RRRRRRRRRR", "WWWWWWWWWW", "WWWWWWWWWW", "WWWKWWKWWW", "WWWKWWKWWW"],
  },
  {
    id: "d04",
    label: "나무",
    hint: "잎과 줄기를 다른 색으로 칠해 보세요.",
    rows: ["...GGGG...", "..GGGGGG..", ".GGGGGGGG.", "GGGGGGGGGG", "..GGGGGG..", "...GGGG...", "....TT....", "....TT...."],
  },
  {
    id: "d05",
    label: "고양이",
    hint: "귀와 몸을 구분해 보세요.",
    rows: ["O..O....O.", "O..O....O.", ".OO.OO.OO.", "..OOOOOO..", "..OWOWWO..", "..OOOOOO..", ".OOOOOOOO.", "..OOOOOO.."],
  },
  {
    id: "d06",
    label: "우주선",
    hint: "불꽃까지 챙겨 보세요.",
    rows: ["....WW....", "...WWWW...", "..WBBBW...", "..WBBBW...", "..WBBBW...", "...RRRR...", "....RR....", "...OOOO..."],
  },
  {
    id: "d07",
    label: "꽃",
    hint: "꽃잎과 가운데를 나눠 보세요.",
    rows: ["..PPPP..", ".PPPPPP.", "PPPPPPPP", ".PPPPPP.", "..YYYY..", "...YY...", "...YY...", "........"],
  },
  {
    id: "d08",
    label: "별",
    hint: "마지막 그림이에요. 조심해서 칠해 보세요.",
    rows: ["....Y....", "...YYY...", "YYYYYYYYY", "..YYYYY..", ".YYYYYYY.", "..YYYYY..", "...YYY...", "....Y...."],
  },
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function levelIndexById(id) {
  return LEVELS.findIndex((level) => level.id === id);
}

export function levelColors(level) {
  return pictureColors(level.rows).map((key) => {
    const color = COLORS[key] ?? 0xcccccc;
    return { key, color, css: `#${color.toString(16).padStart(6, "0")}` };
  });
}

export function evaluateLevel(level, placement) {
  const result = comparePicture({ rows: level.rows, placement });
  let stars = 0;
  if (result.rate >= 0.999 && result.extra === 0) stars = 3;
  else if (result.rate >= 0.999) stars = 2;
  else if (result.rate >= 0.5) stars = 1;
  return {
    ...result,
    cleared: result.rate >= 0.999,
    stars,
    score: stars * 100 + Math.round(result.rate * 50),
  };
}

export { LEVELS as DRAW_LEVELS };
