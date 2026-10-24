// 목표 상자 · 전개도 보기 4개.
import * as THREE from "three";

const TILE = 0.26;

export function createNetView(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.62, 0.62),
    [0, 1, 2, 3, 4, 5].map(() => new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 })),
  );
  cube.castShadow = true;
  cube.receiveShadow = true;
  cube.position.set(0, 0.72, -1.25);
  root.add(cube);

  const optionGroups = [];

  function clearOptions() {
    for (const group of optionGroups) {
      root.remove(group);
      group.traverse?.((object) => {
        if (object.geometry) object.geometry.dispose();
        const material = object.material;
        if (!material) return;
        const list = Array.isArray(material) ? material : [material];
        for (const entry of list) entry.dispose();
      });
    }
    optionGroups.length = 0;
  }

  function setOptions({ cells, options }) {
    clearOptions();
    const cols = Math.max(...cells.map((cell) => cell.col)) + 1;
    const rows = Math.max(...cells.map((cell) => cell.row)) + 1;
    const minCol = Math.min(...cells.map((cell) => cell.col));
    const minRow = Math.min(...cells.map((cell) => cell.row));

    options.forEach((colors, index) => {
      const group = new THREE.Group();
      const gridCol = index % 2;
      const gridRow = Math.floor(index / 2);
      const baseX = (gridCol - 0.5) * (cols * TILE + 0.2);
      const baseZ = (gridRow - 0.5) * (rows * TILE + 0.2);
      for (const cell of cells) {
        const color = colors.get(`${cell.col},${cell.row}`);
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(TILE * 0.92, 0.05, TILE * 0.92),
          new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 }),
        );
        tile.position.set(
          baseX + (cell.col - minCol - (cols - 1) / 2) * TILE,
          0.03,
          baseZ + (cell.row - minRow - (rows - 1) / 2) * TILE,
        );
        tile.castShadow = true;
        tile.receiveShadow = true;
        tile.userData = { option: index };
        group.add(tile);
      }
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(cols * TILE + 0.06, 0.02, rows * TILE + 0.06),
        new THREE.MeshStandardMaterial({ color: 0x232c42, roughness: 0.9 }),
      );
      base.position.set(baseX, 0.005, baseZ);
      base.receiveShadow = true;
      group.add(base);
      root.add(group);
      optionGroups.push(group);
    });
  }

  function setTarget(target) {
    const order = ["east", "west", "up", "down", "south", "north"];
    const materials = cube.material;
    order.forEach((face, index) => {
      materials[index].color.setHex(target[face]);
    });
    materials.forEach((material) => material.needsUpdate = true);
  }

  function highlight(index) {
    optionGroups.forEach((group, groupIndex) => {
      group.position.y = groupIndex === index ? 0.06 : 0;
    });
  }

  return {
    root,
    setOptions,
    setTarget,
    highlight,
    get cube() {
      return cube;
    },
    get optionGroups() {
      return optionGroups;
    },
  };
}
