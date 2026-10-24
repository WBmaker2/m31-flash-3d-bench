// 보드 칸 · 뱀과 사다리 표식 · 말 · 주사위.
import * as THREE from "three";
import { cellPosition } from "../../common/parts/board3d.js";
import { createDie } from "../../common/parts/dice3d.js";

const TILE_HEIGHT = 0.018;

export function createDiceView(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const tiles = new Map();
  const markers = new Map();
  const tokens = [];
  let die = null;
  let board = null;
  let path = [];

  function clear() {
    for (const child of [...root.children]) {
      root.remove(child);
      child.traverse?.((object) => {
        if (object.geometry) object.geometry.dispose();
        const material = object.material;
        if (!material) return;
        const list = Array.isArray(material) ? material : [material];
        for (const entry of list) entry.dispose();
      });
    }
    tiles.clear();
    markers.clear();
    tokens.length = 0;
    die = null;
  }

  function setBoard(nextBoard, nextPath) {
    clear();
    board = nextBoard;
    path = nextPath;
    const size = board.cellSize;

    for (const cell of path) {
      const position = cellPosition(cell.index, path, size);
      const isStart = cell.index === 0;
      const isGoal = cell.index === path.length - 1;
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(size * 0.94, TILE_HEIGHT, size * 0.94),
        new THREE.MeshStandardMaterial({
          color: isGoal ? 0xffd76a : isStart ? 0x7fe08a : cell.row % 2 === 0 ? 0x40506b : 0x36445c,
          roughness: 0.78,
          metalness: 0.05,
        }),
      );
      tile.position.set(position.x, TILE_HEIGHT / 2, position.z);
      tile.receiveShadow = true;
      root.add(tile);
      tiles.set(cell.index, tile);
    }

    for (const [from, to] of Object.entries(board.jumps)) {
      const forward = to > Number(from);
      const fromPos = cellPosition(Number(from), path, size);
      const toPos = cellPosition(to, path, size);
      const marker = new THREE.Group();

      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(size * 0.16, size * 0.34, 12),
        new THREE.MeshStandardMaterial({
          color: forward ? 0x7fe08a : 0xff6b5c,
          roughness: 0.5,
          metalness: 0.1,
        }),
      );
      arrow.position.set(fromPos.x, TILE_HEIGHT + 0.012, fromPos.z);
      marker.add(arrow);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(size * 0.34, size * 0.035, 8, 24),
        new THREE.MeshBasicMaterial({ color: forward ? 0x7fe08a : 0xff6b5c }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(toPos.x, TILE_HEIGHT + 0.004, toPos.z);
      marker.add(ring);

      root.add(marker);
      markers.set(Number(from), marker);
    }
  }

  function setTokens(players) {
    for (const token of tokens) root.remove(token);
    tokens.length = 0;
    for (const player of players) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.03, 0.042, 18),
        new THREE.MeshStandardMaterial({ color: player.color, roughness: 0.42, metalness: 0.15 }),
      );
      body.position.y = 0.021;
      body.castShadow = true;
      group.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.024, 16, 12),
        new THREE.MeshStandardMaterial({ color: player.color, roughness: 0.38, metalness: 0.15 }),
      );
      head.position.y = 0.058;
      head.castShadow = true;
      group.add(head);
      root.add(group);
      tokens.push(group);
    }
  }

  function tokenPosition(index) {
    const cell = path[index];
    if (!cell) return { x: 0, z: 0 };
    return cellPosition(index, path, board.cellSize);
  }

  /** 두 말이 같은 칸에 있어도 겹쳐 보이지 않게 살짝 벌린다. */
  const TOKEN_OFFSET = 0.014;

  function tokenOffset(playerIndex) {
    const sign = playerIndex % 2 === 0 ? -1 : 1;
    return { x: sign * TOKEN_OFFSET, z: sign * TOKEN_OFFSET * 0.6 };
  }

  function setTokenPosition(playerIndex, index, y = 0) {
    const token = tokens[playerIndex];
    if (!token) return;
    const position = tokenPosition(index);
    const offset = tokenOffset(playerIndex);
    token.position.set(position.x + offset.x, y, position.z + offset.z);
  }

  function setTokenPositionAt(playerIndex, x, y, z) {
    const token = tokens[playerIndex];
    if (!token) return;
    const offset = tokenOffset(playerIndex);
    token.position.set(x + offset.x, y, z + offset.z);
  }

  function ensureDie() {
    if (die) return die;
    die = createDie();
    root.add(die);
    return die;
  }

  function setDieQuaternion(quaternion) {
    ensureDie().quaternion.copy(quaternion);
  }

  function setDiePosition(x, y, z) {
    ensureDie().position.set(x, y, z);
  }

  function setDieVisible(visible) {
    ensureDie().visible = visible;
  }

  return {
    root,
    setBoard,
    setTokens,
    setTokenPosition,
    setTokenPositionAt,
    tokenOffset,
    get tokens() {
      return tokens;
    },
    tokenPosition,
    ensureDie,
    setDieQuaternion,
    setDiePosition,
    setDieVisible,
    get die() {
      return die;
    },
    get board() {
      return board;
    },
    get path() {
      return path;
    },
  };
}
