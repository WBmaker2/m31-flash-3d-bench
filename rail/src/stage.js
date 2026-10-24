// 렌더러 · 조명 · 카메라 4시점 · 고정 스텝 루프.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const VIEWS = {
  default: { dir: [0.5, 0.86, 0.9], factor: 2.1 },
  card: { dir: [0.55, 0.92, 1], factor: 2.15 },
  front: { dir: [0, 0.5, 1], factor: 2.05 },
  side: { dir: [1, 0.55, 0.1], factor: 2.1 },
  top: { dir: [0, 1, 0.02], factor: 2.1 },
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
  scene.background = new THREE.Color(0x141a28);
  scene.fog = new THREE.Fog(0x141a28, 3.4, 9);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 30);
  const focus = { x: 0, y: 0, z: 0, radius: 1.4 };
  camera.position.set(0.5, 0.86, 0.9);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.6;
  controls.maxDistance = 6;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 0, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x2a3040, 0.9));
  scene.add(new THREE.AmbientLight(0x66718a, 0.45));

  const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
  sun.position.set(1.6, 2.6, 1.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1.6;
  sun.shadow.camera.right = 1.6;
  sun.shadow.camera.top = 1.6;
  sun.shadow.camera.bottom = -1.6;
  sun.shadow.camera.near = 0.2;
  sun.shadow.camera.far = 8;
  sun.shadow.bias = -0.0007;
  sun.shadow.intensity = 0.72;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x7fd8ff, 0.55);
  rim.position.set(-1.6, 1.2, -1.8);
  scene.add(rim);

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
    applyView,
    get fit() {
      return lastFit;
    },
    setFocus(next) {
      focus.x = next.x;
      focus.y = next.y;
      focus.z = next.z;
      focus.radius = next.radius;
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
