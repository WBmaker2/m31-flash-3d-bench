// 4시점 없이 고정 카메라만 쓰는 게임의 공통 루프·리사이즈·정리.
import * as THREE from "three";

export function createLoopRuntime(options) {
  const { canvas, renderer, scene, camera, controls, onResize, updateElapsed = true } = options;

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    onResize?.(camera.aspect);
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
        if (updateElapsed) {
          elapsed += STEP;
          update(STEP, elapsed);
        } else {
          update(STEP);
        }
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

  return { start, dispose, resize };
}
