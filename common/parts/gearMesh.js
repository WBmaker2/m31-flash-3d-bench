// 톱니바퀴 3D 부품. 다른 게임에서도 재사용한다.
import * as THREE from "three";
import { TOOTH_MODULE, gearRadius } from "./gear3d.js";

export const GEAR_THICKNESS = 0.026;
export const ADDENDUM = TOOTH_MODULE * 0.55;
export const DEDENDUM = TOOTH_MODULE * 0.65;

/** 톱니 수마다 색이 다르다. 크기를 색으로 바로 알 수 있게. */
export const GEAR_COLORS = {
  8: 0xffb454,
  12: 0x6fc9ff,
  16: 0x7fe08a,
  20: 0xff8fb1,
  24: 0xc7a2ff,
};

export const CRANK_COLOR = 0xffd76a;

export function gearColor(teeth) {
  return GEAR_COLORS[teeth] ?? 0x9fb3c8;
}

/**
 * 톱니바퀴 단면. 톱니는 피치 각도의 30~70% 를 차지하고, 그 사이가 홈이 된다.
 * 톱니는 홈보다 좁아서 상대 톱니와 겹치지 않는다.
 */
export function gearShape(teeth, holeRatio = 0.26) {
  const r = gearRadius(teeth);
  const outer = r + ADDENDUM;
  const root = Math.max(r - DEDENDUM, r * 0.55);
  const pitch = (Math.PI * 2) / teeth;
  const profile = [
    [0.0, root],
    [0.3, root],
    [0.4, outer],
    [0.6, outer],
    [0.7, root],
  ];

  const shape = new THREE.Shape();
  const points = [];
  for (let k = 0; k < teeth; k += 1) {
    for (const [fraction, radius] of profile) {
      const angle = (k + fraction) * pitch;
      points.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
    }
  }
  shape.setFromPoints(points);

  const axle = new THREE.Path();
  axle.absarc(0, 0, r * holeRatio, 0, Math.PI * 2, true);
  shape.holes.push(axle);

  const lightCount = teeth >= 20 ? 6 : 4;
  const lightRadius = r * 0.12;
  const lightDistance = r * 0.55;
  for (let i = 0; i < lightCount; i += 1) {
    const angle = (i / lightCount) * Math.PI * 2 + Math.PI / lightCount;
    const hole = new THREE.Path();
    hole.absarc(
      Math.cos(angle) * lightDistance,
      Math.sin(angle) * lightDistance,
      lightRadius,
      0,
      Math.PI * 2,
      true,
    );
    shape.holes.push(hole);
  }

  return shape;
}

/** 바닥에 눕힌 톱니바퀴 지오메트리. 중심이 원점이고 Y축 두께다. */
export function createGearGeometry({ teeth, thickness = GEAR_THICKNESS, holeRatio = 0.26 }) {
  const geometry = new THREE.ExtrudeGeometry(gearShape(teeth, holeRatio), {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.0016,
    bevelSize: 0.0016,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGearMesh({ teeth, color, thickness = GEAR_THICKNESS, metalness = 0.35 }) {
  const mesh = new THREE.Mesh(
    createGearGeometry({ teeth, thickness }),
    new THREE.MeshStandardMaterial({
      color: color ?? gearColor(teeth),
      roughness: 0.42,
      metalness,
      flatShading: false,
    }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** 빈 칸 표시. 얇은 링과 가운데 핀. */
export function createSlotMarker({ radius = 0.016, color = 0x6a7a8c } = {}) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, radius * 0.22, 6, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.004;
  group.add(ring);

  const pin = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, 0.012, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 }),
  );
  pin.position.y = 0.006;
  group.add(pin);
  return group;
}
