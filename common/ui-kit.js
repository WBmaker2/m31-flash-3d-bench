export function createInvariantBadge(options = {}) {
  const badge = document.createElement("div");
  badge.style.cssText = [
    "position:fixed",
    `left:50%`,
    `bottom:${options.bottom ?? "104px"}`,
    "transform:translateX(-50%)",
    "z-index:6",
    "padding:7px 14px",
    "border-radius:11px",
    "font:600 12.5px/1.45 system-ui,sans-serif",
    "background:#3a1414",
    "color:#ffb0a5",
    "border:1px solid rgba(255,107,92,.65)",
    "display:none",
    "pointer-events:none",
    "max-width:72vw",
  ].join(";");
  document.body.append(badge);

  return {
    show(problems) {
      if (!problems || problems.length === 0) {
        badge.style.display = "none";
        return;
      }
      badge.style.display = "block";
      badge.textContent = `불변식 위반 ${problems.length}건 · ${problems[0].message}`;
    },
    element: badge,
  };
}

export function createViewController(stage, views) {
  let current = "default";

  function setView(name) {
    current = views[name] ? name : "default";
    const view = views[current];
    stage.camera.position.set(...view.position);
    stage.controls.target.set(...view.target);
    stage.controls.update();
  }

  return {
    setView,
    get current() {
      return current;
    },
  };
}
