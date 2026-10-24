// 판 · 복셀 큐브.
import * as THREE from "three";
import { COLORS } from "./levels.js";

const CELL = 0.2;

export function createDrawView(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const board = new THREE.Group();
  const cubes = new THREE.Group();
  root.add(board, cubes);

  let size = { width: 8, height: 8 };
  const cubeGeometry = new THREE.BoxGeometry(CELL * 0.86, CELL * 0.86, CELL * 0.86);

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
    return {
      x: (col - (size.width - 1) / 2) * CELL,
      z: (row - (size.height - 1) / 2) * CELL,
    };
  }

  function setSize(next) {
    size = next;
    clear(board);
    const width = size.width * CELL;
    const height = size.height * CELL;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.16, 0.05, height + 0.16),
      new THREE.MeshStandardMaterial({ color: 0x3a3550, roughness: 0.9 }),
    );
    plate.position.y = -0.025;
    plate.receiveShadow = true;
    board.add(plate);

    const grid = new THREE.GridHelper(Math.max(width, height), Math.max(size.width, size.height), 0x7d74b0, 0x5f5789);
    grid.position.y = 0.004;
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    board.add(grid);
  }

  function setCubes(placement) {
    clear(cubes);
    for (const [key, color] of placement) {
      const [col, row] = key.split(",").map(Number);
      const position = cellPosition(col, row);
      const mesh = new THREE.Mesh(
        cubeGeometry,
        new THREE.MeshStandardMaterial({ color: COLORS[color] ?? 0xcccccc, roughness: 0.45, metalness: 0.06 }),
      );
      mesh.position.set(position.x, CELL * 0.45, position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { col, row };
      cubes.add(mesh);
    }
  }

  return {
    root,
    setSize,
    setCubes,
    cellPosition,
    get cubes() {
      return cubes;
    },
    get cell() {
      return CELL;
    },
  };
}
