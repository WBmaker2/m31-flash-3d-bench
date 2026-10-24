// 화면(HTML) 연결. 상태를 화면에 반영한다.
export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    status: document.getElementById("status-line"),
    statCoins: document.getElementById("stat-coins"),
    statTotal: document.getElementById("stat-total"),
    statProgress: document.getElementById("stat-progress"),
    progressBar: document.getElementById("progress-bar"),
    btnRestart: document.getElementById("btn-restart"),
    btnLevels: document.getElementById("btn-levels"),
  };

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint;
  }

  function setStats({ coins, total, progress }) {
    el.statCoins.textContent = `${coins}`;
    el.statTotal.textContent = `${total}`;
    el.statProgress.textContent = `${Math.round(progress * 100)}%`;
    if (el.progressBar) {
      el.progressBar.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
    }
  }

  function setMessage(text, tone = "info") {
    el.status.textContent = text;
    el.status.classList.toggle("is-bad", tone === "bad");
  }

  el.btnRestart?.addEventListener("click", () => handlers.onRestart?.());
  el.btnLevels?.addEventListener("click", () => handlers.onLevels?.());

  return { el, setLevel, setStats, setMessage };
}
