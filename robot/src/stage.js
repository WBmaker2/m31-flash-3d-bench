// 렌더러 · 조명 · 카메라 · 작업대. 작업车间 분위기.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ARM } from "./ik.js";

// 팔은 작업대 앞쪽(+x+z)을 향한다. 정면에서 보면 팔이 겹쳐 보이므로 기본 시점은 옆모습이다.
export const VIEWS = {
  default: { position: [4.2, 3.3, -3.9], target: [0.5, 0.6, 1.0] },
  card: { position: [3.4, 2.6, -3.0], target: [0.4, 0.55, 0.9] },
  front: { position: [0, 2.2, -5.4], target: [0.2, 0.7, 1.4] },
  side: { position: [5.4, 2.6, 1.4], target: [0.2, 0.6, 1.2] },
  top: { position: [0.3, 8.6, 1.9], target: [0.3, 0, 1.2] },
};

export const BENCH = { width: 6.6, depth: 4.6, thickness: 0.44, top: 0 };
export const FLOOR_Y = -0.95;

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1d24);
  scene.fog = new THREE.Fog(0x1a1d24, 26, 64);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 160);
  camera.position.set(...VIEWS.default.position);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3;
  controls.maxDistance = 26;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(...VIEWS.default.target);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xbdd2f0, 0x3a3026, 1.15));
  scene.add(new THREE.AmbientLight(0x707a8c, 0.45));

  const key = new THREE.DirectionalLight(0xfff0d8, 2.35);
  key.position.set(-5, 9, -4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0006;
  key.shadow.radius = 3;
  key.shadow.intensity = 0.75;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x7fb4ff, 0.9);
  rim.position.set(6, 5, 8);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70),
    new THREE.MeshStandardMaterial({ color: 0x2f333b, roughness: 0.95, metalness: 0.05 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(BENCH.width, BENCH.thickness, BENCH.depth),
    new THREE.MeshStandardMaterial({ color: 0x6d6152, roughness: 0.82, metalness: 0.08 }),
  );
  bench.position.set(0.3, BENCH.top - BENCH.thickness / 2, 1.1);
  bench.receiveShadow = true;
  bench.castShadow = true;
  scene.add(bench);

  const benchTop = new THREE.Mesh(
    new THREE.PlaneGeometry(BENCH.width, BENCH.depth),
    new THREE.MeshStandardMaterial({ color: 0x8a7c68, roughness: 0.88, metalness: 0.05 }),
  );
  benchTop.rotation.x = -Math.PI / 2;
  benchTop.position.set(0.3, BENCH.top + 0.001, 1.1);
  benchTop.receiveShadow = true;
  benchTop.name = "bench-top";
  scene.add(benchTop);

  // 도달 반경 링. 발사대의 어깨 높이까지 고려한 지면 반경이다.
  const reach = ARM.upperLength + ARM.forearmLength;
  const groundReach = Math.sqrt(Math.max(reach * reach - ARM.shoulderHeight * ARM.shoulderHeight, 0.01));
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(groundReach - 0.06, groundReach, 96),
    new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, BENCH.top + 0.012, 0);
  scene.add(ring);

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.54, 48),
    new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.2, side: THREE.DoubleSide }),
  );
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.set(0, BENCH.top + 0.012, 0);
  scene.add(innerRing);

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
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

  return { renderer, scene, camera, controls, start, dispose };
}

export function createPicker(canvas, camera) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  return {
    pick(clientX, clientY, targets) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(targets, false);
    },
  };
}

/** 세로 화면에서는 카메라를 뒤로 뺀다. */
export function createViews(stage) {
  let current = "default";

  function factor() {
    const aspect = stage.camera.aspect || 1;
    if (aspect >= 1) return 1;
    return 1 + (1 - aspect) * 0.95;
  }

  function apply() {
    const view = VIEWS[current];
    const scale = factor();
    const target = view.target;
    stage.camera.position.set(
      target[0] + (view.position[0] - target[0]) * scale,
      target[1] + (view.position[1] - target[1]) * scale,
      target[2] + (view.position[2] - target[2]) * scale,
    );
    stage.controls.target.set(...target);
    stage.controls.update();
  }

  function setView(name) {
    current = VIEWS[name] ? name : "default";
    apply();
  }

  return { setView, apply, get current() { return current; } };
}
