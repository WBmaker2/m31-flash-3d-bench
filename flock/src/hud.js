// 화면(HTML) 연결. 상태를 화면에 반영한다.

export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    statGates: document.getElementById("stat-gates"),
    statTime: document.getElementById("stat-time"),
    statSpread: document.getElementById("stat-spread"),
    statBirds: document.getElementById("stat-birds"),
    status: document.getElementById("status-line"),
    bar: document.getElementById("scatter-bar"),
    scatterLimit: document.getElementById("scatter-limit"),
    btnRetry: document.getElementById("btn-retry"),
    btnLevels: document.getElementById("btn-levels"),
  };

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint;
  }

  function setStatus({ gatesPassed, gatesTotal, timeLeft, spread, scatterLimit, birds }) {
    el.statGates.textContent = `${gatesPassed} / ${gatesTotal}`;
    el.statTime.textContent = `${Math.max(0, Math.ceil(timeLeft))}초`;
    el.statSpread.textContent = `${spread.toFixed(1)} m`;
    el.statBirds.textContent = `${birds}마리`;

    const ratio = scatterLimit > 0 ? Math.min(1, spread / scatterLimit) : 0;
    if (el.scatterLimit) el.scatterLimit.textContent = scatterLimit.toFixed(0);
    if (el.bar) {
      el.bar.style.width = `${Math.round(ratio * 100)}%`;
      el.bar.classList.toggle("is-warn", ratio > 0.75);
      el.bar.classList.toggle("is-bad", ratio >= 1);
    }
  }

  function setMessage(text, tone = "info") {
    el.status.textContent = text;
    el.status.classList.toggle("is-bad", tone === "bad");
  }

  el.btnRetry.addEventListener("click", () => handlers.onRetry?.());
  el.btnLevels.addEventListener("click", () => handlers.onLevels?.());

  return { el, setLevel, setStatus, setMessage };
}
