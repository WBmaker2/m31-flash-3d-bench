// 포인터·키보드 입력. 상태는 main.js 가 들고 있고, 여기서는 해석만 한다.
import * as THREE from "three";

const DRAG_THRESHOLD_PX = 5;

export function createControls(options) {
  const { canvas, camera, orbit, targets, onPick, actions } = options;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  let pointerDown = null;

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    pointerDown = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event) {
    const down = pointerDown;
    pointerDown = null;
    if (!down) return;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > DRAG_THRESHOLD_PX) return;
    updatePointer(event);
    if (!raycaster.ray.intersectPlane(plane, hit)) return;
    onPick?.(hit.x, hit.z);
  }

  function onKeyDown(event) {
    if (event.target instanceof HTMLInputElement) return;
    if (event.code === "Space") {
      event.preventDefault();
      actions.check?.();
      return;
    }
    if (event.code === "KeyR") {
      actions.reset?.();
      return;
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
