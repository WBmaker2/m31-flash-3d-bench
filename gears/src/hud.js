// 화면(HTML) 연결. 상태를 화면에 반영한다.
export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    status: document.getElementById("status-line"),
    statSpeed: document.getElementById("stat-speed"),
    statTarget: document.getElementById("stat-target"),
    statDirection: document.getElementById("stat-direction"),
    statGears: document.getElementById("stat-gears"),
    speedBar: document.getElementById("speed-bar"),
    palette: document.getElementById("palette"),
    btnScore: document.getElementById("btn-score"),
    btnClear: document.getElementById("btn-clear"),
    btnLevels: document.getElementById("btn-levels"),
  };

  let sizeButtons = [];

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint;
  }

  function setPalette(palette, selected) {
    el.palette.replaceChildren();
    sizeButtons = palette.map((teeth) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.size = String(teeth);
      button.textContent = `${teeth}톱니`;
      button.classList.toggle("is-on", teeth === selected);
      button.addEventListener("click", () => handlers.onSize?.(teeth));
      el.palette.append(button);
      return button;
    });
  }

  function setSelectedSize(teeth) {
    for (const button of sizeButtons) {
      button.classList.toggle("is-on", Number(button.dataset.size) === teeth);
    }
  }

  function setStats({ speed, target, direction, directionOk, used, par }) {
    el.statSpeed.textContent = `${speed.toFixed(2)}`;
    el.statTarget.textContent = `${target.toFixed(2)}`;
    el.statDirection.textContent = direction === "none" ? "멈춤" : direction === "same" ? "같은 방향" : "반대 방향";
    el.statDirection.classList.toggle("is-bad", direction !== "none" && !directionOk);
    el.statGears.textContent = `${used} / ${par}`;
    if (el.speedBar) {
      const ratio = target > 0 ? Math.max(0, Math.min(1, speed / (target * 2))) : 0;
      el.speedBar.style.width = `${Math.round(ratio * 100)}%`;
      el.speedBar.classList.toggle("is-warn", speed > 0 && !directionOk);
      el.speedBar.classList.toggle("is-bad", speed === 0);
    }
  }

  function setMessage(text, tone = "info") {
    el.status.textContent = text;
    el.status.classList.toggle("is-bad", tone === "bad");
  }

  el.btnScore?.addEventListener("click", () => handlers.onScore?.());
  el.btnClear?.addEventListener("click", () => handlers.onClear?.());
  el.btnLevels?.addEventListener("click", () => handlers.onLevels?.());

  return { el, setLevel, setPalette, setSelectedSize, setStats, setMessage };
}
