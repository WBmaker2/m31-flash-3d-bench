// 키보드 입력. 상태는 main.js 가 들고 있고, 여기서는 해석만 한다.
export function createControls(actions) {
  function onKeyDown(event) {
    if (event.target instanceof HTMLInputElement) return;
    switch (event.code) {
      case "Space":
        event.preventDefault();
        actions.roll?.();
        return;
      case "Digit1":
      case "Digit2":
      case "Digit3":
        actions.choice?.(Number(event.code.slice(5)) - 1);
        return;
      case "KeyR":
        actions.reset?.();
        return;
      default:
        break;
    }
  }

  window.addEventListener("keydown", onKeyDown);

  return {
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
