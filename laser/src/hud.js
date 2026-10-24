// 화면(HTML) 연결. 상태를 화면에 반영한다.
export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    status: document.getElementById("status-line"),
    statReflections: document.getElementById("stat-reflections"),
    statMirrors: document.getElementById("stat-mirrors"),
    statFlipped: document.getElementById("stat-flipped"),
    btnReset: document.getElementById("btn-reset"),
    btnLevels: document.getElementById("btn-levels"),
  };

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint;
  }

  function setStats({ reflections, mirrors, flipped, par }) {
    el.statReflections.textContent = `${reflections}`;
    el.statMirrors.textContent = `${mirrors}`;
    el.statFlipped.textContent = `${flipped} / ${par}`;
  }

  function setMessage(text, tone = "info") {
    el.status.textContent = text;
    el.status.classList.toggle("is-bad", tone === "bad");
  }

  el.btnReset?.addEventListener("click", () => handlers.onReset?.());
  el.btnLevels?.addEventListener("click", () => handlers.onLevels?.());

  return { el, setLevel, setStats, setMessage };
}
