// 포인터와 키보드 입력. 상태는 main.js 가 들고 있고, 여기서는 해석만 한다.
import * as THREE from "three";

const DRAG_THRESHOLD_PX = 5;

const KEY_DIRECTION = {
  KeyQ: "union",
  KeyW: "intersect",
  KeyE: "subtract",
};

const KIND_BY_NUMBER = {
  Digit1: "sphere",
  Digit2: "box",
  Digit3: "torus",
  Digit4: "capsule",
};

/**
 * 입력 연결. 모든 동작은 콜백으로 전달한다.
 * @param {{canvas:HTMLCanvasElement, camera:THREE.Camera, orbit:object,
 *   pickTargets:() => Array, onSelect:Function, onAdd:Function, onMove:Function,
 *   onDragEnd:Function, actions:object}} options
 */
export function createControls(options) {
  const { canvas, camera, orbit, pickTargets, onSelect, onAdd, onMove, onDragEnd, actions } = options;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const benchPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();

  let dragging = false;
  let dragIndex = -1;
  let pointerDown = null;

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  function benchHit() {
    if (!raycaster.ray.intersectPlane(benchPlane, hitPoint)) return null;
    return { x: hitPoint.x, z: hitPoint.z };
  }

  function pickPart() {
    const hits = raycaster.intersectObjects(pickTargets(), false);
    if (hits.length === 0) return -1;
    return pickTargets().indexOf(hits[0].object);
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    updatePointer(event);
    pointerDown = { x: event.clientX, y: event.clientY };
    const index = pickPart();
    if (index < 0) return;

    // 부품을 잡은 경우에만 카메라 회전을 막는다. 빈 곳을 누르면 회전한다.
    dragging = true;
    dragIndex = index;
    onSelect(index);
    orbit.enabled = false;
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragging) return;
    updatePointer(event);
    const point = benchHit();
    if (!point) return;
    onMove(dragIndex, point);
  }

  function onPointerUp(event) {
    if (dragging) {
      dragging = false;
      dragIndex = -1;
      orbit.enabled = true;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      onDragEnd();
      return;
    }

    const down = pointerDown;
    pointerDown = null;
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (moved > DRAG_THRESHOLD_PX) return;

    updatePointer(event);
    if (pickPart() >= 0) return;
    const point = benchHit();
    if (!point) return;
    onAdd(point.x, point.z);
  }

  function onKeyDown(event) {
    if (event.target instanceof HTMLInputElement) return;
    if (event.ctrlKey || event.metaKey) {
      if (event.code === "KeyZ") {
        event.preventDefault();
        actions.undo?.();
      }
      return;
    }

    const kind = KIND_BY_NUMBER[event.code];
    if (kind) {
      actions.setKind?.(kind);
      return;
    }
    const op = KEY_DIRECTION[event.code];
    if (op) {
      actions.setOp?.(op);
      return;
    }

    switch (event.code) {
      case "BracketLeft":
        actions.rotate?.(-Math.PI / 12);
        return;
      case "BracketRight":
        actions.rotate?.(Math.PI / 12);
        return;
      case "Minus":
      case "NumpadSubtract":
        actions.scale?.(0.88);
        return;
      case "Equal":
      case "NumpadAdd":
        actions.scale?.(1.14);
        return;
      case "Delete":
      case "Backspace":
        event.preventDefault();
        actions.remove?.();
        return;
      case "KeyR":
        actions.reset?.();
        return;
      case "KeyG":
        actions.toggleGhost?.();
        return;
      case "Space":
        event.preventDefault();
        actions.score?.();
        return;
      default:
        break;
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown, true);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown);

  return {
    dispose() {
      canvas.removeEventListener("pointerdown", onPointerDown, true);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
