// 렌더러 · 안개 · 손전 · 카메라(1인칭/俯瞰). 포인터락은 직접 구현한다.
import * as THREE from "three";
import { createLoopRuntime } from "../../common/engine/loop.js";
import { CELL_SIZE_M, EYE_HEIGHT_M } from "./maze.js";

export const VIEWS = {
  default: { offset: [0.9, 1.15, 1.3], target: [0, 0, 0] },
  card: { offset: [0.7, 0.8, 1.0], target: [0, 0, 0] },
  front: { offset: [0, 0.3, -1.35], target: [0, 0.1, 0] },
  side: { offset: [1.35, 0.3, 0], target: [0, 0.1, 0] },
  top: { offset: [0, 1.75, 0.02], target: [0, 0, 0] },
};

const LOOK_SPEED = 0.0022;
const MAX_PITCH = Math.PI * 0.46;

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121722);
  scene.fog = new THREE.Fog(0x121722, 14, 58);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 200);
  camera.position.set(0, 1.6, 0);

  scene.add(new THREE.HemisphereLight(0x8fa8d0, 0x24211c, 1.0));
  scene.add(new THREE.AmbientLight(0x59647a, 0.62));

  const moon = new THREE.DirectionalLight(0xc9d8ff, 0.85);
  moon.position.set(8, 18, -6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -28;
  moon.shadow.camera.right = 28;
  moon.shadow.camera.top = 28;
  moon.shadow.camera.bottom = -28;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 70;
  moon.shadow.bias = -0.0006;
  scene.add(moon);

  const lantern = new THREE.PointLight(0xffd9a0, 1.9, 20, 1.35);
  lantern.position.set(0, 1.7, 0);
  scene.add(lantern);

  //俯瞰 시점에서만 켜지는 조명. 1인칭에서는 어둡게 손전만 비추게 둔다.
  const overviewLight = new THREE.DirectionalLight(0xbcd2ff, 0);
  overviewLight.position.set(6, 22, 8);
  scene.add(overviewLight);

  const rig = { yaw: 0, pitch: 0, x: 0, z: 0, height: EYE_HEIGHT_M };
  let mode = "play";
  let extent = 12;

  function setExtent(value) {
    extent = Math.max(6, value);
  }

  function applyRig() {
    // 검사 시점(free)과俯瞰 모드에서는 리그가 카메라를 덮어쓰면 안 된다.
    if (mode !== "play") return;
    camera.position.set(rig.x, rig.height, rig.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(rig.yaw);
    camera.rotateX(rig.pitch);
    lantern.position.set(rig.x, rig.height + 0.15, rig.z);
  }

  function setMode(next) {
    mode = next;
    if (next !== "play" && document.pointerLockElement === canvas) document.exitPointerLock();
    // 1인칭일 때만 손전만 비추고,俯瞰·검사 시점에서는 전체를 밝힌다.
    overviewLight.intensity = next === "play" ? 0 : 1.7;
    applyRig();
  }

  canvas.addEventListener("click", () => {
    if (mode !== "play") return;
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
  });

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== canvas) return;
    rig.yaw -= event.movementX * LOOK_SPEED;
    rig.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, rig.pitch - event.movementY * LOOK_SPEED));
    applyRig();
  });

  const loop = createLoopRuntime({
    canvas,
    renderer,
    scene,
    camera,
    controls: { update() {} },
  });

  return {
    renderer,
    scene,
    camera,
    ...loop,
    rig,
    setMode,
    setExtent,
    applyRig,
    get mode() {
      return mode;
    },
    get extent() {
      return extent;
    },
  };
}

/**
 * 검사용 시점 전환. 미로 크기에 비례해 자리를 잡는다.
 * 카메라를 리그에서 떼어 내므로 1인칭 조작과 충돌하지 않는다.
 */
export function createViews(stage) {
  let current = "default";

  function apply() {
    const view = VIEWS[current];
    const [ox, oy, oz] = view.offset;
    stage.camera.position.set(ox * stage.extent, oy * stage.extent, oz * stage.extent);
    stage.camera.lookAt(view.target[0], view.target[1], view.target[2]);
  }

  function setView(name) {
    current = VIEWS[name] ? name : "default";
    stage.setMode("free");
    apply();
  }

  return { setView, apply, get current() { return current; } };
}
