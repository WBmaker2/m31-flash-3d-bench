// 렌더러 · 조명 · 카메라. 석양 사격장 분위기.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const VIEWS = {
  default: { position: [-8.5, 6, -9], target: [0, 2, 10] },
  card: { position: [-7, 5, -7.5], target: [0, 1.8, 9] },
  front: { position: [0, 3.6, -8], target: [0, 2.2, 11] },
  side: { position: [16, 9, 2], target: [0, 2, 6] },
  top: { position: [0, 30, 6.8], target: [0, 0, 6] },
};

const SKY_RADIUS = 140;

/** 하늘 돔. 정점 색으로 석양 그라데이션을 만든다(셰이더 없이). */
function createSky() {
  const geometry = new THREE.SphereGeometry(SKY_RADIUS, 36, 20);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const top = new THREE.Color(0x101a33);
  const mid = new THREE.Color(0x2d3555);
  const horizon = new THREE.Color(0x7d5259);
  const below = new THREE.Color(0x2b231d);
  const temp = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    const t = (position.getY(i) / SKY_RADIUS + 1) / 2;
    if (t >= 0.5) {
      const k = (t - 0.5) / 0.5;
      temp.copy(horizon).lerp(mid, Math.min(1, k * 1.7));
      if (k > 0.6) temp.lerp(top, (k - 0.6) / 0.4);
    } else {
      temp.copy(horizon).lerp(below, Math.min(1, (0.5 - t) / 0.5));
    }
    colors[i * 3] = temp.r;
    colors[i * 3 + 1] = temp.g;
    colors[i * 3 + 2] = temp.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    }),
  );
  mesh.renderOrder = -1;
  return mesh;
}


export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a2036);
  scene.fog = new THREE.Fog(0x5a4048, 30, 92);
  scene.add(createSky());

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 260);
  camera.position.set(...VIEWS.default.position);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(...VIEWS.default.target);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xa8bce8, 0x4a382a, 1.25));
  scene.add(new THREE.AmbientLight(0x6c7690, 0.5));

  const key = new THREE.DirectionalLight(0xffcf96, 2.5);
  key.position.set(16, 20, -6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -26;
  key.shadow.camera.right = 26;
  key.shadow.camera.top = 26;
  key.shadow.camera.bottom = -26;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0006;
  key.shadow.radius = 3;
  key.shadow.intensity = 0.72;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(0x7fb4ff, 1.05);
  rim.position.set(-12, 7, 22);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: 0x4c4237, roughness: 0.96, metalness: 0.04 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(120, 60, 0x4a5a72, 0x323a4c);
  grid.material.transparent = true;
  grid.material.opacity = 0.4;
  grid.position.y = 0.012;
  scene.add(grid);

  // 사거리 눈금. 5 m 간격으로 rings.
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x8ea6c8,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
  });
  const ringGroup = new THREE.Group();
  for (let distance = 5; distance <= 30; distance += 5) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.25, 40), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.02, distance);
    ringGroup.add(ring);
  }
  scene.add(ringGroup);

  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 30),
    new THREE.MeshBasicMaterial({ color: 0xffb800, transparent: true, opacity: 0.06, depthWrite: false }),
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.015, 15);
  scene.add(lane);

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

/**
 * 시점 전환. 세로 화면에서는 가로로 좁아지므로 카메라를 뒤로 뺀다.
 * (같은 시점이라도 화면 비율에 따라 프레이밍이 달라진다)
 */
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
