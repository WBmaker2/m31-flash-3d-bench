// 레벨 8종과 미션 판정. 순수 계산이라 Node 에서 그대로 테스트된다.
import {
  INPUT_REV_PER_SEC,
  SPEED_TOLERANCE,
  canPlaceAt,
  overlappingPairs,
  propagateRotation,
} from "../../common/parts/gear3d.js";

const LEVELS = [
  {
    id: "g01",
    label: "첫 톱니",
    hint: "크랭크 톱니바퀴 옆에 톱니바퀴를 하나 끼워 보세요.",
    crank: { slot: "c", teeth: 12 },
    slots: [
      { id: "c", x: 0, z: 0 },
      { id: "s1", x: 0.2, z: 0 },
    ],
    palette: [8, 12, 16],
    mission: { slot: "s1", revPerSec: 1.5, tolerance: SPEED_TOLERANCE, direction: "opposite" },
    par: 1,
    reference: [{ slot: "s1", teeth: 8 }],
  },
  {
    id: "g02",
    label: "느린 톱니",
    hint: "톱니가 많을수록 느리게 돌아요. 두 칸을 이어 보세요.",
    crank: { slot: "c", teeth: 8 },
    slots: [
      { id: "c", x: 0, z: 0 },
      { id: "s1", x: 0.2, z: 0 },
      { id: "s2", x: 0.48, z: 0 },
    ],
    palette: [8, 12, 16, 20, 24],
    mission: { slot: "s2", revPerSec: 0.5, tolerance: SPEED_TOLERANCE, direction: "same" },
    par: 2,
    reference: [
      { slot: "s1", teeth: 12 },
      { slot: "s2", teeth: 16 },
    ],
  },
  {
    id: "g03",
    label: "3배 속도",
    hint: "작은 톱니바퀴를 크랭크 바로 옆에 끼워 보세요.",
    crank: { slot: "c", teeth: 24 },
    slots: [
      { id: "c", x: 0, z: 0 },
      { id: "s1", x: 0.32, z: 0 },
      { id: "s2", x: 0.64, z: 0 },
    ],
    palette: [8, 12, 16, 20, 24],
    mission: { slot: "s1", revPerSec: 3, tolerance: SPEED_TOLERANCE, direction: "opposite" },
    par: 1,
    reference: [{ slot: "s1", teeth: 8 }],
  },
  {
    id: "g04",
    label: "어느 길로",
    hint: "두 칸이 너무 가까워서 한 칸에만 톱니바퀴를 끼울 수 있어요.",
    crank: { slot: "c", teeth: 12 },
    slots: [
      { id: "c", x: 0, z: 0 },
      { id: "a", x: 0.2, z: 0 },
      { id: "b", x: 0.24, z: 0 },
      { id: "m", x: 0.44, z: 0 },
    ],
    palette: [8, 12, 16, 20],
    mission: { slot: "m", revPerSec: 1.5, tolerance: SPEED_TOLERANCE, direction: "same" },
    par: 2,
    reference: [
      { slot: "b", teeth: 12 },
      { slot: "m", teeth: 8 },
    ],
  },
  {
    id: "g05",
    label: "같은 방향",
    hint: "두 번 이어지면 처음과 같은 방향으로 돌아요.",
    crank: { slot: "c", teeth: 12 },
    slots: [
      { id: "c", x: 0, z: 0 },
      { id: "s1", x: 0.2, z: 0 },
      { id: "s2", x: 0.44, z: 0 },
    ],
    palette: [8, 12, 16, 20],
    mission: { slot: "s2", revPerSec: 0.75, tolerance: SPEED_TOLERANCE, direction: "same" },
    par: 2,
    reference: [
      { slot: "s1", teeth: 8 },
      { slot: "s2", teeth: 16 },
    ],
  },
  {
    id: "g06",
    label: "세 번 연결",
    hint: "세 번 이어지면 처음과 반대 방향으로 돌아요.",
    crank: { slot: "c", teeth: 12 },
    slots: [
      { id: "c", x: 0, z: 0 },
      { id: "s1", x: 0.2, z: 0 },
      { id: "s2", x: 0.44, z: 0 },
      { id: "s3", x: 0.68, z: 0 },
    ],
    palette: [8, 12, 16, 20, 24],
    mission: { slot: "s3", revPerSec: 1.5, tolerance: SPEED_TOLERANCE, direction: "opposite" },
    par: 3,
    reference: [
      { slot: "s1", teeth: 8 },
      { slot: "s2", teeth: 16 },
      { slot: "s3", teeth: 8 },
    ],
  },
  {
    id: "g07",
    label: "고리 잠금",
    hint: "톱니바퀴 세 개가 고리를 만들면 서로 잠겨요. 두 개만으로 돌려 보세요.",
    crank: { slot: "c", teeth: 16 },
    slots: [
      { id: "c", x: 0, z: 0 },
      { id: "m", x: 0.32, z: 0 },
      { id: "n", x: 0.16, z: Math.sqrt(0.032) },
    ],
    palette: [8, 12, 16, 20, 24],
    mission: { slot: "m", revPerSec: 1, tolerance: SPEED_TOLERANCE, direction: "opposite" },
    par: 1,
    reference: [{ slot: "m", teeth: 16 }],
  },
  {
    id: "g08",
    label: "바람개비",
    hint: "길게 잇고 미션 톱니바퀴 위에 바람개비를 세워 보세요.",
    crank: { slot: "c", teeth: 24 },
    slots: [
      { id: "c", x: 0, z: 0 },
      { id: "s1", x: 0.36, z: 0 },
      { id: "s2", x: 0.6, z: 0 },
      { id: "s3", x: 0.84, z: 0 },
    ],
    palette: [8, 12, 16, 20, 24],
    mission: { slot: "s3", revPerSec: 2, tolerance: SPEED_TOLERANCE, direction: "opposite" },
    par: 3,
    reference: [
      { slot: "s1", teeth: 12 },
      { slot: "s2", teeth: 12 },
      { slot: "s3", teeth: 12 },
    ],
  },
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function levelIndexById(id) {
  return LEVELS.findIndex((level) => level.id === id);
}

export function slotById(level, slotId) {
  return level.slots.find((slot) => slot.id === slotId) ?? null;
}

/** 크랭크와 놓인 톱니바퀴를 노드로 만든다. */
export function buildNodes(level, assignment) {
  const crankSlot = slotById(level, level.crank.slot);
  const nodes = [
    {
      id: level.crank.slot,
      teeth: level.crank.teeth,
      x: crankSlot.x,
      z: crankSlot.z,
    },
  ];
  for (const item of assignment ?? []) {
    const slot = slotById(level, item.slot);
    if (!slot) continue;
    nodes.push({ id: slot.id, teeth: item.teeth, x: slot.x, z: slot.z });
  }
  return nodes;
}

/** 이 배치에서 어떤 톱니바퀴끼리 겹치는가. */
export function assignmentOverlaps(level, assignment) {
  return overlappingPairs(buildNodes(level, assignment));
}

/** 이 자리에 이 크기의 톱니바퀴를 끼울 수 있는가. */
export function canPlace(level, assignment, slotId, teeth) {
  const slot = slotById(level, slotId);
  if (!slot) return false;
  return canPlaceAt(buildNodes(level, assignment), slot, teeth);
}

function directionOf(ratio) {
  if (ratio > 0) return "same";
  if (ratio < 0) return "opposite";
  return "none";
}

export function evaluateMission(level, assignment = []) {
  const nodes = buildNodes(level, assignment);
  const { ratio, omega, conflicts } = propagateRotation({
    nodes,
    inputId: level.crank.slot,
    inputOmega: INPUT_REV_PER_SEC,
  });

  const missionId = level.mission.slot;
  const speed = missionId && omega.has(missionId) ? Math.abs(omega.get(missionId)) : 0;
  const direction = missionId && ratio.has(missionId) ? directionOf(ratio.get(missionId)) : "none";
  const used = assignment.length;
  const overlaps = assignmentOverlaps(level, assignment).length;

  const speedOk = speed > 0 && Math.abs(speed - level.mission.revPerSec) <= level.mission.tolerance;
  const directionOk = direction === level.mission.direction;
  const broken = conflicts.length > 0;
  const cleared = speedOk && directionOk && !broken && overlaps === 0;

  let stars = 0;
  if (cleared) stars = used <= level.par ? 3 : 2;
  else if (speedOk && !broken) stars = 1;

  return {
    cleared,
    stars,
    score: stars * 100,
    speed,
    direction,
    directionOk,
    speedOk,
    used,
    par: level.par,
    conflicts,
    overlaps,
    broken,
  };
}

/** 모든 배치를 열거한다. par(최소 기어 수) 검증과 레벨 검증에 쓴다. */
export function enumerateOutcomes(level) {
  const freeSlots = level.slots.filter((slot) => slot.id !== level.crank.slot);
  const choices = [null, ...level.palette];
  const outcomes = [];

  const walk = (index, assignment) => {
    if (index === freeSlots.length) {
      const result = evaluateMission(level, assignment);
      outcomes.push({ assignment: assignment.map((item) => ({ ...item })), result });
      return;
    }
    const slot = freeSlots[index];
    for (const teeth of choices) {
      if (teeth !== null && !canPlace(level, assignment, slot.id, teeth)) continue;
      const next = teeth === null ? assignment : [...assignment, { slot: slot.id, teeth }];
      walk(index + 1, next);
    }
  };
  walk(0, []);
  return outcomes;
}

/** 미션을 달성하는 최소 기어 수. */
export function minimumGears(level) {
  const outcomes = enumerateOutcomes(level);
  const cleared = outcomes.filter((entry) => entry.result.cleared);
  if (cleared.length === 0) return Infinity;
  return Math.min(...cleared.map((entry) => entry.result.used));
}

/** 미션 문구. */
export function missionText(level) {
  const direction = level.mission.direction === "same" ? "크랭크와 같은 방향" : "크랭크와 반대 방향";
  return `미션 톱니바퀴가 초당 ${level.mission.revPerSec}바퀴, ${direction}`;
}

export { LEVELS };
