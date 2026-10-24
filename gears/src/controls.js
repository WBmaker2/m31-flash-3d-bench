// 포인터와 키보드 입력. 상태는 main.js 가 들고 있고, 여기서는 해석만 한다.
import * as THREE from "three";

const DRAG_THRESHOLD_PX = 5;

export function createControls(options) {
  const {
    canvas,
    camera,
    orbit,
    gearTargets,
    slotTargets,
    onPlace,
    onRemove,
    actions,
  } = options;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown = null;

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  function pick(list) {
    const targets = list();
    if (targets.length === 0) return null;
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length === 0) return null;
    let node = hits[0].object;
    while (node && !node.userData?.slotId) node = node.parent;
    return node ? node.userData.slotId : null;
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    pointerDown = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event) {
    const down = pointerDown;
    pointerDown = null;
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (moved > DRAG_THRESHOLD_PX) return;

    updatePointer(event);
    const gearSlot = pick(gearTargets);
    if (gearSlot) {
      onRemove?.(gearSlot);
      return;
    }
    const slot = pick(slotTargets);
    if (slot) onPlace?.(slot);
  }

  function onKeyDown(event) {
    if (event.target instanceof HTMLInputElement) return;
    switch (event.code) {
      case "Space":
        event.preventDefault();
        actions.score?.();
        return;
      case "KeyR":
        actions.reset?.();
        return;
      case "Digit1":
      case "Digit2":
      case "Digit3":
      case "Digit4":
      case "Digit5":
        actions.pickIndex?.(Number(event.code.slice(5)) - 1);
        return;
      default:
        break;
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown, true);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown);

  return {
    dispose() {
      canvas.removeEventListener("pointerdown", onPointerDown, true);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
