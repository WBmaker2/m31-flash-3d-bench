function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function starRow(count) {
  const row = element("div", "m31-stars");
  for (let i = 0; i < 3; i += 1) {
    const star = element("span", i < count ? "m31-star is-on" : "m31-star");
    star.textContent = "★";
    row.append(star);
  }
  return row;
}

function statRow(label, value) {
  const row = element("div", "m31-stat");
  row.append(element("dt", null, label), element("dd", null, value));
  return row;
}

export function buildResultPanel(options = {}) {
  const panel = element("div", "m31-panel m31-panel-result");
  panel.append(element("p", "m31-kicker", options.kicker ?? "결과"));
  panel.append(element("h2", "m31-title", options.title ?? "완료"));
  panel.append(starRow(options.stars ?? 0));

  const stats = element("dl", "m31-stats");
  if (options.score !== undefined && options.score !== null) {
    stats.append(statRow("점수", String(options.score)));
  }
  if (options.bestScore !== undefined && options.bestScore !== null) {
    stats.append(statRow("최고 점수", String(options.bestScore)));
  }
  for (const [label, value] of options.rows ?? []) {
    stats.append(statRow(label, String(value)));
  }
  if (stats.childElementCount > 0) panel.append(stats);

  if (options.detail) panel.append(element("p", "m31-detail", options.detail));

  const actions = element("div", "m31-actions");
  for (const action of options.actions ?? [{ id: "retry", label: "다시 하기" }]) {
    const button = element("button", action.primary ? "m31-btn m31-btn-primary" : "m31-btn", action.label);
    button.type = "button";
    button.dataset.action = action.id;
    actions.append(button);
  }
  panel.append(actions);
  return panel;
}

export function buildLevelPanel(options = {}) {
  const panel = element("div", "m31-panel m31-panel-level");
  panel.append(element("p", "m31-kicker", options.kicker ?? "레벨"));
  panel.append(element("h2", "m31-title", options.title ?? "레벨 선택"));

  const list = element("div", "m31-levels");
  options.levels.forEach((level, index) => {
    const button = element("button", "m31-level");
    button.type = "button";
    button.dataset.level = level.id;
    if (!level.unlocked) {
      button.disabled = true;
      button.classList.add("is-locked");
    }
    button.append(element("span", "m31-level-index", String(index + 1).padStart(2, "0")));
    button.append(element("span", "m31-level-label", level.label));
    const stars = starRow(level.stars ?? 0);
    stars.classList.add("m31-stars-small");
    button.append(stars);
    list.append(button);
  });
  panel.append(list);

  if (options.footerActions?.length) {
    const actions = element("div", "m31-actions");
    for (const action of options.footerActions) {
      const button = element("button", "m31-btn", action.label);
      button.type = "button";
      button.dataset.action = action.id;
      actions.append(button);
    }
    panel.append(actions);
  }
  return panel;
}

function openPanel(panel) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "m31-dialog";
    dialog.append(panel);
    document.body.append(dialog);

    const finish = (value) => {
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };

    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(null);
    });
    dialog.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const action = target.dataset.action;
        if (action) {
          finish(action);
          return;
        }
        const levelId = target.dataset.level;
        if (levelId) {
          finish({ levelId });
          return;
        }
      }
      if (event.target === dialog) finish(null);
    });

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  });
}

export function showResult(options = {}) {
  return openPanel(buildResultPanel(options));
}

export function showLevelSelect(options = {}) {
  return openPanel(buildLevelPanel(options));
}

let toastTimer = null;

export function showToast(message, tone = "info") {
  let toast = document.getElementById("m31-toast");
  if (!toast) {
    toast = element("div", "m31-toast");
    toast.id = "m31-toast";
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.toggle("is-bad", tone === "bad");
  toast.classList.add("is-open");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-open"), 2400);
}
