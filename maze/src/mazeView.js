// 미로의 메시(벽·바닥·열쇠·출구). three에 의존하는 씬 구성 모듈.
import * as THREE from "three";
import {
  CELL_SIZE_M,
  WALL_HEIGHT_M,
  WALL_THICKNESS_M,
  cellOf,
  cellToWorld,
} from "./maze.js";

const WALL_COLOR = 0x6f7a86;
const WALL_TOP_COLOR = 0x8d99a6;
const FLOOR_COLOR = 0x2b3038;
const KEY_COLOR = 0xffc247;
const EXIT_COLOR = 0x54e0a0;

/** 미로 전체를 감싸는 벽 구간 목록. 중복 없이 한 번씩만 만든다. */
export function wallSegments(maze) {
  const segments = [];
  const half = CELL_SIZE_M / 2;

  for (let index = 0; index < maze.cells.length; index += 1) {
    const { col, row } = cellOf(maze, index);
    const center = cellToWorld(maze, index);
    const cell = maze.cells[index];

    if (!cell.n) {
      segments.push({ x: center.x, z: center.z - half, axis: "x" });
    }
    if (!cell.w) {
      segments.push({ x: center.x - half, z: center.z, axis: "z" });
    }
    if (row === maze.rows - 1 && !cell.s) {
      segments.push({ x: center.x, z: center.z + half, axis: "x" });
    }
    if (col === maze.cols - 1 && !cell.e) {
      segments.push({ x: center.x + half, z: center.z, axis: "z" });
    }
  }
  return segments;
}

/** 벽에 아트 느낌을 주는 작은 노이즈 텍스처. */
function createWallTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#8b95a2";
  ctx.fillRect(0, 0, size, size);

  let seed = 20261;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 900; i += 1) {
    const shade = 120 + Math.floor(random() * 70);
    ctx.fillStyle = `rgba(${shade}, ${shade + 6}, ${shade + 14}, ${0.12 + random() * 0.16})`;
    ctx.fillRect(Math.floor(random() * size), Math.floor(random() * size), 2 + Math.floor(random() * 3), 2);
  }
  ctx.strokeStyle = "rgba(40, 48, 60, 0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.4, 1.4);
  return texture;
}

/** 바닥에 놓이는 얇은 격자 무늬. */
function createFloorTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#2f3540";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(96, 112, 136, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

