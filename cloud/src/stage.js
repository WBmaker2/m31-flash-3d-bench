// 렌더러 · 조명 · 하늘 · 카메라(주체를 따라가는 리그). 고정 스텝 루프.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createLoopRuntime } from "../../common/engine/loop.js";

export const VIEWS = {
  default: { offset: [-0.9, 2, 3.9], factor: 1 },
  card: { offset: [-1.2, 2.4, 4.4], factor: 1 },
  front: { offset: [0, 0.4, 4], factor: 1 },
  side: { offset: [4, 1.1, 0.3], factor: 1 },
  top: { offset: [0.2, 4.6, 0.3], factor: 1 },
};

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fc7f0);
  scene.fog = new THREE.Fog(0x8fc7f0, 14, 42);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 80);
  camera.position.set(-0.9, 2, 3.9);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.5;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.target.set(0.4, 0.4, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xdff0ff, 0x6f8fb5, 1.05));
  scene.add(new THREE.AmbientLight(0xbcd4f0, 0.4));

  const sun = new THREE.DirectionalLight(0xfff6e8, 2.1);
  sun.position.set(4, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0008;
  sun.shadow.intensity = 0.75;
  scene.add(sun);

  // 먼 산들.
  for (let i = 0; i < 14; i += 1) {
    const hill = new THREE.Mesh(
      new THREE.ConeGeometry(3 + (i % 4) * 1.4, 5 + (i % 3) * 2.2, 7),
      new THREE.MeshStandardMaterial({ color: 0x6f93b8, roughness: 1, metalness: 0 }),
    );
    hill.position.set(-14 + i * 3.4, -3.4, -22 - (i % 3) * 5);
    scene.add(hill);
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0xd9e9f7, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -8;
  ground.receiveShadow = true;
  scene.add(ground);

  const follow = new THREE.Vector3(0.4, 0.4, 0);
  const lastFollow = new THREE.Vector3(0.4, 0.4, 0);
  let view = "default";
  let lastFit = 1;

  function applyView(name) {
    view = name;
    const spec = VIEWS[name] ?? VIEWS.default;
    const target = follow.clone().add(new THREE.Vector3(0.4, 0.4, 0));
    const offset = new THREE.Vector3(...spec.offset).multiplyScalar(lastFit);
    controls.target.copy(target);
    camera.position.copy(target).add(offset);
    controls.update();
    lastFollow.copy(follow);
  }

  function updateFollow(x, y, z) {
    follow.set(x, y, z);
    if (view !== "default" && view !== "card") return;
    const delta = follow.clone().sub(lastFollow);
    camera.position.add(delta);
    controls.target.add(delta);
    lastFollow.copy(follow);
  }

  const loop = createLoopRuntime({
    canvas,
    renderer,
    scene,
    camera,
    controls,
    updateElapsed: false,
    onResize: (aspect) => {
      const fit = aspect < 1.1 ? Math.min(1.8, 1.1 / Math.max(aspect, 0.4)) : 1;
      if (Math.abs(fit - lastFit) > 0.001) {
        lastFit = fit;
        applyView(view);
      }
    },
  });

  return {
    renderer,
    scene,
    camera,
    controls,
    ...loop,
    updateFollow,
    applyView,
    resetView() {
      applyView("default");
    },
  };
}

export function createViews(stage) {
  let current = "default";

  function setView(name) {
    current = name;
    stage.applyView(name);
  }

  return { setView, apply: () => stage.applyView(current), get current() { return current; } };
}
