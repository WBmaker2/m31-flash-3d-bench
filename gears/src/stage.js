// 렌더러 · 조명 · 나무 판 · 카메라. 고정 스텝 루프.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createStageRuntime } from "../../common/engine/stage.js";

/** 검사 시점. 판 중심과 크기에 맞춰 카메라가 자동으로 물러난다. */
export const VIEWS = {
  default: { dir: [0.05, 0.92, 0.7], factor: 2.2 },
  card: { dir: [0.08, 0.95, 0.85], factor: 2.25 },
  front: { dir: [0, 0.26, 1], factor: 2.1 },
  side: { dir: [1, 0.62, 0.12], factor: 2.2 },
  top: { dir: [0, 1, 0.02], factor: 2.2 },
};

export const DEFAULT_FOCUS = { x: 0.42, z: 0, radius: 0.6 };

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1a20);
  scene.fog = new THREE.Fog(0x1b1a20, 3.2, 7.5);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 24);
  const focus = { ...DEFAULT_FOCUS };
  camera.position.set(focus.x + 0.06, 0.66, 0.75);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.35;
  controls.maxDistance = 3.2;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(focus.x, 0.02, focus.z);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x3a2c22, 0.95));
  scene.add(new THREE.AmbientLight(0x6b7280, 0.42));

  const sun = new THREE.DirectionalLight(0xfff0d8, 2.3);
  sun.position.set(-0.4, 1.7, 0.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -0.9;
  sun.shadow.camera.right = 0.9;
  sun.shadow.camera.top = 0.7;
  sun.shadow.camera.bottom = -0.7;
  sun.shadow.camera.near = 0.2;
  sun.shadow.camera.far = 5;
  sun.shadow.bias = -0.0006;
  sun.shadow.intensity = 0.75;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x6fe0d4, 0.6);
  rim.position.set(1.4, 0.8, -1.2);
  scene.add(rim);

  return {
    renderer,
    scene,
    camera,
    controls,
    ...createStageRuntime({
      canvas,
      renderer,
      scene,
      camera,
      controls,
      views: VIEWS,
      focus,
      getTarget: () => ({ x: focus.x, y: 0.02, z: focus.z }),
    }),
  };
}

export { createViews } from "../../common/engine/stage.js";
