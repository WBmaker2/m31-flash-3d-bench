// 무리 · 링 게이트 · 불빛의 메시. three에 의존하는 씬 구성 모듈.
import * as THREE from "three";
import { GATE_RADIUS } from "./levels.js";

const BODY_RADIUS = 0.18;
const BODY_LENGTH = 0.62;
const WING_SPAN = 0.6;
const MAX_BIRDS = 512;

/** 날개 두 장을 펼친 얇은 삼각형. */
function createWingGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    0, 0, 0.12,
    -WING_SPAN, 0, -0.16,
    0, 0, -0.16,
    0, 0, 0.12,
    0, 0, -0.16,
    WING_SPAN, 0, -0.16,
  ]);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createFlockView(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const bodyGeometry = new THREE.ConeGeometry(BODY_RADIUS, BODY_LENGTH, 5);
  bodyGeometry.rotateX(-Math.PI / 2);
  bodyGeometry.translate(0, 0, BODY_LENGTH * 0.15);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x4d6f96,
    roughness: 0.62,
    metalness: 0.18,
    flatShading: true,
  });
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0x9fc4e8,
    roughness: 0.7,
    metalness: 0.1,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  // 인스턴스 배열은 최대 개체 수만큼 미리 잡아 둔다. 나중에 늘리면 그릴 수 없다.
  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, MAX_BIRDS);
  const wings = new THREE.InstancedMesh(createWingGeometry(), wingMaterial, MAX_BIRDS);
  bodies.frustumCulled = false;
  wings.frustumCulled = false;
  root.add(bodies, wings);

  const lightGroup = new THREE.Group();
  const lightCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff0b0 }),
  );
  lightGroup.add(lightCore);
  const lightHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xffc247, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  lightGroup.add(lightHalo);
  const light = new THREE.PointLight(0xffd08a, 3.2, 26, 1.4);
  lightGroup.add(light);
  root.add(lightGroup);

  const gateGroup = new THREE.Group();
  root.add(gateGroup);

  const dummy = new THREE.Object3D();
  const forward = new THREE.Vector3(0, 0, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  let count = 0;

  function setCount(total) {
    count = total;
    bodies.count = total;
    wings.count = total;
  }

  /** 새 무리를 그린다. 속도 방향을 보고 몸과 날개를 세운다. */
  function update(birds, elapsed) {
    for (let i = 0; i < birds.length; i += 1) {
      const bird = birds[i];
      direction.set(bird.velocity.x, bird.velocity.y, bird.velocity.z);
      if (direction.lengthSq() < 1e-8) direction.set(0, 0, 1);
      direction.normalize();

      dummy.position.set(bird.position.x, bird.position.y, bird.position.z);
      dummy.quaternion.setFromUnitVectors(forward, direction);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);

      // 날개는 몸을 기준으로 살짝 젖혀 flapping 한다.
      const flap = Math.sin(elapsed * 9 + i * 0.7) * 0.35;
      dummy.rotateZ(flap);
      dummy.updateMatrix();
      wings.setMatrixAt(i, dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate = true;
    wings.instanceMatrix.needsUpdate = true;
  }

  function setLight(position, elapsed) {
    lightGroup.position.set(position.x, position.y, position.z);
    const pulse = 1 + Math.sin(elapsed * 3) * 0.08;
    lightCore.scale.setScalar(pulse);
    lightHalo.scale.setScalar(pulse * 1.1);
  }

  /** 링 게이트를 만든다. activeIndex 의 링만 밝게 켠다. */
  function setGates(gates, activeIndex) {
    clearGroup(gateGroup);
    gates.forEach((gate, index) => {
      const active = index === activeIndex;
      const done = index < activeIndex;
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(GATE_RADIUS, active ? 0.26 : 0.16, 10, 40),
        new THREE.MeshStandardMaterial({
          color: done ? 0x3c6b52 : active ? 0x54e0a0 : 0x6b7482,
          emissive: done ? 0x14301f : active ? 0x1f7a54 : 0x1a1e26,
          emissiveIntensity: active ? 1.1 : 0.35,
          roughness: 0.4,
          metalness: 0.35,
        }),
      );
      mesh.position.set(gate.center.x, gate.center.y, gate.center.z);
      mesh.quaternion.setFromUnitVectors(forward, new THREE.Vector3(gate.normal.x, gate.normal.y, gate.normal.z));
      gateGroup.add(mesh);
    });
  }

  function clearGroup(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.geometry?.dispose();
      if (child.material) {
        const list = Array.isArray(child.material) ? child.material : [child.material];
        for (const entry of list) entry.dispose();
      }
    }
  }

  function dispose() {
    clearGroup(root);
    scene.remove(root);
  }

  return { root, setCount, update, setLight, setGates, dispose, get count() { return count; } };
}
