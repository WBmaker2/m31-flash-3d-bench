import { ELEMENTS, ELEMENT_ORDER } from "./elements.js";
import { TARGETS } from "./chemistry.js";

export function createUi(handlers = {}) {
  const statusPanel = document.getElementById("status");
  const targetButtons = document.getElementById("target-buttons");
  const elementRow = document.getElementById("element-row");
  const sessionPanel = document.getElementById("session-panel");
  const sessionTarget = document.getElementById("session-target");
  const sessionProgress = document.getElementById("session-progress");
  const sessionTimer = document.getElementById("session-timer");
  const sessionScore = document.getElementById("session-score");

  let currentTargetId = null;
  let currentElement = null;

  function setStatus(html, isBad = false) {
    statusPanel.innerHTML = html;
    statusPanel.classList.toggle("bad", isBad);
  }

  for (const target of TARGETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.target = target.id;
    button.textContent = target.label;
    button.setAttribute("aria-pressed", String(target.id === currentTargetId));
    button.addEventListener("click", () => handlers.onTarget?.(target));
    targetButtons.append(button);
  }

  for (const element of ELEMENT_ORDER) {
    const info = ELEMENTS[element];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "element";
    button.dataset.element = element;
    button.setAttribute("aria-pressed", "false");

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = info.css;
    const symbol = document.createElement("span");
    symbol.className = "symbol";
    symbol.textContent = info.symbol;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = info.name;

    button.append(dot, symbol, name);
    button.addEventListener("click", () => handlers.onElement?.(element));
    elementRow.append(button);
  }

  return {
    setStatus,
    setTarget(target) {
      currentTargetId = target.id;
      for (const button of targetButtons.querySelectorAll("button")) {
        button.setAttribute("aria-pressed", String(button.dataset.target === target.id));
      }
    },
    setElement(element) {
      currentElement = element;
      for (const button of elementRow.querySelectorAll("button")) {
        button.setAttribute("aria-pressed", String(button.dataset.element === element));
      }
    },
    lockTargets(locked) {
      for (const button of targetButtons.querySelectorAll("button")) {
        button.disabled = locked;
      }
    },
    showSession(session, targetLabel) {
      sessionPanel.hidden = !session;
      if (!session) return;
      sessionTarget.textContent = targetLabel;
      sessionProgress.textContent = `${Math.min(session.index + 1, session.total)} / ${session.total}`;
      sessionTimer.textContent = `${Math.ceil(session.timeLeft)}초`;
      sessionScore.textContent = `점수 ${session.score}`;
    },
    get currentTargetId() {
      return currentTargetId;
    },
    get currentElement() {
      return currentElement;
    },
  };
}
