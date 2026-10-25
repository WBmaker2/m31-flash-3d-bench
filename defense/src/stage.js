import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createLoopRuntime } from "../../common/engine/loop.js";

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060d14);
  scene.fog = new THREE.Fog(0x060d14, 26, 62);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 140);
  camera.position.set(-8.5, 14.5, 13.5);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 36;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.target.set(0.4, 0, 0.6);
  controls.update();

  scene.add(new THREE.HemisphereLight(0x9fd4ff, 0x05121a, 1.15));

  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(-6, 12, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0008;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x35d6c0, 1.1);
  rim.position.set(8, 5, -9);
  scene.add(rim);

  return {
    renderer,
    scene,
    camera,
    controls,
    ...createLoopRuntime({ canvas, renderer, scene, camera, controls }),
  };
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
    pickPlane(clientX, clientY, height) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height);
      const point = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, point)) return null;
      return point;
    },
  };
}
