// 렌더러 · 조명 · 카메라 · 작업대. 고정 스텝 루프.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * 검사 시점. 조각은 [-2, 2]³ 안에 있고 작업대 위에 놓인다.
 */
export const VIEWS = {
  default: { position: [3.6, 2.8, 4.4], target: [0, 0.9, 0] },
  card: { position: [4.0, 3.2, 5.0], target: [0, 0.9, 0] },
  front: { position: [0, 1.1, 7.2], target: [0, 0.9, 0] },
  side: { position: [7.2, 1.1, 0], target: [0, 0.9, 0] },
  top: { position: [0.01, 7.4, 0.01], target: [0, 0, 0] },
};

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171a21);
  scene.fog = new THREE.Fog(0x171a21, 12, 30);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
  camera.position.set(...VIEWS.default.position);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3.2;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(...VIEWS.default.target);
  controls.update();

  scene.add(new THREE.HemisphereLight(0x9db4d6, 0x2a2622, 0.95));
  scene.add(new THREE.AmbientLight(0x5b6472, 0.45));

  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(-3.5, 6, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -4;
  sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -4;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.0008;
  sun.shadow.intensity = 0.7;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x6fe0d4, 0.75);
  rim.position.set(4, 2.4, -4.5);
  scene.add(rim);

  // 작업대. 부품은 이 위에만 놓인다.
  const bench = new THREE.Mesh(
    new THREE.CylinderGeometry(2.15, 2.15, 0.16, 72),
    new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.92, metalness: 0.06 }),
  );
  bench.position.y = -0.08;
  bench.receiveShadow = true;
  scene.add(bench);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.15, 0.018, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0x4a5563 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.01;
  scene.add(ring);

  const grid = new THREE.GridHelper(4, 16, 0x3a4450, 0x323a45);
  grid.position.y = 0.012;
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);

  let lastFit = 1;

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    const aspect = width / Math.max(height, 1);
    camera.aspect = aspect;
    // 세로 화면에서는 가로 폭이 좁다. 물러서서 조각이 잘리지 않게 한다.
    const fit = aspect < 1.1 ? Math.min(1.7, 1.1 / Math.max(aspect, 0.4)) : 1;
    if (Math.abs(fit - lastFit) > 0.001) {
      const offset = camera.position.clone().sub(controls.target).multiplyScalar(fit / lastFit);
      camera.position.copy(controls.target).add(offset);
      lastFit = fit;
    }
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  const timer = new THREE.Timer();
  const STEP = 1 / 60;
  const still = new URLSearchParams(window.location.search).has("still");

  function start(update) {
    let accumulator = 0;
    let elapsed = 0;
    renderer.setAnimationLoop(() => {
      if (still) {
        renderer.render(scene, camera);
        if (window.__gameReady !== true) window.__gameReady = true;
        return;
      }
      timer.update();
      const delta = Math.min(timer.getDelta(), 0.1);
      accumulator = Math.min(accumulator + delta, 0.25);
      while (accumulator >= STEP) {
        elapsed += STEP;
        update(STEP, elapsed);
        accumulator -= STEP;
      }
      controls.update();
      renderer.render(scene, camera);
      if (window.__gameReady !== true) window.__gameReady = true;
    });
  }

  function dispose() {
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", resize);
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      const material = object.material;
      if (!material) return;
      const list = Array.isArray(material) ? material : [material];
      for (const entry of list) {
        if (entry.map) entry.map.dispose();
        entry.dispose();
      }
    });
    renderer.dispose();
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    start,
    dispose,
    get fit() {
      return lastFit;
    },
    resetView() {
      const view = VIEWS.default;
      const target = new THREE.Vector3(...view.target);
      const offset = new THREE.Vector3(...view.position).sub(target).multiplyScalar(lastFit);
      camera.position.copy(target).add(offset);
      controls.target.copy(target);
      controls.update();
    },
  };
}

/** 검사 시점 전환. */
export function createViews(stage) {
  let current = "default";

  function apply() {
    const view = VIEWS[current];
    const target = new THREE.Vector3(...view.target);
    const offset = new THREE.Vector3(...view.position).sub(target).multiplyScalar(stage.fit);
    stage.camera.position.copy(target).add(offset);
    stage.controls.target.copy(target);
    stage.controls.update();
  }

  function setView(name) {
    current = VIEWS[name] ? name : "default";
    apply();
  }

  return { setView, apply, get current() { return current; } };
}
