import { SPECIES_ORDER } from "./species.js";

export const POSES = ["idle", "walk"];
export const POSE_LABEL = { idle: "가만히", walk: "걷기" };

export function dexKey(species, pose) {
  return `${species}:${pose}`;
}

export function createDex() {
  const found = new Set();

  return {
    register(species, pose) {
      if (!POSES.includes(pose)) return false;
      const key = dexKey(species, pose);
      if (found.has(key)) return false;
      found.add(key);
      return true;
    },
    has(species, pose) {
      return found.has(dexKey(species, pose));
    },
    count() {
      return found.size;
    },
    total() {
      return SPECIES_ORDER.length * POSES.length;
    },
    ratio() {
      return found.size / (SPECIES_ORDER.length * POSES.length);
    },
    entries() {
      return SPECIES_ORDER.flatMap((species) =>
        POSES.map((pose) => ({
          species,
          pose,
          found: found.has(dexKey(species, pose)),
        })),
      );
    },
  };
}

export const FIND_LEVELS = [
  { id: "easy", label: "느긋하게", rounds: 3, timeLimit: 12, wrongPenalty: 2 },
  { id: "normal", label: "보통", rounds: 5, timeLimit: 9, wrongPenalty: 3 },
  { id: "hard", label: "빠르게", rounds: 8, timeLimit: 6, wrongPenalty: 4 },
];

export function createFinder(level, speciesOrder = SPECIES_ORDER) {
  const queue = [];
  for (let index = 0; index < level.rounds; index += 1) {
    queue.push(speciesOrder[(index * 3 + 1) % speciesOrder.length]);
  }
  let index = 0;
  let score = 0;
  let streak = 0;

  return {
    level,
    queue,
    get current() {
      return queue[index] ?? null;
    },
    get index() {
      return index;
    },
    get score() {
      return score;
    },
    get streak() {
      return streak;
    },
    get finished() {
      return index >= queue.length;
    },
    answer(species) {
      if (this.finished) return { correct: false, done: true };
      const correct = species === this.current;
      if (correct) {
        streak += 1;
        score += 100 + streak * 20;
        index += 1;
      } else {
        streak = 0;
      }
      return { correct, done: this.finished, remaining: this.queue.length - index };
    },
    timeBonus(secondsLeft) {
      return Math.max(0, Math.round(secondsLeft * 25));
    },
  };
}
