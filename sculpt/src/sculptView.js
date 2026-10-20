// 조각 화면. 목표 고스트 · 결과 조각 · 부품 표시.
import * as THREE from "three";

const OP_COLORS = {
  union: 0xf0a35e,
  intersect: 0x57d9d0,
  subtract: 0xff6b5c,
};

const SELECTED = 0xfff0c8;

function surfaceGeometry(surface) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(surface.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(surface.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(surface.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** 부품 기본형의 표시용 지오메트리. */
function partGeometry(element) {
  const params = element.params;
  switch (element.kind) {
    case "box": {
      const geometry = new THREE.BoxGeometry(params.hx * 2, params.hy * 2, params.hz * 2);
      return geometry;
    }
    case "torus": {
      const geometry = new THREE.TorusGeometry(params.R, params.r, 14, 32);
      geometry.rotateX(-Math.PI / 2);
      return geometry;
    }
    case "capsule": {
      return new THREE.CapsuleGeometry(params.r, params.h, 6, 16);
    }
    default: {
      return new THREE.SphereGeometry(params.r, 24, 16);
    }
  }
}

/** 부품이 작업대 위에 놓이도록 중심 높이를 정한다. */
export function restingHeight(element) {
  const params = element.params;
  switch (element.kind) {
    case "box":
      return params.hy;
    case "torus":
      return params.R + params.r;
    case "capsule":
      return params.h / 2 + params.r;
    default:
      return params.r;
  }
}

export function createSculptView(scene) {
  const ghostMaterial = new THREE.MeshStandardMaterial({
    color: 0x6fe0d4,
    emissive: 0x0d3f3a,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.3,
    roughness: 0.85,
    metalness: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const resultMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4e6c6,
    roughness: 0.52,
    metalness: 0.08,
  });

  const ghost = new THREE.Mesh(new THREE.BufferGeometry(), ghostMaterial);
  ghost.renderOrder = 1;
  scene.add(ghost);

  const result = new THREE.Mesh(new THREE.BufferGeometry(), resultMaterial);
  result.castShadow = true;
  result.receiveShadow = true;
  scene.add(result);

  const partGroup = new THREE.Group();
  scene.add(partGroup);

  const selection = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.022, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.85 }),
  );
  selection.rotation.x = Math.PI / 2;
  selection.visible = false;
  scene.add(selection);

  function swapGeometry(mesh, surface) {
    const geometry = surfaceGeometry(surface);
    mesh.geometry.dispose();
    mesh.geometry = geometry;
  }

  function setGhost(surface) {
    swapGeometry(ghost, surface);
  }

  function setResult(surface) {
    swapGeometry(result, surface);
  }

  function clearParts() {
    for (const child of [...partGroup.children]) {
      partGroup.remove(child);
      child.geometry.dispose();
    }
  }

  function setParts(elements, selectedIndex) {
    clearParts();
    elements.forEach((element, index) => {
      const selected = index === selectedIndex;
      const material = new THREE.MeshStandardMaterial({
        color: selected ? SELECTED : OP_COLORS[element.op] ?? OP_COLORS.union,
        transparent: true,
        opacity: selected ? 0.6 : 0.16,
        roughness: 0.7,
        metalness: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(partGeometry(element), material);
      mesh.position.set(element.position.x, element.position.y, element.position.z);
      mesh.rotation.y = element.rotationY ?? 0;
      mesh.renderOrder = 2;
      partGroup.add(mesh);
    });

    const selected = elements[selectedIndex];
    if (selected) {
      selection.visible = true;
      selection.position.set(selected.position.x, 0.03, selected.position.z);
      const radius = 0.24 + restingHeight(selected) * 0.32;
      selection.scale.setScalar(radius / 0.34);
    } else {
      selection.visible = false;
    }
  }

  function setGhostVisible(visible) {
    ghost.visible = visible;
  }

  return {
    ghost,
    result,
    partGroup,
    setGhost,
    setResult,
    setParts,
    setGhostVisible,
    clearParts,
  };
}
