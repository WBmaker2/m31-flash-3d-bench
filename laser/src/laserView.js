// 판 · 거울 · 발사기 · 목표 · 빛줄기.
import * as THREE from "three";
import { MIRROR_NORMAL } from "../../common/parts/optic3d.js";

const CELL = 0.4;

export function createLaserView(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const board = new THREE.Group();
  const mirrors = new Map();
  const beam = new THREE.Group();
  root.add(board, beam);

  let level = null;

  function clear(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse?.((object) => {
        if (object.geometry) object.geometry.dispose();
        const material = object.material;
        if (!material) return;
        const list = Array.isArray(material) ? material : [material];
        for (const entry of list) entry.dispose();
      });
    }
  }

  function cellPosition(col, row) {
    const offset = (level.size - 1) / 2;
    return { x: (col - offset) * CELL, z: (row - offset) * CELL };
  }

  function setLevel(next) {
    level = next;
    clear(board);
    clear(beam);
    mirrors.clear();

    const span = next.size * CELL;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(span + 0.2, 0.06, span + 0.2),
      new THREE.MeshStandardMaterial({ color: 0x2b3550, roughness: 0.85, metalness: 0.08 }),
    );
    plate.position.y = -0.03;
    plate.receiveShadow = true;
    board.add(plate);

    const grid = new THREE.GridHelper(span, next.size, 0x5f7bb0, 0x44587f);
    grid.position.y = 0.005;
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    board.add(grid);

    for (const mirror of next.mirrors) {
      const position = cellPosition(mirror.col, mirror.row);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 0.82, 0.26, 0.035),
        new THREE.MeshStandardMaterial({
          color: 0xbfd8ff,
          roughness: 0.12,
          metalness: 0.85,
        }),
      );
      mesh.position.set(position.x, 0.13, position.z);
      mesh.castShadow = true;
      mesh.userData = { col: mirror.col, row: mirror.row };
      board.add(mesh);
      mirrors.set(`${mirror.col},${mirror.row}`, mesh);
    }

    const emitterPosition = cellPosition(next.emitter.col, next.emitter.row);
    const emitter = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x3b4a6b, roughness: 0.5, metalness: 0.4 }),
    );
    emitter.position.set(emitterPosition.x, 0.12, emitterPosition.z);
    emitter.castShadow = true;
    board.add(emitter);

    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xff5d73 }),
    );
    const angle = { east: 0, west: Math.PI, north: -Math.PI / 2, south: Math.PI / 2 }[next.emitter.direction];
    lens.position.set(
      emitterPosition.x + Math.sin(angle) * 0.15,
      0.12,
      emitterPosition.z + Math.cos(angle) * 0.15,
    );
    board.add(lens);

    const targetPosition = cellPosition(next.target.col, next.target.row);
    const target = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 20, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffd76a,
        emissive: 0xffb347,
        emissiveIntensity: 0.7,
        roughness: 0.3,
        metalness: 0.2,
      }),
    );
    target.position.set(targetPosition.x, 0.16, targetPosition.z);
    target.castShadow = true;
    board.add(target);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.018, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd76a }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(targetPosition.x, 0.02, targetPosition.z);
    board.add(ring);
  }

  function setMirrors(orientations) {
    for (const [cell, mesh] of mirrors) {
      const normal = MIRROR_NORMAL[orientations.get(cell)] ?? MIRROR_NORMAL.slash;
      mesh.rotation.y = Math.atan2(normal.x, normal.z);
    }
  }

  function setBeam(path) {
    clear(beam);
    for (let i = 1; i < path.length; i += 1) {
      const a = cellPosition(path[i - 1].col, path[i - 1].row);
      const b = cellPosition(path[i].col, path[i].row);
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.07, length),
        new THREE.MeshBasicMaterial({ color: 0xff5d73 }),
      );
      segment.position.set((a.x + b.x) / 2, 0.12, (a.z + b.z) / 2);
      segment.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      beam.add(segment);
    }
  }

  return {
    root,
    setLevel,
    setMirrors,
    setBeam,
    get mirrors() {
      return mirrors;
    },
  };
}
