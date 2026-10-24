// 주사위 3D 부품. 다른 게임에서도 재사용한다.
import * as THREE from "three";
import { DIE_FACES } from "./board3d.js";

export const DIE_SIZE = 0.09;

/** BoxGeometry 의 재질 순서: +X, -X, +Y, -Y, +Z, -Z */
const FACE_MATERIAL_INDEX = {
  2: 0,
  5: 1,
  1: 2,
  6: 3,
  3: 4,
  4: 5,
};

const PIP_LAYOUT = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.5, 0.5],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  6: [
    [0.28, 0.24],
    [0.28, 0.5],
    [0.28, 0.76],
    [0.72, 0.24],
    [0.72, 0.5],
    [0.72, 0.76],
  ],
};

function createFaceTexture(value) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f6f1e4";
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = "#2b2f38";
  for (const [x, y] of PIP_LAYOUT[value]) {
    ctx.beginPath();
    ctx.arc(x * 128, y * 128, 15, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** 주사위 메시. 각 면에 점이 찍힌다. */
export function createDie({ size = DIE_SIZE } = {}) {
  const materials = [];
  for (const value of [2, 5, 1, 6, 3, 4]) {
    materials.push(
      new THREE.MeshStandardMaterial({
        map: createFaceTexture(value),
        roughness: 0.42,
        metalness: 0.04,
      }),
    );
  }
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size, 2, 2, 2), materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** 면 값이 위를 향하게 하는 자세. */
export function settleQuaternion(value) {
  const normal = DIE_FACES[value];
  const target = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(normal.x, normal.y, normal.z),
    new THREE.Vector3(0, 1, 0),
  );
  return target;
}

/** 굴림 결과. 시작 자세에서 끝 자세로animates 한다. */
export function createRoll({ value, start, spinTurns = 1, spinAngle = 0 }) {
  const settle = settleQuaternion(value);
  const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spinAngle);
  const end = spin.multiply(settle);
  return {
    value,
    start: start ? start.clone() : new THREE.Quaternion(),
    end,
    turns: spinTurns,
  };
}

/** 진행도(0~1)에서 자세. */
export function rollQuaternion(roll, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const eased = 1 - (1 - t) * (1 - t) * (1 - t);
  return new THREE.Quaternion().slerpQuaternions(roll.start, roll.end, eased);
}

/** 굴리는 동안의 높이. 시작과 끝은 바닥이다. */
export function rollHeight(progress, hop = 0.12) {
  const t = Math.max(0, Math.min(1, progress));
  return Math.sin(Math.PI * t) * hop;
}

export { FACE_MATERIAL_INDEX };
