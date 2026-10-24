// 화면(HTML) 연결. 상태를 화면에.reflect 한다.
export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    status: document.getElementById("status-line"),
    targetList: document.getElementById("target-list"),
    statRate: document.getElementById("stat-rate"),
    statClicks: document.getElementById("stat-clicks"),
    statPar: document.getElementById("stat-par"),
    rateBar: document.getElementById("rate-bar"),
    palette: document.getElementById("palette"),
    btnScore: document.getElementById("btn-score"),
    btnClear: document.getElementById("btn-clear"),
    btnLevels: document.getElementById("btn-levels"),
    btnHint: document.getElementById("btn-hint"),
  };

  let colorButtons = [];

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint ?? "";
  }

  function setTarget(rows) {
    el.targetList.replaceChildren();
    for (const row of rows) {
      const item = document.createElement("span");
      item.className = "target-row";
      const swatch = document.createElement("i");
      swatch.className = "swatch";
      swatch.style.background = row.css;
      item.append(swatch, document.createTextNode(`${row.label} ${row.name}`));
      el.targetList.append(item);
    }
  }

  function setPalette(palette, selected) {
    el.palette.replaceChildren();
    colorButtons = palette.map((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.color = entry.name;
      const swatch = document.createElement("i");
      swatch.className = "swatch";
      swatch.style.background = entry.css;
      button.append(swatch, document.createTextNode(entry.name));
      button.classList.toggle("is-on", entry.name === selected);
      button.addEventListener("click", () => handlers.onColor?.(entry.name));
      el.palette.append(button);
      return button;
    });
  }

  function setSelectedColor(name) {
    for (const button of colorButtons) {
      button.classList.toggle("is-on", button.dataset.color === name);
    }
  }

  function setStats({ rate, clicks, par }) {
    el.statRate.textContent = `${Math.round(rate * 100)}%`;
    el.statClicks.textContent = `${clicks}`;
    el.statPar.textContent = `${par}`;
    if (el.rateBar) {
      const percent = Math.max(0, Math.min(1, rate));
      el.rateBar.style.width = `${Math.round(percent * 100)}%`;
      el.rateBar.classList.toggle("is-warn", percent > 0.5 && percent < 1);
      el.rateBar.classList.toggle("is-bad", percent < 0.5);
    }
  }

  function setMessage(text, tone = "info") {
    el.status.textContent = text;
    el.status.classList.toggle("is-bad", tone === "bad");
  }

  el.btnScore?.addEventListener("click", () => handlers.onScore?.());
  el.btnClear?.addEventListener("click", () => handlers.onClear?.());
  el.btnLevels?.addEventListener("click", () => handlers.onLevels?.());
  el.btnHint?.addEventListener("click", () => handlers.onHint?.());

  return { el, setLevel, setTarget, setPalette, setSelectedColor, setStats, setMessage };
}
