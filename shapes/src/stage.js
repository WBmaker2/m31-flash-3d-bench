import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161a);
  scene.fog = new THREE.Fog(0x14161a, 22, 52);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(4.1, 3.5, 6.2);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4.5;
  controls.maxDistance = 22;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 0.85, 0.55);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xd8ecff, 0x0a0c0f, 1.25));

  const key = new THREE.DirectionalLight(0xfff3dc, 2.2);
  key.position.set(6, 11, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 32;
  key.shadow.bias = -0.0007;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x63d6ff, 0.85);
  rim.position.set(-7, 4, -6);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x171a1f, roughness: 0.95, metalness: 0.05 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(30, 60, 0x2d6b7d, 0x1d3b45);
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  grid.position.y = 0.01;
  scene.add(grid);

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

  function start(update) {
    let accumulator = 0;
    let elapsed = 0;
    renderer.setAnimationLoop(() => {
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
