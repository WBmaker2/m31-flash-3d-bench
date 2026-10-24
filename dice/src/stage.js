// 렌더러 · 조명 · 탁자 · 카메라. 고정 스텝 루프.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** 검사 시점. 보드 크기에 맞춰 카메라가 자동으로 물러난다. */
export const VIEWS = {
  default: { dir: [0.12, 0.78, 0.92], factor: 3.1 },
  card: { dir: [0.14, 0.86, 1], factor: 3.15 },
  front: { dir: [0, 0.26, 1], factor: 2.8 },
  side: { dir: [1, 0.46, 0.12], factor: 3.1 },
  top: { dir: [0, 1, 0.02], factor: 3.1 },
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
  scene.background = new THREE.Color(0x1c1a24);
  scene.fog = new THREE.Fog(0x1c1a24, 3.5, 9);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 30);
  const focus = { x: 0, y: 0, z: 0, radius: 0.5 };
  camera.position.set(0.12, 0.78, 0.92);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.25;
  controls.maxDistance = 3.4;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 0, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x3a2c22, 0.92));
  scene.add(new THREE.AmbientLight(0x6f7787, 0.44));

  const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
  sun.position.set(-0.7, 1.9, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -0.9;
  sun.shadow.camera.right = 0.9;
  sun.shadow.camera.top = 0.9;
  sun.shadow.camera.bottom = -0.9;
  sun.shadow.camera.near = 0.2;
  sun.shadow.camera.far = 6;
  sun.shadow.bias = -0.0007;
  sun.shadow.intensity = 0.72;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x7fd8ff, 0.5);
  rim.position.set(1.3, 1, -1.4);
  scene.add(rim);

  // 탁자.
  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.14, 0.07, 64),
    new THREE.MeshStandardMaterial({ color: 0x6d4f34, roughness: 0.84, metalness: 0.04 }),
  );
  table.position.y = -0.035;
  table.receiveShadow = true;
  scene.add(table);

  const cloth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 0.92, 0.008, 64),
    new THREE.MeshStandardMaterial({ color: 0x2f3a44, roughness: 0.96, metalness: 0.02 }),
  );
  cloth.position.y = 0.004;
  cloth.receiveShadow = true;
  scene.add(cloth);

  let lastFit = 1;

  function applyView(name) {
    const view = VIEWS[name] ?? VIEWS.default;
    const target = new THREE.Vector3(focus.x, focus.y, focus.z);
    const dir = new THREE.Vector3(...view.dir).normalize();
    const distance = focus.radius * view.factor * lastFit;
    camera.position.copy(target).add(dir.multiplyScalar(distance));
    controls.target.copy(target);
    controls.update();
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    const aspect = width / Math.max(height, 1);
    camera.aspect = aspect;
    const fit = aspect < 1.1 ? Math.min(1.9, 1.1 / Math.max(aspect, 0.4)) : 1;
    if (Math.abs(fit - lastFit) > 0.001) {
      lastFit = fit;
      applyView("default");
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
        update(STEP);
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
    focus,
    applyView,
    get fit() {
      return lastFit;
    },
    setFocus(next) {
      focus.x = next.x;
      focus.y = next.y;
      focus.z = next.z;
      focus.radius = next.radius;
      const size = Math.max(0.4, focus.radius * 1.5);
      table.scale.setScalar(size / 1.1);
      cloth.scale.setScalar(size / 1.1);
      applyView("default");
    },
    resetView() {
      applyView("default");
    },
  };
}

export function createViews(stage) {
  let current = "default";

  function setView(name) {
    current = VIEWS[name] ? name : "default";
    stage.applyView(current);
  }

  return { setView, apply: () => stage.applyView(current), get current() { return current; } };
}
