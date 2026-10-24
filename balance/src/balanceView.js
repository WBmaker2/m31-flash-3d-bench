// 저울판 · 받침대 · 추 · 무게중심 표시.
import * as THREE from "three";

const BEAM_LENGTH = 0.92;
const BEAM_HEIGHT = 0.035;
const BEAM_DEPTH = 0.14;

const MASS_COLORS = {
  1: 0x6fc9ff,
  2: 0x7fe08a,
  3: 0xffd76a,
  5: 0xff8fb1,
};

export function createBalanceView(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const beam = new THREE.Group();
  root.add(beam);

  const holes = new Map();
  const weights = new Map();
  let geometry = null;

  function setGeometry(next) {
    for (const child of [...beam.children]) {
      beam.remove(child);
      child.traverse?.((object) => {
        if (object.geometry) object.geometry.dispose();
        const material = object.material;
        if (!material) return;
        const list = Array.isArray(material) ? material : [material];
        for (const entry of list) entry.dispose();
      });
    }
    holes.clear();
    weights.clear();
    geometry = next;

    beam.position.set(next.fulcrumX, 0.16, 0);

    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(BEAM_LENGTH, BEAM_HEIGHT, BEAM_DEPTH),
      new THREE.MeshStandardMaterial({ color: 0xc08a4e, roughness: 0.7, metalness: 0.05 }),
    );
    plank.position.x = -next.fulcrumX;
    plank.castShadow = true;
    plank.receiveShadow = true;
    beam.add(plank);

    for (const slot of next.slots) {
      const isFulcrum = slot.id === `s${next.fulcrumSlot}`;
      const hole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.023, 0.023, 0.014, 16),
        new THREE.MeshStandardMaterial({
          color: isFulcrum ? 0xffd76a : 0x33261a,
          roughness: 0.9,
          metalness: 0.02,
        }),
      );
      hole.position.set(slot.x - next.fulcrumX, BEAM_HEIGHT / 2 - 0.001, 0);
      beam.add(hole);
      holes.set(slot.id, hole);
    }
  }

  function setWeights(placement) {
    for (const [slotId, mesh] of [...weights]) {
      beam.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      weights.delete(slotId);
    }
    if (!geometry) return;
    for (const item of placement) {
      const slot = geometry.slots.find((entry) => entry.id === item.slot);
      if (!slot) continue;
      const radius = 0.018 + item.mass * 0.005;
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 1.08, 0.05, 18),
        new THREE.MeshStandardMaterial({
          color: MASS_COLORS[item.mass] ?? 0x9fb3c8,
          roughness: 0.42,
          metalness: 0.18,
        }),
      );
      mesh.position.set(slot.x - geometry.fulcrumX, BEAM_HEIGHT / 2 + 0.026, 0);
      mesh.castShadow = true;
      mesh.userData = { slotId: item.slot };
      beam.add(mesh);
      weights.set(item.slot, mesh);
    }
  }

  function setAngle(angle) {
    beam.rotation.z = angle;
  }

  function setCenter(x) {
    if (!centerMarker) return;
    centerMarker.position.x = x;
    centerMarker.visible = Number.isFinite(x);
  }

  const centerMarker = new THREE.Mesh(
    new THREE.ConeGeometry(0.022, 0.05, 12),
    new THREE.MeshBasicMaterial({ color: 0x57d9d0 }),
  );
  centerMarker.rotation.x = Math.PI;
  centerMarker.position.set(0, -0.02, 0.1);
  root.add(centerMarker);

  return {
    root,
    setGeometry,
    setWeights,
    setAngle,
    setCenter,
    get angle() {
      return beam.rotation.z;
    },
    get weights() {
      return weights;
    },
  };
}
