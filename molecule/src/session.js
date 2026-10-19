export const LEVELS = [
  {
    id: "basic",
    label: "기초 분자",
    targets: ["water", "ammonia", "methane"],
    timeLimit: 90,
    wrongPenalty: 0,
    description: "물·암모니아·메테인 세 분자를 맞춰 보세요.",
  },
  {
    id: "advanced",
    label: "심화 분자",
    targets: ["water", "ammonia", "methane", "co2", "hydrogen", "nitrogen", "oxygen"],
    timeLimit: 140,
    wrongPenalty: 5,
    description: "일곱 분자를 연속으로. 틀리면 5초가 줄어듭니다.",
  },
];

export function createSession(level) {
  let index = 0;
  let score = 0;
  let streak = 0;
  let timeLeft = level.timeLimit;
  let wrong = 0;

  return {
    level,
    get index() {
      return index;
    },
    get total() {
      return level.targets.length;
    },
    get score() {
      return score;
    },
    get streak() {
      return streak;
    },
    get timeLeft() {
      return timeLeft;
    },
    get wrong() {
      return wrong;
    },
    get current() {
      return level.targets[index] ?? null;
    },
    get finished() {
      return index >= level.targets.length;
    },
    answer(correct) {
      if (this.finished) return { accepted: false, finished: true };
      if (correct) {
        score += 100 + streak * 20;
        streak += 1;
      } else {
        streak = 0;
        wrong += 1;
        timeLeft = Math.max(0, timeLeft - level.wrongPenalty);
      }
      index += 1;
      return { accepted: true, finished: this.finished, correct };
    },
    tick(seconds) {
      timeLeft = Math.max(0, timeLeft - seconds);
      return timeLeft;
    },
    timeBonus() {
      return Math.max(0, Math.round(timeLeft * 10));
    },
    stars() {
      if (wrong === 0 && this.finished) return 3;
      if (wrong <= 1 && this.finished) return 2;
      return this.finished ? 1 : 0;
    },
  };
}