export function createMazeView(scene, maze) {
  const root = new THREE.Group();
  scene.add(root);

  const width = maze.cols * CELL_SIZE_M;
  const depth = maze.rows * CELL_SIZE_M;

  const floorTexture = createFloorTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({
      color: FLOOR_COLOR,
      map: floorTexture,
      roughness: 0.95,
      metalness: 0.04,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const grid = new THREE.GridHelper(Math.max(width, depth), Math.max(maze.cols, maze.rows), 0x3d4756, 0x333c48);
  grid.position.y = 0.008;
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  root.add(grid);

  const segments = wallSegments(maze);
  const wallGeometry = new THREE.BoxGeometry(
    WALL_THICKNESS_M,
    WALL_HEIGHT_M,
    CELL_SIZE_M + WALL_THICKNESS_M,
  );
  const wallTexture = createWallTexture();
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: WALL_COLOR,
    map: wallTexture,
    roughness: 0.88,
    metalness: 0.08,
  });
  const walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, segments.length);
  walls.castShadow = true;
  walls.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const position = new THREE.Vector3();
  segments.forEach((segment, index) => {
    position.set(segment.x, WALL_HEIGHT_M / 2, segment.z);
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), segment.axis === "z" ? Math.PI / 2 : 0);
    matrix.compose(position, quaternion, scale);
    walls.setMatrixAt(index, matrix);
  });
  walls.instanceMatrix.needsUpdate = true;
  root.add(walls);

  const capMaterial = new THREE.MeshStandardMaterial({ color: WALL_TOP_COLOR, roughness: 0.6, metalness: 0.2 });
  const caps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(WALL_THICKNESS_M * 1.25, 0.08, CELL_SIZE_M + WALL_THICKNESS_M * 1.25),
    capMaterial,
    segments.length,
  );
  segments.forEach((segment, index) => {
    position.set(segment.x, WALL_HEIGHT_M + 0.04, segment.z);
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), segment.axis === "z" ? Math.PI / 2 : 0);
    matrix.compose(position, quaternion, scale);
    caps.setMatrixAt(index, matrix);
  });
  caps.instanceMatrix.needsUpdate = true;
  root.add(caps);

  // 열쇠
  const keyGroup = new THREE.Group();
  const keyGeometry = new THREE.OctahedronGeometry(0.22, 0);
  const keyMaterial = new THREE.MeshStandardMaterial({
    color: KEY_COLOR,
    emissive: 0xc97a10,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.6,
  });
  const keyMeshes = new Map();
  for (const key of maze.keys) {
    const mesh = new THREE.Mesh(keyGeometry, keyMaterial);
    const position3 = cellToWorld(maze, key.cell);
    mesh.position.set(position3.x, 0.85, position3.z);
    mesh.castShadow = true;
    keyGroup.add(mesh);
    keyMeshes.set(key.id, mesh);
  }
  root.add(keyGroup);

  // 출구
  const exitPoint = cellToWorld(maze, maze.exit);
  const exit = new THREE.Group();
  const exitPad = new THREE.Mesh(
    new THREE.CylinderGeometry(CELL_SIZE_M * 0.32, CELL_SIZE_M * 0.32, 0.04, 32),
    new THREE.MeshStandardMaterial({
      color: EXIT_COLOR,
      emissive: 0x1f7a54,
      emissiveIntensity: 0.9,
      roughness: 0.4,
    }),
  );
  exitPad.position.set(exitPoint.x, 0.03, exitPoint.z);
  exitPad.receiveShadow = true;
  exit.add(exitPad);

  const exitBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(CELL_SIZE_M * 0.28, CELL_SIZE_M * 0.28, 2.2, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: EXIT_COLOR,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  exitBeam.position.set(exitPoint.x, 1.1, exitPoint.z);
  exit.add(exitBeam);
  root.add(exit);

  // 문(잠긴 통로). 열쇠를 얻으면 사라진다.
  const gateMeshes = new Map();
  for (const gate of maze.gates) {
    const { dx, dy } = { dx: [0, 1, 0, -1][gate.dir], dy: [-1, 0, 1, 0][gate.dir] };
    const from = cellToWorld(maze, gate.cell);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        dx !== 0 ? WALL_THICKNESS_M * 1.2 : CELL_SIZE_M,
        WALL_HEIGHT_M * 0.9,
        dy !== 0 ? WALL_THICKNESS_M * 1.2 : CELL_SIZE_M,
      ),
      new THREE.MeshStandardMaterial({
        color: 0xc25a4a,
        emissive: 0x61180f,
        emissiveIntensity: 0.6,
        roughness: 0.45,
        metalness: 0.25,
      }),
    );
    mesh.position.set(
      from.x + (dx * CELL_SIZE_M) / 2,
      (WALL_HEIGHT_M * 0.9) / 2,
      from.z + (dy * CELL_SIZE_M) / 2,
    );
    mesh.castShadow = true;
    root.add(mesh);
    gateMeshes.set(gate.id, mesh);
  }

  function openGate(gateId) {
    const mesh = gateMeshes.get(gateId);
    if (!mesh) return;
    root.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    gateMeshes.delete(gateId);
  }

  function collectKey(keyId) {
    const mesh = keyMeshes.get(keyId);
    if (!mesh) return;
    keyGroup.remove(mesh);
    keyMeshes.delete(keyId);
  }

  function update(elapsed) {
    for (const mesh of keyMeshes.values()) {
      mesh.rotation.y = elapsed * 1.8;
      mesh.rotation.x = Math.sin(elapsed * 1.4) * 0.3;
      mesh.position.y = 0.85 + Math.sin(elapsed * 2.2) * 0.08;
    }
    exitPad.material.emissiveIntensity = 0.6 + Math.sin(elapsed * 2.4) * 0.35;
  }

  function dispose() {
    root.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      const material = object.material;
      if (!material) return;
      const list = Array.isArray(material) ? material : [material];
      for (const entry of list) entry.dispose();
    });
    scene.remove(root);
  }

  return { root, openGate, collectKey, update, dispose, gateMeshes, keyMeshes };
}
