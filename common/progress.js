import { clearGame, loadState, saveState } from "./storage.js";

function emptyLevelState() {
  return { unlocked: false, stars: 0, bestScore: 0, bestTimeMs: null, attempts: 0 };
}

export function createProgress(gameId, options = {}) {
  const levels = options.levels ?? [];
  const storageKey = options.storageKey ?? "progress";

  const shape = {};
  levels.forEach((level, index) => {
    shape[level.id] = { ...emptyLevelState(), unlocked: index === 0 };
  });

  const stored = loadState(gameId, storageKey, null);
  const state = {};
  for (const level of levels) {
    const saved = stored?.[level.id];
    state[level.id] = saved
      ? {
          unlocked: Boolean(saved.unlocked),
          stars: Number(saved.stars) || 0,
          bestScore: Number(saved.bestScore) || 0,
          bestTimeMs: typeof saved.bestTimeMs === "number" ? saved.bestTimeMs : null,
          attempts: Number(saved.attempts) || 0,
        }
      : shape[level.id];
  }

  function persist() {
    saveState(gameId, storageKey, state);
  }

  return {
    levels,
    state,
    levelState(levelId) {
      return state[levelId] ?? null;
    },
    isUnlocked(levelId) {
      return Boolean(state[levelId]?.unlocked);
    },
    unlockedCount() {
      return levels.filter((level) => state[level.id]?.unlocked).length;
    },
    starsTotal() {
      return levels.reduce((sum, level) => sum + (state[level.id]?.stars ?? 0), 0);
    },
    record(levelId, result = {}) {
      const current = state[levelId];
      if (!current) return { improved: false, unlocked: [] };

      const stars = Math.max(0, Math.min(3, Number(result.stars) || 0));
      const score = Number(result.score) || 0;
      const timeMs = typeof result.timeMs === "number" ? result.timeMs : null;

      const before = { ...current };
      if (stars > current.stars) current.stars = stars;
      if (score > current.bestScore) current.bestScore = score;
      if (timeMs !== null && (current.bestTimeMs === null || timeMs < current.bestTimeMs)) {
        current.bestTimeMs = timeMs;
      }
      current.attempts += 1;

      const improved =
        current.stars > before.stars ||
        current.bestScore > before.bestScore ||
        (current.bestTimeMs !== null && current.bestTimeMs < before.bestTimeMs);

      const unlocked = [];
      const index = levels.findIndex((level) => level.id === levelId);
      if (index >= 0 && index + 1 < levels.length) {
        const nextId = levels[index + 1].id;
        if (!state[nextId].unlocked && current.stars >= 1) {
          state[nextId].unlocked = true;
          unlocked.push(nextId);
        }
      }

      persist();
      return { improved, unlocked };
    },
    reset() {
      for (const level of levels) {
        const index = levels.findIndex((entry) => entry.id === level.id);
        state[level.id] = { ...emptyLevelState(), unlocked: index === 0 };
      }
      persist();
    },
    clearAll() {
      clearGame(gameId);
    },
  };
}

export function starsFor({ accuracy = 1, timeRatio = 1, par = 1, used = 1 }) {
  if (accuracy >= 0.99 && used <= par && timeRatio >= 0.6) return 3;
  if (accuracy >= 0.8 && used <= par + 2) return 2;
  if (accuracy > 0) return 1;
  return 0;
}
