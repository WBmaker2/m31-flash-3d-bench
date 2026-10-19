const PREFIX = "m31-3d-bench:";
const VERSION = 1;

function store() {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function keyOf(gameId, key) {
  return `${PREFIX}${gameId}:${key}`;
}

export function loadState(gameId, key, fallback = null) {
  const target = store();
  if (!target) return fallback;
  try {
    const raw = target.getItem(keyOf(gameId, key));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    if (parsed.v !== VERSION) return fallback;
    return parsed.data === undefined ? fallback : parsed.data;
  } catch {
    return fallback;
  }
}

export function saveState(gameId, key, data) {
  const target = store();
  if (!target) return false;
  try {
    target.setItem(keyOf(gameId, key), JSON.stringify({ v: VERSION, data }));
    return true;
  } catch {
    return false;
  }
}

export function clearState(gameId, key) {
  const target = store();
  if (!target) return false;
  try {
    target.removeItem(keyOf(gameId, key));
    return true;
  } catch {
    return false;
  }
}

export function clearGame(gameId) {
  const target = store();
  if (!target) return false;
  try {
    const prefix = `${PREFIX}${gameId}:`;
    const keys = [];
    for (let i = 0; i < target.length; i += 1) {
      const name = target.key(i);
      if (name && name.startsWith(prefix)) keys.push(name);
    }
    for (const name of keys) target.removeItem(name);
    return true;
  } catch {
    return false;
  }
}

export function isStorageAvailable() {
  const target = store();
  if (!target) return false;
  try {
    const probe = keyOf("probe", "probe");
    target.setItem(probe, "1");
    target.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export const STORAGE_VERSION = VERSION;
