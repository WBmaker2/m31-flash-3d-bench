// 화면(HTML) 연결. 상태를 화면에 반영한다.
import { KIND_LABELS, OP_LABELS } from "./sdf.js";

export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    status: document.getElementById("status-line"),
    statIou: document.getElementById("stat-iou"),
    statTarget: document.getElementById("stat-target"),
    statVolume: document.getElementById("stat-volume"),
    statParts: document.getElementById("stat-parts"),
    partInfo: document.getElementById("part-info"),
    bar: document.getElementById("iou-bar"),
    kindButtons: [...document.querySelectorAll("[data-kind]")],
    opButtons: [...document.querySelectorAll("[data-op]")],
    btnScore: document.getElementById("btn-score"),
    btnClear: document.getElementById("btn-clear"),
    btnDelete: document.getElementById("btn-delete"),
    btnLevels: document.getElementById("btn-levels"),
  };

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint;
  }

  function setTool({ kind, op, selected, partCount, maxParts }) {
    for (const button of el.kindButtons) {
      button.classList.toggle("is-on", button.dataset.kind === kind);
    }
    for (const button of el.opButtons) {
      button.classList.toggle("is-on", button.dataset.op === op);
    }
    el.partInfo.textContent =
      selected >= 0
        ? `선택한 부품 ${selected + 1}번 · ${partCount}/${maxParts}`
        : `부품 ${partCount}/${maxParts} · 하나를 누르면 고릅니다`;
    if (el.btnDelete) el.btnDelete.disabled = selected < 0;
  }

  function setStats({ iou, target, volumeRatio, partCount, maxParts }) {
    el.statIou.textContent = iou.toFixed(3);
    el.statTarget.textContent = target.toFixed(2);
    el.statVolume.textContent = `${Math.round(volumeRatio * 100)}%`;
    el.statParts.textContent = `${partCount} / ${maxParts}`;
    if (el.bar) {
      const ratio = Math.max(0, Math.min(1, iou));
      el.bar.style.width = `${Math.round(ratio * 100)}%`;
      el.bar.classList.toggle("is-warn", ratio > 0.75 && ratio < 0.94);
      el.bar.classList.toggle("is-bad", ratio < 0.8);
    }
  }

  function setMessage(text, tone = "info") {
    el.status.textContent = text;
    el.status.classList.toggle("is-bad", tone === "bad");
  }

  for (const button of el.kindButtons) {
    // 기본형 이름은 sdf.js 의 표가 단일 진실 공급원이다.
    button.textContent = KIND_LABELS[button.dataset.kind] ?? button.textContent;
    button.addEventListener("click", () => handlers.onKind?.(button.dataset.kind));
  }
  for (const button of el.opButtons) {
    button.textContent = OP_LABELS[button.dataset.op] ?? button.textContent;
    button.addEventListener("click", () => handlers.onOp?.(button.dataset.op));
  }
  el.btnScore?.addEventListener("click", () => handlers.onScore?.());
  el.btnClear?.addEventListener("click", () => handlers.onClear?.());
  el.btnDelete?.addEventListener("click", () => handlers.onDelete?.());
  el.btnLevels?.addEventListener("click", () => handlers.onLevels?.());

  return { el, setLevel, setTool, setStats, setMessage };
}
