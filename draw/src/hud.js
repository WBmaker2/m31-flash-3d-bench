// 화면(HTML) 연결. 상태를 화면에.reflect 한다.
export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    status: document.getElementById("status-line"),
    statRate: document.getElementById("stat-rate"),
    statMatched: document.getElementById("stat-matched"),
    statExtra: document.getElementById("stat-extra"),
    rateBar: document.getElementById("rate-bar"),
    palette: document.getElementById("palette"),
    target: document.getElementById("target-canvas"),
    btnClear: document.getElementById("btn-clear"),
    btnLevels: document.getElementById("btn-levels"),
  };

  let colorButtons = [];

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint;
  }

  function setTarget(rows, colors) {
    const canvas = el.target;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const cell = Math.floor(Math.min(canvas.width / rows[0].length, canvas.height / rows.length));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#151826";
    context.fillRect(0, 0, canvas.width, canvas.height);
    rows.forEach((line, row) => {
      [...line].forEach((char, col) => {
        if (char === "." || char === " ") return;
        context.fillStyle = colors[char] ?? "#cccccc";
        context.fillRect(col * cell, row * cell, cell - 1, cell - 1);
      });
    });
  }

  function setPalette(colors, selected) {
    el.palette.replaceChildren();
    colorButtons = colors.map((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.color = entry.key;
      const swatch = document.createElement("i");
      swatch.className = "swatch";
      swatch.style.background = entry.css;
      button.append(swatch, document.createTextNode(entry.key));
      button.classList.toggle("is-on", entry.key === selected);
      button.addEventListener("click", () => handlers.onColor?.(entry.key));
      el.palette.append(button);
      return button;
    });
  }

  function setSelectedColor(key) {
    for (const button of colorButtons) {
      button.classList.toggle("is-on", button.dataset.color === key);
    }
  }

  function setStats({ rate, matched, total, extra }) {
    el.statRate.textContent = `${Math.round(rate * 100)}%`;
    el.statMatched.textContent = `${matched} / ${total}`;
    el.statExtra.textContent = `${extra}`;
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

  el.btnClear?.addEventListener("click", () => handlers.onClear?.());
  el.btnLevels?.addEventListener("click", () => handlers.onLevels?.());

  return { el, setLevel, setTarget, setPalette, setSelectedColor, setStats, setMessage };
}
