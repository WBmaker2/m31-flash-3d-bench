// 복셀 인스턴스 메시 · 목표 색 겹침 · 그림자.
import * as THREE from "three";
import { VOXEL_SIZE } from "../../common/parts/paint3d.js";

export function createPaintView(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const geometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
  const material = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.04 });
  const ghostMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  let mesh = null;
  let ghost = null;
  let keys = [];
  let voxels = [];
  let center = { x: 0, y: 0, z: 0 };
  let scale = 1;
  let height = 0;

  function worldPosition(voxel) {
    return new THREE.Vector3(
      (voxel.x - center.x) * VOXEL_SIZE,
      (voxel.y - center.y) * VOXEL_SIZE,
      (voxel.z - center.z) * VOXEL_SIZE,
    );
  }

  function setVoxels(surface, built) {
    if (mesh) {
      root.remove(mesh);
      mesh.dispose();
      mesh = null;
    }
    if (ghost) {
      root.remove(ghost);
      ghost.dispose();
      ghost = null;
    }

    keys = [...surface.keys()];
    voxels = [...surface.values()];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const voxel of voxels) {
      minX = Math.min(minX, voxel.x);
      maxX = Math.max(maxX, voxel.x);
      minY = Math.min(minY, voxel.y);
      maxY = Math.max(maxY, voxel.y);
      minZ = Math.min(minZ, voxel.z);
      maxZ = Math.max(maxZ, voxel.z);
    }
    center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
    const size = Math.max(maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1);
    scale = size * VOXEL_SIZE;
    height = (maxY - minY + 1) * VOXEL_SIZE;
    // 받침대 위에 올라가도록 모형을 들어 올린다.
    root.position.y = height / 2;

    mesh = new THREE.InstancedMesh(geometry, material, Math.max(keys.length, 1));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    voxels.forEach((voxel, index) => {
      matrix.makeTranslation(...worldPosition(voxel).toArray());
      mesh.setMatrixAt(index, matrix);
      color.setHex(built.initial.get(keys[index]) ?? 0xb9c0c8);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    root.add(mesh);

    ghost = new THREE.InstancedMesh(geometry, ghostMaterial, Math.max(keys.length, 1));
    voxels.forEach((voxel, index) => {
      matrix.makeTranslation(...worldPosition(voxel).toArray());
      ghost.setMatrixAt(index, matrix);
      color.setHex(built.target.get(keys[index]) ?? 0xb9c0c8);
      ghost.setColorAt(index, color);
    });
    ghost.instanceMatrix.needsUpdate = true;
    if (ghost.instanceColor) ghost.instanceColor.needsUpdate = true;
    ghost.visible = false;
    root.add(ghost);
  }

  function setColors(colors) {
    if (!mesh) return;
    const color = new THREE.Color();
    keys.forEach((key, index) => {
      color.setHex(colors.get(key) ?? 0xb9c0c8);
      mesh.setColorAt(index, color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function setGhostVisible(visible) {
    if (ghost) ghost.visible = visible;
  }

  function keyAt(instanceId) {
    if (instanceId === undefined || instanceId === null) return null;
    return keys[instanceId] ?? null;
  }

  function positionOf(key) {
    const index = keys.indexOf(key);
    if (index < 0) return null;
    return worldPosition(voxels[index]);
  }

  return {
    root,
    setVoxels,
    setColors,
    setGhostVisible,
    keyAt,
    get scale() {
      return scale;
    },
    get height() {
      return height;
    },
    get center() {
      return center;
    },
    get mesh() {
      return mesh;
    },
    get ghost() {
      return ghost;
    },
    positionOf,
  };
}
