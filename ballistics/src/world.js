// 씬 내용물. 표적 · 잔해 · 파편 · 궤적 · 발사체.
import * as THREE from "three";
import { BLOCK_HALF_M } from "./physics.js";
import { cellCenter, moveOffset } from "./grid.js";

const TARGET_COLOR = 0xd9823b;
const TARGET_EDGE = 0xffc27a;
const WALL_COLOR = 0x5b6675;
const WALL_EDGE = 0x8ea6c8;
const DEBRIS_COLOR = 0x8c5a34;
const TRAIL_MAX_POINTS = 260;

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    const material = child.material;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const entry of list) {
      if (entry.map) entry.map.dispose();
      entry.dispose();
    }
  });
}

function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

function crateMesh(color, edgeColor) {
  const group = new THREE.Group();
  const size = BLOCK_HALF_M * 2;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size * 0.98, size * 0.98, size * 0.98),
    new THREE.MeshStandardMaterial({ color, roughness: 0.74, metalness: 0.08, flatShading: true }),
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size)),
    new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.65 }),
  );
  group.add(edges);
  return group;
}

export function createWorld(scene) {
  const blocksGroup = new THREE.Group();
  const debrisGroup = new THREE.Group();
  const fxGroup = new THREE.Group();
  const previewGroup = new THREE.Group();
  scene.add(blocksGroup, debrisGroup, fxGroup, previewGroup);

  const projectile = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 20, 14),
    new THREE.MeshStandardMaterial({
      color: 0xfff0c4,
      emissive: 0xff9b3d,
      emissiveIntensity: 0.85,
      roughness: 0.34,
      metalness: 0.1,
    }),
  );
  projectile.castShadow = true;
  scene.add(projectile);

  const trailGeometry = new THREE.BufferGeometry();
  const trailPositions = new Float32Array(TRAIL_MAX_POINTS * 3);
  trailGeometry.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
  trailGeometry.setDrawRange(0, 0);
  const trail = new THREE.Points(
    trailGeometry,
    new THREE.PointsMaterial({
      color: 0xffcf87,
      size: 0.13,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  );
  trail.frustumCulled = false;
  scene.add(trail);

  const previewMaterial = new THREE.PointsMaterial({
    color: 0xffd27a,
    size: 0.17,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  function buildBlocks(blocks) {
    clearGroup(blocksGroup);
    const entries = [];
    for (const block of blocks) {
      const mesh =
        block.kind === "wall"
          ? crateMesh(WALL_COLOR, WALL_EDGE)
          : crateMesh(TARGET_COLOR, TARGET_EDGE);
      blocksGroup.add(mesh);
      entries.push({ block, mesh });
    }
    syncBlocks(entries, 0);
    return entries;
  }

  function syncBlocks(entries, time) {
    for (const entry of entries) {
      const center = cellCenter(entry.block);
      const offset = moveOffset(entry.block, time);
      entry.mesh.position.set(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      entry.mesh.rotation.y = entry.block.move ? 0 : 0;
    }
  }

  function removeBlock(entries, id) {
    const index = entries.findIndex((entry) => entry.block.id === id);
    if (index < 0) return null;
    const [entry] = entries.splice(index, 1);
    blocksGroup.remove(entry.mesh);
    disposeObject(entry.mesh);
    return entry;
  }

  function addDebris(block, position, velocity) {
    const mesh = crateMesh(DEBRIS_COLOR, 0x6b442a);
    mesh.position.set(position.x, position.y, position.z);
    debrisGroup.add(mesh);
    return {
      id: `${block.id}-debris`,
      position: { ...position },
      velocity: { ...velocity },
      rotation: { x: 0, y: 0, z: 0 },
      spin: 0,
      mesh,
    };
  }

  function removeDebris(entry) {
    debrisGroup.remove(entry.mesh);
    disposeObject(entry.mesh);
  }

  function burst(position) {
    const count = 18;
    const geometry = new THREE.SphereGeometry(0.13, 8, 6);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffc27a,
      emissive: 0xff7a2d,
      emissiveIntensity: 0.9,
      roughness: 0.6,
    });
    const group = new THREE.Group();
    group.position.set(position.x, position.y, position.z);
    const pieces = [];
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(geometry, material);
      const angle = (i / count) * Math.PI * 2;
      const lift = 0.6 + ((i * 7) % 5) * 0.22;
      mesh.userData.velocity = {
        x: Math.cos(angle) * (2.2 + (i % 3) * 0.7),
        y: lift,
        z: Math.sin(angle) * (2.2 + (i % 3) * 0.7),
      };
      mesh.userData.life = 1.1;
      group.add(mesh);
      pieces.push(mesh);
    }
    fxGroup.add(group);
    return { group, pieces, life: 1.1 };
  }

  function updateBurst(burstState, delta) {
    burstState.life -= delta;
    for (const piece of burstState.pieces) {
      const velocity = piece.userData.velocity;
      velocity.y -= 9.8 * delta;
      piece.position.x += velocity.x * delta;
      piece.position.y += velocity.y * delta;
      piece.position.z += velocity.z * delta;
      if (piece.position.y < 0.05) {
        piece.position.y = 0.05;
        velocity.y = 0;
        velocity.x *= 0.7;
        velocity.z *= 0.7;
      }
      piece.scale.setScalar(Math.max(0.05, burstState.life));
    }
    if (burstState.life <= 0) {
      fxGroup.remove(burstState.group);
      disposeObject(burstState.group);
      return true;
    }
    return false;
  }

  function setPreview(points) {
    clearGroup(previewGroup);
    const sampled = points.filter((_, index) => index % 3 === 0);
    if (sampled.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(sampled.flatMap((point) => [point.x, point.y, point.z]), 3),
    );
    previewGroup.add(new THREE.Points(geometry, previewMaterial));
  }

  function clearPreview() {
    clearGroup(previewGroup);
  }

  function setTrail(points) {
    const count = Math.min(points.length, TRAIL_MAX_POINTS);
    for (let i = 0; i < count; i += 1) {
      const point = points[points.length - count + i];
      trailPositions[i * 3] = point.x;
      trailPositions[i * 3 + 1] = point.y;
      trailPositions[i * 3 + 2] = point.z;
    }
    trailGeometry.attributes.position.needsUpdate = true;
    trailGeometry.setDrawRange(0, count);
  }

  function clearTrail() {
    trailGeometry.setDrawRange(0, 0);
  }

  function setProjectile(position, visible) {
    projectile.visible = visible;
    if (position) projectile.position.set(position.x, position.y, position.z);
  }

  return {
    projectile,
    buildBlocks,
    syncBlocks,
    removeBlock,
    addDebris,
    removeDebris,
    burst,
    updateBurst,
    setPreview,
    clearPreview,
    setTrail,
    clearTrail,
    setProjectile,
    clearGroup,
  };
}
