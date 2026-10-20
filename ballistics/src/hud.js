// 화면(HTML) 연결. 상태를 화면에 그리고, 조작을 콜백으로 되돌린다.

export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    statShots: document.getElementById("stat-shots"),
    statTargets: document.getElementById("stat-targets"),
    statScore: document.getElementById("stat-score"),
    statWind: document.getElementById("stat-wind"),
    aimYaw: document.getElementById("aim-yaw"),
    aimPitch: document.getElementById("aim-pitch"),
    aimPower: document.getElementById("aim-power"),
    outYaw: document.getElementById("aim-yaw-out"),
    outPitch: document.getElementById("aim-pitch-out"),
    outPower: document.getElementById("aim-power-out"),
    btnFire: document.getElementById("btn-fire"),
    btnReset: document.getElementById("btn-reset"),
    btnLevels: document.getElementById("btn-levels"),
  };

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint;
  }

  function setStatus({ shots, shotsLimit, targets, targetTotal, score, wind, canFire }) {
    el.statShots.textContent = `${shots} / ${shotsLimit}`;
    el.statTargets.textContent = `${targets} / ${targetTotal}`;
    el.statScore.textContent = String(score);
    el.statWind.textContent = wind;
    el.btnFire.disabled = !canFire;
  }

  function setAim(aim) {
    el.aimYaw.value = String(aim.yawDeg);
    el.aimPitch.value = String(aim.pitchDeg);
    el.aimPower.value = String(aim.power);
    el.outYaw.textContent = `${aim.yawDeg.toFixed(0)}°`;
    el.outPitch.textContent = `${aim.pitchDeg.toFixed(0)}°`;
    el.outPower.textContent = `${aim.power.toFixed(1)} m/s`;
  }

  function readAim() {
    return {
      yawDeg: Number(el.aimYaw.value),
      pitchDeg: Number(el.aimPitch.value),
      power: Number(el.aimPower.value),
    };
  }

  function setAimValue(patch = {}) {
    if (patch.yawDeg !== undefined) el.aimYaw.value = String(patch.yawDeg);
    if (patch.pitchDeg !== undefined) el.aimPitch.value = String(patch.pitchDeg);
    if (patch.power !== undefined) el.aimPower.value = String(patch.power);
  }

  for (const input of [el.aimYaw, el.aimPitch, el.aimPower]) {
    input.addEventListener("input", () => handlers.onAim?.());
  }
  el.btnFire.addEventListener("click", () => handlers.onFire?.());
  el.btnReset.addEventListener("click", () => handlers.onReset?.());
  el.btnLevels.addEventListener("click", () => handlers.onLevels?.());

  return { el, setLevel, setStatus, setAim, setAimValue, readAim };
}
