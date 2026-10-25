// 렌더러 · 조명 · 받침대 · 카메라. 고정 스텝 루프.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createStageRuntime } from "../../common/engine/stage.js";

export const VIEWS = {
  default: { dir: [0, 0.78, 1], factor: 1.5 },
  card: { dir: [0.07, 0.85, 1], factor: 1.55 },
  front: { dir: [0, 0.5, 1], factor: 1.45 },
  side: { dir: [1, 0.55, 0.1], factor: 1.5 },
  top: { dir: [0, 1, 0.02], factor: 1.5 },
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
  scene.background = new THREE.Color(0x1d1b21);
  scene.fog = new THREE.Fog(0x1d1b21, 3, 8);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 24);
  const focus = { x: 0, y: 0.12, z: 0, radius: 0.6 };
  camera.position.set(0, 0.16, 1);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.3;
  controls.maxDistance = 3;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 0.12, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x3a2c22, 0.92));
  scene.add(new THREE.AmbientLight(0x6f7787, 0.44));

  const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
  sun.position.set(-0.6, 1.8, 1.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -0.8;
  sun.shadow.camera.right = 0.8;
  sun.shadow.camera.top = 0.8;
  sun.shadow.camera.bottom = -0.8;
  sun.shadow.camera.near = 0.2;
  sun.shadow.camera.far = 5;
  sun.shadow.bias = -0.0007;
  sun.shadow.intensity = 0.72;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x7fd8ff, 0.5);
  rim.position.set(1.2, 0.8, -1.2);
  scene.add(rim);

  // 받침대 (밑판).
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.04, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x4c5a63, roughness: 0.9, metalness: 0.03 }),
  );
  base.position.set(0, 0.02, 0);
  base.receiveShadow = true;
  scene.add(base);

  const pivot = new THREE.Group();
  scene.add(pivot);

  const post = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.13, 4),
    new THREE.MeshStandardMaterial({ color: 0x8a94a3, roughness: 0.45, metalness: 0.35 }),
  );
  post.rotation.y = Math.PI / 4;
  post.position.y = 0.095;
  post.castShadow = true;
  pivot.add(post);

  return {
    renderer,
    scene,
    camera,
    controls,
    pivot,
    ...createStageRuntime({
      canvas,
      renderer,
      scene,
      camera,
      controls,
      views: VIEWS,
      focus,
      onFocus: (next) => {
        pivot.position.x = next.x;
      },
    }),
  };
}

export { createViews } from "../../common/engine/stage.js";
