// 화면(HTML) 연결. 상태를 화면에 반영한다.
export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    status: document.getElementById("status-line"),
    statPlaced: document.getElementById("stat-placed"),
    statPar: document.getElementById("stat-par"),
    statResult: document.getElementById("stat-result"),
    kindButtons: [...document.querySelectorAll("[data-kind]")],
    btnLevels: document.getElementById("btn-levels"),
  };

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint;
  }

  function setKind(kind) {
    for (const button of el.kindButtons) {
      button.classList.toggle("is-on", button.dataset.kind === kind);
    }
  }

  function setStats({ placed, par, result }) {
    el.statPlaced.textContent = `${placed}`;
    el.statPar.textContent = `${par}`;
    el.statResult.textContent = result;
  }

  function setMessage(text, tone = "info") {
    el.status.textContent = text;
    el.status.classList.toggle("is-bad", tone === "bad");
  }

  for (const button of el.kindButtons) {
    button.addEventListener("click", () => handlers.onKind?.(button.dataset.kind));
  }
  el.btnLevels?.addEventListener("click", () => handlers.onLevels?.());

  return { el, setLevel, setKind, setStats, setMessage };
}
