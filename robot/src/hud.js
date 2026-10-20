// 화면(HTML) 연결. 상태를 화면에 그리고, 조작을 콜백으로 되돌린다.

export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    statError: document.getElementById("stat-error"),
    statReach: document.getElementById("stat-reach"),
    statTries: document.getElementById("stat-tries"),
    statState: document.getElementById("stat-state"),
    status: document.getElementById("status-line"),
    btnRetry: document.getElementById("btn-retry"),
    btnLevels: document.getElementById("btn-levels"),
  };

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint;
  }

  function setStatus({ error, reach, tries, phase }) {
    el.statError.textContent = error === null ? "—" : `${error.toFixed(3)} m`;
    el.statReach.textContent = `${reach.toFixed(2)} m`;
    el.statTries.textContent = String(tries);
    el.statState.textContent = phase;
  }

  function setMessage(text, tone = "info") {
    el.status.textContent = text;
    el.status.classList.toggle("is-bad", tone === "bad");
  }

  el.btnRetry.addEventListener("click", () => handlers.onRetry?.());
  el.btnLevels.addEventListener("click", () => handlers.onLevels?.());

  return { el, setLevel, setStatus, setMessage };
}
