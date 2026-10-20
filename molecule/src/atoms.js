import * as THREE from "three";
import { ELEMENTS } from "./elements.js";
import { orthogonalBasis } from "./chemistry.js";

const UP = new THREE.Vector3(0, 1, 0);

function makeLabel(symbol) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.font = "700 68px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(6, 20, 26, 0.92)";
  ctx.strokeText(symbol, 64, 68);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(symbol, 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }),
  );
  sprite.scale.set(0.46, 0.46, 1);
  return sprite;
}

function createAtomGroup(element) {
  const info = ELEMENTS[element];
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({
    color: info.color,
    roughness: 0.3,
    metalness: 0.14,
    emissive: new THREE.Color(info.color).multiplyScalar(0.3),
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(info.radius, 26, 20), material);
  group.add(mesh);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(info.radius * 1.3, 18, 14),
    new THREE.MeshBasicMaterial({
      color: info.color,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(glow);

  const label = makeLabel(info.symbol);
  label.position.y = info.radius + 0.3;
  group.add(label);

  return { group, mesh, label };
}

function createBondGroup(order) {
  const group = new THREE.Group();
  const radius = order === 1 ? 0.16 : order === 2 ? 0.11 : 0.095;
  const cylinders = [];
  for (let i = 0; i < order; i += 1) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xa8ecff,
      roughness: 0.22,
      metalness: 0.25,
      emissive: 0x1b5c78,
    });
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 14), material);
    group.add(cylinder);
    cylinders.push(cylinder);
  }
  const proxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 1, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  cylinders[0].add(proxy);
  return { group, cylinders, proxy };
}

export function disposeGroup(group) {
  group.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    const material = object.material;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const entry of list) {
      if (entry.map) entry.map.dispose();
      entry.dispose();
    }
  });
}

export function createAtomFactory(scene) {
  const atoms = [];
  const bonds = [];
  let nextAtomId = 1;
  let nextBondId = 1;

  function byId(id) {
    return atoms.find((atom) => atom.id === id) ?? null;
  }

  function add(element, position) {
    const id = `atom-${nextAtomId}`;
    nextAtomId += 1;
    const { group, mesh, label } = createAtomGroup(element);
    group.position.copy(position);
    mesh.userData.atomId = id;
    scene.add(group);
    const atom = {
      id,
      element,
      group,
      mesh,
      label,
      radius: ELEMENTS[element].radius,
      target: position.clone(),
    };
    atoms.push(atom);
    return atom;
  }

  function removeBond(bondId) {
    const index = bonds.findIndex((bond) => bond.id === bondId);
    if (index === -1) return;
    const [bond] = bonds.splice(index, 1);
    scene.remove(bond.group);
    disposeGroup(bond.group);
  }

  function remove(atomId) {
    const index = atoms.findIndex((atom) => atom.id === atomId);
    if (index === -1) return;
    const [atom] = atoms.splice(index, 1);
    scene.remove(atom.group);
    disposeGroup(atom.group);
    for (const bond of bonds.filter((entry) => entry.a === atomId || entry.b === atomId)) {
      removeBond(bond.id);
    }
  }

  function addBond(a, b, order = 1) {
    const id = `bond-${nextBondId}`;
    nextBondId += 1;
    const { group, cylinders, proxy } = createBondGroup(order);
    proxy.userData.bondId = id;
    scene.add(group);
    const bond = { id, a, b, order, group, cylinders, proxy };
    bonds.push(bond);
    return bond;
  }

  function clear() {
    for (const bond of [...bonds]) removeBond(bond.id);
    for (const atom of [...atoms]) {
      scene.remove(atom.group);
      disposeGroup(atom.group);
    }
    atoms.length = 0;
    bonds.length = 0;
    nextAtomId = 1;
    nextBondId = 1;
  }

  function updateBondTransform(bond) {
    const a = byId(bond.a);
    const b = byId(bond.b);
    if (!a || !b) return;
    const from = a.group.position;
    const to = b.group.position;
    const delta = new THREE.Vector3().subVectors(to, from);
    const length = delta.length();
    if (length < 1e-5) return;
    const axis = delta.clone().normalize();
    const midpoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    const { u } = orthogonalBasis(axis);
    const count = bond.cylinders.length;
    bond.cylinders.forEach((cylinder, index) => {
      let offset = 0;
      if (count === 2) offset = index === 0 ? 0.14 : -0.14;
      else if (count === 3) offset = index === 1 ? 0 : index === 0 ? 0.14 : -0.14;
      cylinder.position.copy(midpoint).addScaledVector(u, offset);
      cylinder.scale.set(1, length, 1);
      cylinder.quaternion.setFromUnitVectors(UP, axis);
    });
  }

  function updateAll() {
    for (const bond of bonds) updateBondTransform(bond);
  }

  return { atoms, bonds, add, remove, removeBond, addBond, clear, byId, updateBondTransform, updateAll };
}
