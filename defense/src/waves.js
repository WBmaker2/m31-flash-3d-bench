export const WAVES = [
  { groups: [{ type: "basic", count: 8, interval: 0.85 }] },
  { groups: [{ type: "basic", count: 10, interval: 0.6 }, { type: "fast", count: 4, interval: 0.55 }] },
  { groups: [{ type: "basic", count: 8, interval: 0.5 }, { type: "tank", count: 3, interval: 1.3 }] },
  { groups: [{ type: "fast", count: 12, interval: 0.35 }, { type: "tank", count: 4, interval: 1.1 }] },
  { groups: [{ type: "boss", count: 1, interval: 1 }, { type: "basic", count: 12, interval: 0.45 }] },
  { groups: [{ type: "fast", count: 16, interval: 0.3 }, { type: "tank", count: 6, interval: 1 }] },
  { groups: [{ type: "tank", count: 8, interval: 0.9 }, { type: "boss", count: 1, interval: 1 }] },
  { groups: [{ type: "boss", count: 2, interval: 1.4 }, { type: "fast", count: 20, interval: 0.26 }] },
];

export const DIFFICULTIES = [
  { id: "easy", label: "쉬움", gold: 400, lives: 30, waves: 4, hpScale: 0.7, description: "생명 30 · 웨이브 4 · 약한 적" },
  { id: "normal", label: "보통", gold: 250, lives: 20, waves: 5, hpScale: 1, description: "생명 20 · 웨이브 5 · 기본 적" },
  { id: "hard", label: "어려움", gold: 220, lives: 15, waves: 8, hpScale: 1.35, description: "생명 15 · 웨이브 8 · 강한 적" },
];

export function wavesFor(difficulty) {
  return WAVES.slice(0, difficulty.waves);
}

export function scoreFor({ kills, livesLeft, lives, wavesCleared }) {
  const lifeRatio = lives > 0 ? livesLeft / lives : 0;
  const waveBonus = wavesCleared * 500;
  const killBonus = kills * 10;
  const lifeBonus = Math.round(lifeRatio * lives * 20);
  return Math.max(0, waveBonus + killBonus + lifeBonus);
}

export function starsFor({ won, livesLeft, lives }) {
  if (!won) return livesLeft > 0 ? 1 : 0;
  const ratio = lives > 0 ? livesLeft / lives : 0;
  if (ratio >= 0.99) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

export function buildSpawnQueue(wave) {
  const queue = [];
  let time = 0;
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i += 1) {
      queue.push({ type: group.type, time });
      time += group.interval;
    }
  }
  return queue;
}

export function waveEnemyCount(wave) {
  return wave.groups.reduce((sum, group) => sum + group.count, 0);
}
