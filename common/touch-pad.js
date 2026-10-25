// 터치 기기용 화면 버튼. 게임 상태는 각 게임이 들고 있고, 여기서는 누름/뗌만 전달한다.
export function createTouchPad(host, actions, options = {}) {
  if (!host) return { element: null, dispose() {} };

  const pad = document.createElement("div");
  pad.className = options.className ? `m31-touch ${options.className}` : "m31-touch";
  pad.setAttribute("role", "group");
  pad.setAttribute("aria-label", options.label ?? "터치 조작");

  const cleanups = [];

  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action.className ? `m31-touch-btn ${action.className}` : "m31-touch-btn";
    button.textContent = action.label;
    button.setAttribute("aria-label", action.aria ?? action.label);

    const press = (event) => {
      event.preventDefault();
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // 포인터 캡처를 지원하지 않는 브라우저도 있다.
      }
      action.onPress?.();
    };
    const release = () => action.onRelease?.();

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
    cleanups.push(() => {
      button.removeEventListener("pointerdown", press);
      button.removeEventListener("pointerup", release);
      button.removeEventListener("pointercancel", release);
      button.removeEventListener("pointerleave", release);
    });
    pad.append(button);
  }

  host.append(pad);

  return {
    element: pad,
    dispose() {
      for (const cleanup of cleanups) cleanup();
      pad.remove();
    },
  };
}

/** 위·왼쪽·아래·오른쪽 네 버튼. 한 번 누르면 그 방향 상태가 유지된다. */
export function createDirectionPad(host, handlers = {}) {
  const defs = [
    ["up", "▲", "위로 이동", "m31-touch-up"],
    ["left", "◀", "왼쪽으로 이동", "m31-touch-left"],
    ["down", "▼", "아래로 이동", "m31-touch-down"],
    ["right", "▶", "오른쪽으로 이동", "m31-touch-right"],
  ];

  return createTouchPad(
    host,
    defs.map(([id, label, aria, className]) => ({
      id,
      label,
      aria,
      className,
      onPress: () => handlers.onDirection?.(id),
      onRelease: () => handlers.onRelease?.(id),
    })),
    { label: handlers.label ?? "방향 조작" },
  );
}
