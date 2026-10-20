// 로봇 팔 메시와 관절 회전. 좌표계는 ik.js 와 같다.
// 베이스 회전(Y) → 어깨(X) → 팔꿈치(X) 순으로 중첩한다.
import * as THREE from "three";
import { ARM } from "./ik.js";

const LINK_RADIUS = 0.11;

function box(length, width, height, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
  mesh.castShadow = true;
  return mesh;
}

export function createArm() {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xe4e0d6,
    roughness: 0.42,
    metalness: 0.28,
  });
  const jointMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8a3d,
    roughness: 0.38,
    metalness: 0.55,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b4048,
    roughness: 0.55,
    metalness: 0.6,
  });

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.1, 24), darkMaterial);
  pad.position.y = 0.05;
  pad.receiveShadow = true;
  group.add(pad);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.55, 20), bodyMaterial);
  column.position.y = 0.32;
  column.castShadow = true;
  group.add(column);

  const turret = new THREE.Group();
  turret.position.y = 0.55;
  group.add(turret);

  const swivel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.16, 20), jointMaterial);
  swivel.position.y = 0.06;
  turret.add(swivel);

  const shoulderPivot = new THREE.Group();
  shoulderPivot.position.y = ARM.shoulderHeight - 0.55;
  turret.add(shoulderPivot);

  const shoulderHousing = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), jointMaterial);
  shoulderHousing.castShadow = true;
  shoulderPivot.add(shoulderHousing);

  const upperArm = box(ARM.upperLength, 0.2, 0.2, bodyMaterial);
  upperArm.position.z = ARM.upperLength / 2;
  shoulderPivot.add(upperArm);

  const elbowPivot = new THREE.Group();
  elbowPivot.position.z = ARM.upperLength;
  shoulderPivot.add(elbowPivot);

  const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), jointMaterial);
  elbowJoint.castShadow = true;
  elbowPivot.add(elbowJoint);

  const forearm = box(ARM.forearmLength - 0.25, 0.16, 0.16, bodyMaterial);
  forearm.position.z = (ARM.forearmLength - 0.25) / 2;
  elbowPivot.add(forearm);

  const wrist = new THREE.Group();
  wrist.position.z = ARM.forearmLength - 0.25;
  elbowPivot.add(wrist);

  const wristJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 14), darkMaterial);
  wristJoint.rotation.z = Math.PI / 2;
  wrist.add(wristJoint);

  const gripper = new THREE.Group();
  gripper.position.z = 0.25;
  wrist.add(gripper);

  const jawMaterial = new THREE.MeshStandardMaterial({
    color: 0x8d939c,
    roughness: 0.35,
    metalness: 0.8,
  });
  const jawLeft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.22), jawMaterial);
  jawLeft.position.set(-0.11, 0, 0.08);
  const jawRight = jawLeft.clone();
  jawRight.position.x = 0.11;
  gripper.add(jawLeft, jawRight);

  const held = new THREE.Group();
  gripper.add(held);

  let current = { baseYaw: 0, shoulder: 0, elbow: 0 };

  function setAngles(angles) {
    current = { ...current, ...angles };
    turret.rotation.y = current.baseYaw;
    shoulderPivot.rotation.x = -current.shoulder;
    elbowPivot.rotation.x = -current.elbow;
  }

  function setJaws(open) {
    const spread = open ? 0.17 : 0.09;
    jawLeft.position.x = -spread;
    jawRight.position.x = spread;
  }

  setJaws(true);

  return {
    group,
    turret,
    gripper,
    held,
    setAngles,
    setJaws,
    get angles() {
      return { ...current };
    },
    /** 그리퍼 끝점의 월드 좌표 */
    tipPosition() {
      const position = new THREE.Vector3();
      gripper.getWorldPosition(position);
      return position;
    },
  };
}
