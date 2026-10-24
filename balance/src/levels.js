// 레벨 8종과 미션 판정. 순수 계산이라 Node 에서 그대로 테스트된다.
import { evaluateBalance, findSolution, minimumWeights } from "../../common/parts/balance3d.js";

const SLOT_X = [-0.44, -0.33, -0.22, -0.11, 0, 0.11, 0.22, 0.33, 0.44];

function slots() {
  return SLOT_X.map((x, index) => ({ id: `s${index}`, index, x }));
}

const LEVELS = [
  {
    id: "b01",
    label: "첫 균형",
    hint: "같은 거리에 같은 무게로 놓으면 수평이 돼요.",
    fulcrumSlot: 4,
    masses: [1, 2, 3, 5],
    targetMass: 4,
    par: 2,
    reference: [
      { slot: "s3", mass: 2 },
      { slot: "s5", mass: 2 },
    ],
  },
  {
    id: "b02",
    label: "무거운 쪽",
    hint: "무게를 나눠서 양쪽에 놓아 보세요.",
    fulcrumSlot: 4,
    masses: [1, 2, 3, 5],
    targetMass: 6,
    par: 2,
    reference: [
      { slot: "s3", mass: 3 },
      { slot: "s5", mass: 3 },
    ],
  },
  {
    id: "b03",
    label: "한쪽으로",
    hint: "받침대가 가운데가 아니에요. 팔 길이를 계산해 보세요.",
    fulcrumSlot: 3,
    masses: [1, 2, 3, 5],
    targetMass: 6,
    par: 2,
    reference: [
      { slot: "s2", mass: 3 },
      { slot: "s4", mass: 3 },
    ],
  },
  {
    id: "b04",
    label: "긴 팔",
    hint: "받침대에서 먼 쪽에 놓으면 더 세게 당깁니다.",
    fulcrumSlot: 2,
    masses: [1, 2, 3, 5],
    targetMass: 8,
    par: 3,
    reference: [
      { slot: "s1", mass: 5 },
      { slot: "s3", mass: 1 },
      { slot: "s4", mass: 2 },
    ],
  },
  {
    id: "b05",
    label: "큰 추",
    hint: "이 저울에는 큰 추만 있어요.",
    fulcrumSlot: 4,
    masses: [2, 3, 5],
    targetMass: 10,
    par: 2,
    reference: [
      { slot: "s3", mass: 5 },
      { slot: "s5", mass: 5 },
    ],
  },
  {
    id: "b06",
    label: "가운데 저울",
    hint: "받침대가 오른쪽에 있어요.",
    fulcrumSlot: 5,
    masses: [1, 2, 3, 5],
    targetMass: 9,
    par: 3,
    reference: [
      { slot: "s4", mass: 5 },
      { slot: "s6", mass: 3 },
      { slot: "s7", mass: 1 },
    ],
  },
  {
    id: "b07",
    label: "큰 저울",
    hint: "무거운 것들만으로 수평을 만들어 보세요.",
    fulcrumSlot: 2,
    masses: [2, 3, 5],
    targetMass: 12,
    par: 4,
    reference: [
      { slot: "s0", mass: 2 },
      { slot: "s1", mass: 5 },
      { slot: "s3", mass: 3 },
      { slot: "s5", mass: 2 },
    ],
  },
  {
    id: "b08",
    label: "최종 저울",
    hint: "무게도 맞고 수평도 맞추면 3성이에요.",
    fulcrumSlot: 4,
    masses: [1, 2, 3, 5],
    targetMass: 12,
    par: 4,
    reference: [
      { slot: "s2", mass: 1 },
      { slot: "s3", mass: 5 },
      { slot: "s5", mass: 5 },
      { slot: "s6", mass: 1 },
    ],
  },
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function levelIndexById(id) {
  return LEVELS.findIndex((level) => level.id === id);
}

/** 레벨의 홈 목록과 받침대 위치. */
export function levelGeometry(level) {
  const all = slots();
  const fulcrumX = all[level.fulcrumSlot].x;
  return {
    slots: all,
    fulcrumX,
    fulcrumSlot: level.fulcrumSlot,
    blocked: level.fulcrumSlot,
  };
}

/** 놓인 추를 계산용 모양으로 바꾼다. */
export function toWeights(geometry, placement) {
  return placement.map((item) => {
    const slot = geometry.slots.find((entry) => entry.id === item.slot);
    return { slot: item.slot, x: slot.x, mass: item.mass };
  });
}

export function evaluateLevel(level, placement) {
  const geometry = levelGeometry(level);
  const weights = toWeights(geometry, placement);
  const result = evaluateBalance({
    weights,
    fulcrumX: geometry.fulcrumX,
    targetMass: level.targetMass,
    blockedSlot: level.fulcrumSlot,
  });
  const used = placement.length;
  let stars = 0;
  if (result.cleared) stars = used <= level.par ? 3 : 2;
  else if ((result.level && result.totalMass > 0) || result.massOk) stars = 1;
  return {
    ...result,
    used,
    par: level.par,
    stars,
    score: stars * 100,
  };
}

export function levelPar(level) {
  const geometry = levelGeometry(level);
  return minimumWeights({
    slots: geometry.slots,
    masses: level.masses,
    fulcrumX: geometry.fulcrumX,
    targetMass: level.targetMass,
    blockedSlot: level.fulcrumSlot,
  });
}

export function levelSolution(level) {
  const geometry = levelGeometry(level);
  const found = findSolution({
    slots: geometry.slots,
    masses: level.masses,
    fulcrumX: geometry.fulcrumX,
    targetMass: level.targetMass,
    blockedSlot: level.fulcrumSlot,
  });
  if (!found) return null;
  return found.map((item) => ({ slot: geometry.slots[item.slot].id, mass: item.mass }));
}

export function missionText(level) {
  return `무게 ${level.targetMass}kg · 수평으로 맞추세요`;
}

export { LEVELS };
