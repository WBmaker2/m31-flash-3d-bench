// 렌더러 · 조명 · 받침대 · 카메라. 고정 스텝 루프.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** 검사 시점. 모형 중심과 크기에 맞춰 카메라가 자동으로 물러난다. */
export const VIEWS = {
  default: { dir: [0.1, 0.62, 0.78], factor: 2.5 },
  card: { dir: [0.12, 0.72, 0.9], factor: 2.55 },
  front: { dir: [0, 0.18, 1], factor: 2.4 },
  side: { dir: [1, 0.42, 0.1], factor: 2.5 },
  top: { dir: [0, 1, 0.02], factor: 2.5 },
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
  scene.background = new THREE.Color(0x1d1b22);
  scene.fog = new THREE.Fog(0x1d1b22, 3.5, 9);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 30);
  const focus = { x: 0, y: 0, z: 0, radius: 0.3 };
  camera.position.set(0.1, 0.62, 0.78);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.2;
  controls.maxDistance = 3.4;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 0, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x3a2c22, 0.9));
  scene.add(new THREE.AmbientLight(0x707887, 0.45));

  const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
  sun.position.set(-0.6, 1.8, 1.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -0.8;
  sun.shadow.camera.right = 0.8;
  sun.shadow.camera.top = 0.8;
  sun.shadow.camera.bottom = -0.8;
  sun.shadow.camera.near = 0.2;
  sun.shadow.camera.far = 6;
  sun.shadow.bias = -0.0007;
  sun.shadow.intensity = 0.7;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x7fd8ff, 0.55);
  rim.position.set(1.2, 0.9, -1.3);
  scene.add(rim);

  // 받침대. 모형은 이 위에 놓인다.
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.56, 0.06, 48),
    new THREE.MeshStandardMaterial({ color: 0x6d4f34, roughness: 0.85, metalness: 0.04 }),
  );
  stand.position.y = -0.03;
  stand.receiveShadow = true;
  scene.add(stand);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.012, 48),
    new THREE.MeshStandardMaterial({ color: 0x2f3a3f, roughness: 0.95, metalness: 0.02 }),
  );
  top.position.y = 0.001;
  top.receiveShadow = true;
  scene.add(top);

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
      // 받침대도 모형 크기에 맞춰 줄인다.
      const size = Math.max(0.3, focus.radius * 0.72);
      stand.scale.setScalar(size / 0.52);
      top.scale.setScalar(size / 0.52);
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
