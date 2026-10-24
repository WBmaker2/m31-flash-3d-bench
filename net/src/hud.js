// 화면(HTML) 연결. 상태를 화면에 반영한다.
export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    status: document.getElementById("status-line"),
    statOption: document.getElementById("stat-option"),
    statResult: document.getElementById("stat-result"),
    btnLevels: document.getElementById("btn-levels"),
  };

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint;
  }

  function setStats({ option, result }) {
    el.statOption.textContent = option > 0 ? `${option}번 보기` : "-";
    el.statResult.textContent = result;
  }

  function setMessage(text, tone = "info") {
    el.status.textContent = text;
    el.status.classList.toggle("is-bad", tone === "bad");
  }

  el.btnLevels?.addEventListener("click", () => handlers.onLevels?.());

  return { el, setLevel, setStats, setMessage };
}
