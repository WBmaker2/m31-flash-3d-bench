// 판 위의 톱니바퀴 · 빈 칸 · 바람개비를 그리고 돌린다.
import * as THREE from "three";
import {
  CRANK_COLOR,
  GEAR_THICKNESS,
  createGearMesh,
  createSlotMarker,
  gearColor,
} from "../../common/parts/gearMesh.js";
import { gearRadius } from "../../common/parts/gear3d.js";

const GEAR_Y = GEAR_THICKNESS / 2 + 0.001;

function createPinwheel() {
  const group = new THREE.Group();
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.4, metalness: 0.3 }),
  );
  hub.position.y = 0.03;
  group.add(hub);

  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.062, 0.05, 0.003),
      new THREE.MeshStandardMaterial({
        color: [0xff8fb1, 0xffd76a, 0x7fe08a, 0x6fc9ff][i],
        roughness: 0.5,
        metalness: 0.1,
        side: THREE.DoubleSide,
      }),
    );
    const angle = (i / 4) * Math.PI * 2;
    blade.position.set(Math.cos(angle) * 0.032, 0.032, Math.sin(angle) * 0.032);
    blade.rotation.y = -angle;
    blade.rotation.z = 0.25;
    blade.castShadow = true;
    group.add(blade);
  }
  return group;
}

const BOARD_PADDING = 0.28;
const GRID_STEP = 0.04;

/** 판 위 0.04 m 격자. */
function createGrid(sizeX, sizeZ, step = GRID_STEP) {
  const positions = [];
  const halfX = sizeX / 2;
  const halfZ = sizeZ / 2;
  for (let x = -halfX; x <= halfX + 1e-9; x += step) {
    positions.push(x, 0, -halfZ, x, 0, halfZ);
  }
  for (let z = -halfZ; z <= halfZ + 1e-9; z += step) {
    positions.push(-halfX, 0, z, halfX, 0, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x6d8177, transparent: true, opacity: 0.22 }),
  );
}

export function createGearsView(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const board = new THREE.Group();
  scene.add(board);

  const markers = new Map();
  const gears = new Map();
  let missionSlotId = null;
  let bounds = { x: 0.42, z: 0, radius: 0.6 };

  function clearGroup(group) {
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

  function setLevel(level) {
    clearGroup(root);
    clearGroup(board);
    markers.clear();
    gears.clear();
    missionSlotId = level.mission.slot;

    const xs = level.slots.map((slot) => slot.x);
    const zs = level.slots.map((slot) => slot.z);
    const minX = Math.min(...xs) - BOARD_PADDING;
    const maxX = Math.max(...xs) + BOARD_PADDING;
    const minZ = Math.min(...zs) - BOARD_PADDING;
    const maxZ = Math.max(...zs) + BOARD_PADDING;
    const sizeX = maxX - minX;
    const sizeZ = maxZ - minZ;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    bounds = { x: centerX, z: centerZ, radius: Math.max(sizeX, sizeZ) / 2 };

    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(sizeX, 0.05, sizeZ),
      new THREE.MeshStandardMaterial({ color: 0x8a5f38, roughness: 0.82, metalness: 0.05 }),
    );
    plank.position.set(centerX, -0.025, centerZ);
    plank.receiveShadow = true;
    board.add(plank);

    const felt = new THREE.Mesh(
      new THREE.BoxGeometry(sizeX - 0.05, 0.004, sizeZ - 0.05),
      new THREE.MeshStandardMaterial({ color: 0x3d4a45, roughness: 0.95, metalness: 0.02 }),
    );
    felt.position.set(centerX, 0.001, centerZ);
    felt.receiveShadow = true;
    board.add(felt);

    const grid = createGrid(sizeX - 0.06, sizeZ - 0.06);
    grid.position.set(centerX, 0.004, centerZ);
    board.add(grid);

    for (const slot of level.slots) {
      const isCrank = slot.id === level.crank.slot;
      const isMission = slot.id === missionSlotId;
      const marker = createSlotMarker({
        radius: isMission ? 0.04 : 0.018,
        color: isMission ? 0xffd76a : 0x7d8b98,
      });
      marker.position.set(slot.x, 0.002, slot.z);
      marker.userData = { slotId: slot.id, isCrank, isMission };
      root.add(marker);
      markers.set(slot.id, marker);
    }

    const crankSlot = level.slots.find((slot) => slot.id === level.crank.slot);
    const crank = createGearMesh({ teeth: level.crank.teeth, color: CRANK_COLOR, metalness: 0.5 });
    crank.position.set(crankSlot.x, GEAR_Y, crankSlot.z);
    crank.userData = { slotId: level.crank.slot, isCrank: true };
    root.add(crank);
    gears.set(level.crank.slot, crank);

    // 크랭크 손잡이.
    const handle = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.06, 10),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.5, metalness: 0.4 }),
    );
    post.position.y = 0.03;
    handle.add(post);
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45, metalness: 0.1 }),
    );
    knob.position.y = 0.062;
    knob.castShadow = true;
    handle.add(knob);
    crank.add(handle);
  }

  function setAssignment(level, assignment) {
    for (const [slotId, mesh] of [...gears]) {
      if (slotId === level.crank.slot) continue;
      root.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      gears.delete(slotId);
    }

    for (const item of assignment) {
      const slot = level.slots.find((entry) => entry.id === item.slot);
      if (!slot) continue;
      const mesh = createGearMesh({ teeth: item.teeth, color: gearColor(item.teeth) });
      mesh.position.set(slot.x, GEAR_Y, slot.z);
      mesh.userData = { slotId: slot.id, isCrank: false };
      if (slot.id === missionSlotId) {
        const pinwheel = createPinwheel();
        pinwheel.position.y = GEAR_Y;
        mesh.add(pinwheel);
      }
      root.add(mesh);
      gears.set(slot.id, mesh);
    }
  }

  function updateAngles(angles) {
    for (const [slotId, mesh] of gears) {
      const angle = angles.get(slotId);
      if (angle === undefined) continue;
      // 판의 각도 규약은 φ = atan2(z, x) 이므로 Y 회전은 부호를 뒤집는다.
      mesh.rotation.y = -angle;
    }
  }

  function setConflict(on) {
    for (const mesh of gears.values()) {
      const material = mesh.material;
      if (!material) continue;
      material.emissive?.setHex(on ? 0x662222 : 0x000000);
    }
  }

  function setMissionHighlight(on) {
    const marker = markers.get(missionSlotId);
    if (!marker) return;
    marker.scale.setScalar(on ? 1.35 : 1);
  }

  function gearObjects() {
    return [...gears.values()];
  }

  function markerObjects() {
    return [...markers.values()];
  }

  function slotRadius(slotId) {
    return gearRadius(12);
  }

  return {
    root,
    board,
    get bounds() {
      return bounds;
    },
    setLevel,
    setAssignment,
    updateAngles,
    setConflict,
    setMissionHighlight,
    gearObjects,
    markerObjects,
    slotRadius,
  };
}
