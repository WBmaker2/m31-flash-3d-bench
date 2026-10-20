// 발사대. 포신 앞끝이 발사 지점(0, 1.6, 0)에 고정된 스위볼식 구조다.
// 조준각을 바꾸면 포신이 발사 지점을 중심으로 회전한다.
import * as THREE from "three";
import { MUZZLE_HEIGHT_M, directionFromAngles } from "./aim.js";

const TUBE_LENGTH_M = 1.35;
const TUBE_MOUTH_GAP = 0.34;

export function createLauncher() {
  const group = new THREE.Group();

  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a5058,
    roughness: 0.82,
    metalness: 0.12,
    flatShading: true,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0xc08a3e,
    roughness: 0.38,
    metalness: 0.72,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c3138,
    roughness: 0.6,
    metalness: 0.5,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.4, 0.42, 24), stoneMaterial);
  base.position.y = 0.21;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.07, 10, 28), metalMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.42;
  group.add(rim);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.44, 1.18, 18), stoneMaterial);
  column.position.y = 0.42 + 0.59;
  column.castShadow = true;
  group.add(column);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 10, 22), metalMaterial);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.34;
  group.add(collar);

  const tubePivot = new THREE.Group();
  tubePivot.position.set(0, MUZZLE_HEIGHT_M, 0);
  group.add(tubePivot);

  // 포신은 발사 지점보다 뒤에 있다. 앞쪽 끝을 비워 둬야 발사체가 가려지지 않는다.
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, TUBE_LENGTH_M, 22), metalMaterial);
  tube.rotation.x = Math.PI / 2;
  tube.position.z = -TUBE_MOUTH_GAP - TUBE_LENGTH_M / 2;
  tube.castShadow = true;
  tubePivot.add(tube);

  const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 22), darkMaterial);
  band.position.z = -TUBE_MOUTH_GAP - 0.24;
  tubePivot.add(band);

  const sight = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 24), metalMaterial);
  sight.position.z = 0.04;
  tubePivot.add(sight);

  // 조준선. 발사 지점에서 앞쪽으로 뻗어 어느 방향을 겨냥하는지 보여 준다.
  const rodMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.6,
  });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 8), rodMaterial);
  rod.rotation.x = Math.PI / 2;
  rod.position.z = 1.2;
  tubePivot.add(rod);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 10), rodMaterial);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 2.5;
  tubePivot.add(tip);

  const forward = new THREE.Vector3(0, 0, 1);
  const target = new THREE.Vector3();

  function setAim(yawDeg, pitchDeg) {
    const direction = directionFromAngles(yawDeg, pitchDeg);
    target.set(direction.x, direction.y, direction.z);
    tubePivot.quaternion.setFromUnitVectors(forward, target);
  }

  setAim(0, 30);

  function dispose() {
    group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) object.material.dispose();
    });
  }

  return { group, setAim, dispose, muzzle: new THREE.Vector3(0, MUZZLE_HEIGHT_M, 0) };
}
