// 화면(HTML) 연결. 상태를 화면에 반영한다.
export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    status: document.getElementById("status-line"),
    statTilt: document.getElementById("stat-tilt"),
    statMass: document.getElementById("stat-mass"),
    statTarget: document.getElementById("stat-target"),
    statCount: document.getElementById("stat-count"),
    tiltBar: document.getElementById("tilt-bar"),
    palette: document.getElementById("palette"),
    btnScore: document.getElementById("btn-score"),
    btnClear: document.getElementById("btn-clear"),
    btnLevels: document.getElementById("btn-levels"),
  };

  let massButtons = [];

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint;
  }

  function setPalette(masses, selected) {
    el.palette.replaceChildren();
    massButtons = masses.map((mass) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.mass = String(mass);
      button.textContent = `${mass}kg`;
      button.classList.toggle("is-on", mass === selected);
      button.addEventListener("click", () => handlers.onMass?.(mass));
      el.palette.append(button);
      return button;
    });
  }

  function setSelectedMass(mass) {
    for (const button of massButtons) {
      button.classList.toggle("is-on", Number(button.dataset.mass) === mass);
    }
  }

  function setStats({ angle, totalMass, targetMass, count, par, level }) {
    const degrees = (angle * 180) / Math.PI;
    el.statTilt.textContent = `${degrees >= 0 ? "+" : ""}${degrees.toFixed(1)}°`;
    el.statTilt.classList.toggle("is-bad", !level);
    el.statMass.textContent = `${totalMass.toFixed(1)}kg`;
    el.statTarget.textContent = `${targetMass}kg`;
    el.statCount.textContent = `${count} / ${par}`;
    if (el.tiltBar) {
      const ratio = Math.max(0, Math.min(1, Math.abs(angle) / 0.6));
      el.tiltBar.style.width = `${Math.round((1 - ratio) * 100)}%`;
      el.tiltBar.classList.toggle("is-warn", ratio > 0.05 && ratio < 0.5);
      el.tiltBar.classList.toggle("is-bad", ratio >= 0.5);
    }
  }

  function setMessage(text, tone = "info") {
    el.status.textContent = text;
    el.status.classList.toggle("is-bad", tone === "bad");
  }

  el.btnScore?.addEventListener("click", () => handlers.onScore?.());
  el.btnClear?.addEventListener("click", () => handlers.onClear?.());
  el.btnLevels?.addEventListener("click", () => handlers.onLevels?.());

  return { el, setLevel, setPalette, setSelectedMass, setStats, setMessage };
}
