// 렌더러 · 조명 · 카메라(무리 중심 추적). 고정 스텝 루프.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createLoopRuntime } from "../../common/engine/loop.js";
import { ARENA } from "./levels.js";

/**
 * 검사 시점. `relative` 인 것은 무리 중심을 기준으로 본다(무리가 어디 있든 보인다).
 * 나머지는 경기장(60 x 22 x 48) 전체를 보는 절대 시점이다.
 */
export const VIEWS = {
  default: { relative: true, offset: [11, 12, 16], target: [0, 2, 0] },
  card: { relative: true, offset: [12, 14, 19], target: [0, 2, 0] },
  front: { position: [0, 24, -44], target: [0, 2, 0] },
  side: { position: [44, 20, 2], target: [0, 2, 0] },
  top: { position: [0, 62, 1.2], target: [0, 0, 0] },
};

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141a24);
  scene.fog = new THREE.Fog(0x141a24, 34, 92);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 220);
  camera.position.set(ARENA.halfX * 0.95, ARENA.halfY + 14, ARENA.halfZ * 1.15);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 90;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, 2, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0x9fb6dc, 0x2b2a26, 1.05));
  scene.add(new THREE.AmbientLight(0x5d6a82, 0.5));

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.position.set(-14, 22, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34;
  sun.shadow.camera.bottom = -34;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0006;
  sun.shadow.intensity = 0.78;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA.halfX * 2 + 24, ARENA.halfZ * 2 + 24),
    new THREE.MeshStandardMaterial({ color: 0x2c3330, roughness: 0.96, metalness: 0.04 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -ARENA.halfY - 0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(ARENA.halfX * 2, ARENA.halfX, 0x3d4a52, 0x323d44);
  grid.position.y = -ARENA.halfY - 0.48;
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  scene.add(grid);

  return {
    renderer,
    scene,
    camera,
    controls,
    ...createLoopRuntime({ canvas, renderer, scene, camera, controls }),
  };
}

/** 검사 시점 전환. 무리 추적을 멈추고 카메라를 직접 놓는다. */
export function createViews(stage, getFocus = () => ({ x: 0, y: 2, z: 0 })) {
  let current = "default";

  function apply() {
    const view = VIEWS[current];
    if (view.relative) {
      const focus = getFocus();
      stage.camera.position.set(focus.x + view.offset[0], view.offset[1], focus.z + view.offset[2]);
      stage.controls.target.set(focus.x, view.target[1], focus.z);
    } else {
      stage.camera.position.set(view.position[0], view.position[1], view.position[2]);
      stage.controls.target.set(view.target[0], view.target[1], view.target[2]);
    }
    stage.controls.update();
  }

  function setView(name) {
    current = VIEWS[name] ? name : "default";
    apply();
  }

  return { setView, apply, get current() { return current; } };
}
