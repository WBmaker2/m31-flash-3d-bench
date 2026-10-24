// 키보드 입력. 상태는 main.js 가 들고 있고, 여기서는 해석만 한다.
const LEFT = ["ArrowLeft", "KeyA"];
const RIGHT = ["ArrowRight", "KeyD"];

export function createControls(actions) {
  const keys = new Set();

  function onKeyDown(event) {
    if (event.target instanceof HTMLInputElement) return;
    if (event.code === "Space") {
      event.preventDefault();
      actions.jump?.();
      return;
    }
    if (event.code === "KeyR") {
      actions.restart?.();
      return;
    }
    if (LEFT.includes(event.code) || RIGHT.includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => keys.clear());

  return {
    /** 현재 눌린 방향. */
    get move() {
      let value = 0;
      for (const code of keys) {
        if (LEFT.includes(code)) value -= 1;
        if (RIGHT.includes(code)) value += 1;
      }
      return Math.max(-1, Math.min(1, value));
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
