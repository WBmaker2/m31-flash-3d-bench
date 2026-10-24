// 판 · 선로 조각 · 역 · 기차.
import * as THREE from "three";
import { piecePorts } from "../../common/parts/rail3d.js";

const CELL = 0.42;
const DIR_VEC = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

export function createRailView(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const board = new THREE.Group();
  const pieces = new THREE.Group();
  const train = new THREE.Group();
  root.add(board, pieces, train);

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

  function createPiece(kind, orientation) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: 0x9aa7bb,
      roughness: 0.35,
      metalness: 0.65,
    });
    const half = CELL / 2;
    const add = (dx, dz, w, d) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), material);
      mesh.position.set(dx, 0.035, dz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    if (kind === "straight") {
      if (orientation % 2 === 0) add(0, 0, 0.1, CELL);
      else add(0, 0, CELL, 0.1);
    } else {
      for (const port of piecePorts(kind, orientation)) {
        const [dx, dz] = DIR_VEC[port];
        add((dx * half) / 2, (dz * half) / 2, dx ? half : 0.1, dz ? half : 0.1);
      }
    }
    return group;
  }

  function setLevel(next) {
    level = next;
    clear(board);
    clear(pieces);
    clear(train);

    const span = next.size * CELL;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(span + 0.3, 0.06, span + 0.3),
      new THREE.MeshStandardMaterial({ color: 0x3b4a3f, roughness: 0.9 }),
    );
    plate.position.y = -0.03;
    plate.receiveShadow = true;
    board.add(plate);

    const grid = new THREE.GridHelper(span, next.size, 0x6f8f78, 0x55735f);
    grid.position.y = 0.005;
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    board.add(grid);

    const station = (cell, color) => {
      const position = cellPosition(cell.col, cell.row);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.15, 0.07, 18),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
      );
      base.position.set(position.x, 0.04, position.z);
      base.castShadow = true;
      board.add(base);
    };
    station(next.start, 0x6fc9ff);
    station(next.goal, 0xffd76a);

    for (const piece of next.fixed ?? []) {
      const position = cellPosition(piece.col, piece.row);
      const mesh = createPiece(piece.kind, piece.orientation);
      mesh.position.set(position.x, 0, position.z);
      mesh.userData = { col: piece.col, row: piece.row };
      pieces.add(mesh);
    }

    const carriage = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.16, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xff6b5c, roughness: 0.4, metalness: 0.2 }),
    );
    carriage.position.y = 0.14;
    carriage.castShadow = true;
    train.add(carriage);
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.5 }),
    );
    chimney.position.set(0, 0.2, 0);
    train.add(chimney);
  }

  function setPieces(placement) {
    clear(pieces);
    for (const piece of level?.fixed ?? []) {
      const position = cellPosition(piece.col, piece.row);
      const mesh = createPiece(piece.kind, piece.orientation);
      mesh.position.set(position.x, 0, position.z);
      mesh.userData = { col: piece.col, row: piece.row };
      pieces.add(mesh);
    }
    for (const item of placement) {
      if (!item) continue;
      const position = cellPosition(item.col, item.row);
      const mesh = createPiece(item.kind, item.orientation);
      mesh.position.set(position.x, 0, position.z);
      mesh.userData = { col: item.col, row: item.row };
      pieces.add(mesh);
    }
  }

  function setTrain(path, progress01) {
    if (!path || path.length === 0) {
      train.visible = false;
      return;
    }
    train.visible = true;
    const scaled = progress01 * (path.length - 1);
    const index = Math.min(Math.floor(scaled), path.length - 2);
    const local = scaled - index;
    const a = cellPosition(path[index].col, path[index].row);
    const b = cellPosition(path[index + 1].col, path[index + 1].row);
    train.position.set(a.x + (b.x - a.x) * local, 0, a.z + (b.z - a.z) * local);
  }

  return {
    root,
    setLevel,
    setPieces,
    setTrain,
    get train() {
      return train;
    },
    get pieces() {
      return pieces;
    },
  };
}
