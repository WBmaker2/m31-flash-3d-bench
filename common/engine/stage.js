// 렌더 루프·리사이즈·4시점·정리를 한곳에 모은 공통 실행 계층.
// 씬 구성(조명·바닥·모형)은 각 게임의 stage.js 에 남긴다.
import * as THREE from "three";

export const STAGE_STEP = 1 / 60;

export function createStageRuntime(options) {
  const {
    canvas,
    renderer,
    scene,
    camera,
    controls,
    views,
    focus,
    getTarget = () => focus,
    onFocus,
    onDispose,
  } = options;

  let lastFit = 1;

  function applyView(name) {
    const view = views[name] ?? views.default;
    const point = getTarget();
    const target = new THREE.Vector3(point.x, point.y ?? 0, point.z ?? 0);
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
      while (accumulator >= STAGE_STEP) {
        update(STAGE_STEP);
        accumulator -= STAGE_STEP;
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
    onDispose?.();
    renderer.dispose();
  }

  return {
    start,
    dispose,
    applyView,
    views,
    focus,
    get fit() {
      return lastFit;
    },
    setFocus(next) {
      focus.x = next.x;
      focus.y = next.y ?? focus.y;
      focus.z = next.z;
      focus.radius = next.radius;
      onFocus?.(next);
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
    current = stage.views?.[name] ? name : "default";
    stage.applyView(current);
  }

  return {
    setView,
    apply: () => stage.applyView(current),
    get current() {
      return current;
    },
  };
}
