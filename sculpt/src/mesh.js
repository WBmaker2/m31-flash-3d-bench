// 마칭 테트라히드라. 부호거리장에서 등표면 삼각형 메시를 뽑는다.
//
// 순수 계산 모듈이다. three를 쓰지 않아 Node에서 그대로 테스트된다.
// 격자 모서리를 따라 생긴 교점은 키로 묶어 꼭짓점을 공유한다.
// 공유해야 메시가 물구멍 없이 이어진다.

import { BOUNDS } from "./sdf.js";

/** 확정 메시의 격자 해상도. */
export const DEFAULT_RESOLUTION = 48;

/** 드래그 중에 쓰는 가벼운 미리보기 해상도. */
export const PREVIEW_RESOLUTION = 24;

/** 셀의 꼭짓점. 0-6 은 주대각선, 7 은 그 반대편 꼭짓점이다. */
const CORNERS = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];

/** 셀을 여섯 개의 사면체로 쪼갠다. 주대각선(0-6)을 기준으로 한다. */
const TETS = [
  [0, 5, 1, 6],
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
];

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function centroidOf(points) {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
    z += point.z;
  }
  const count = points.length;
  return { x: x / count, y: y / count, z: z / count };
}

/**
 * 발산정리로 구한 부호 체적.
 * 표면이 바깥을 향한 닫힌 메시면 양수, 방향이 뒤집히면 음수가 된다.
 * 방향 오류를 이 값 하나로 잡을 수 있다.
 */
export function signedVolume(positions, indices) {
  let total = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const ia = indices[index] * 3;
    const ib = indices[index + 1] * 3;
    const ic = indices[index + 2] * 3;
    const p0 = { x: positions[ia], y: positions[ia + 1], z: positions[ia + 2] };
    const p1 = { x: positions[ib], y: positions[ib + 1], z: positions[ib + 2] };
    const p2 = { x: positions[ic], y: positions[ic + 1], z: positions[ic + 2] };
    total += dot(p0, cross(p1, p2));
  }
  return total / 6;
}

/**
 * 부호거리장에서 등표면 메시를 뽑는다.
 * @param {(point:{x:number,y:number,z:number}) => number} sdf
 * @param {{resolution?:number, bounds?:number}} options
 * @returns {{positions:Float32Array, normals:Float32Array, indices:Uint32Array, volume:number, triangles:number}}
 */
export function extractSurface(sdf, options = {}) {
  const resolution = Math.max(4, Math.floor(options.resolution ?? DEFAULT_RESOLUTION));
  const bounds = options.bounds ?? BOUNDS;
  const step = (2 * bounds) / resolution;
  const size = resolution + 1;
  const layer = size * size;

  // 1. 격자 꼭짓점의 거리값을 먼저 샘플링한다.
  const values = new Float32Array(size * size * size);
  for (let k = 0; k < size; k += 1) {
    const z = -bounds + k * step;
    for (let j = 0; j < size; j += 1) {
      const y = -bounds + j * step;
      for (let i = 0; i < size; i += 1) {
        const x = -bounds + i * step;
        values[i + j * size + k * layer] = sdf({ x, y, z });
      }
    }
  }

  const positions = [];
  const normals = [];
  const indices = [];
  const vertexMap = new Map();

  // 교점 꼭짓점을 격자 모서리 키로 묶어 이웃 셀이 같은 점을 쓰게 한다.
  function crossingVertex(gridA, gridB, pointA, pointB, valueA, valueB) {
    const denominator = valueA - valueB;
    const t = Math.abs(denominator) < 1e-20 ? 0.5 : valueA / denominator;
    const low = Math.min(gridA, gridB);
    const high = Math.max(gridA, gridB);
    const key = low * values.length + high;
    const existing = vertexMap.get(key);
    if (existing !== undefined) return existing;

    const position = {
      x: pointA.x + (pointB.x - pointA.x) * t,
      y: pointA.y + (pointB.y - pointA.y) * t,
      z: pointA.z + (pointB.z - pointA.z) * t,
    };
    const index = positions.length / 3;
    positions.push(position.x, position.y, position.z);
    normals.push(0, 0, 0);
    vertexMap.set(key, index);
    return index;
  }

  function emitTriangle(a, b, c, outward) {
    const pa = { x: positions[a * 3], y: positions[a * 3 + 1], z: positions[a * 3 + 2] };
    const pb = { x: positions[b * 3], y: positions[b * 3 + 1], z: positions[b * 3 + 2] };
    const pc = { x: positions[c * 3], y: positions[c * 3 + 1], z: positions[c * 3 + 2] };
    const normal = cross(subtract(pb, pa), subtract(pc, pa));
    // 표면은 안쪽 영역을 향해 구겨지지 않는다. 바깥쪽을 향하도록 맞춘다.
    let ia = a;
    let ib = b;
    let ic = c;
    if (dot(normal, outward) < 0) {
      ib = c;
      ic = b;
    }
    indices.push(ia, ib, ic);

    // 법선을 누적해 마지막에 정규화한다.
    const faceNormal = cross(
      {
        x: positions[ib * 3] - positions[ia * 3],
        y: positions[ib * 3 + 1] - positions[ia * 3 + 1],
        z: positions[ib * 3 + 2] - positions[ia * 3 + 2],
      },
      {
        x: positions[ic * 3] - positions[ia * 3],
        y: positions[ic * 3 + 1] - positions[ia * 3 + 1],
        z: positions[ic * 3 + 2] - positions[ia * 3 + 2],
      },
    );
    for (const index of [ia, ib, ic]) {
      normals[index * 3] += faceNormal.x;
      normals[index * 3 + 1] += faceNormal.y;
      normals[index * 3 + 2] += faceNormal.z;
    }
  }

  const cellPoints = [];
  const cellValues = [];
  const cellGrids = [];

  for (let k = 0; k < resolution; k += 1) {
    for (let j = 0; j < resolution; j += 1) {
      for (let i = 0; i < resolution; i += 1) {
        cellPoints.length = 0;
        cellValues.length = 0;
        cellGrids.length = 0;
        for (const corner of CORNERS) {
          const ci = i + corner[0];
          const cj = j + corner[1];
          const ck = k + corner[2];
          cellPoints.push({
            x: -bounds + ci * step,
            y: -bounds + cj * step,
            z: -bounds + ck * step,
          });
          cellValues.push(values[ci + cj * size + ck * layer]);
          cellGrids.push(ci + cj * size + ck * layer);
        }

        for (const tet of TETS) {
          const tetValues = tet.map((corner) => cellValues[corner]);
          // 사면체 안의 위치(0~3)를 기준으로 안/밖을 가른다.
          // 모서리 번호(0~7)로 접근하면 다른 꼭짓점의 값을 읽는다.
          const inside = [0, 1, 2, 3].filter((position) => tetValues[position] < 0);
          const outside = [0, 1, 2, 3].filter((position) => tetValues[position] >= 0);
          if (inside.length === 0 || inside.length === 4) continue;

          const crossing = (localA, localB) =>
            crossingVertex(
              cellGrids[tet[localA]],
              cellGrids[tet[localB]],
              cellPoints[tet[localA]],
              cellPoints[tet[localB]],
              tetValues[localA],
              tetValues[localB],
            );

          if (inside.length === 1) {
            const local = inside[0];
            const others = outside;
            const a = crossing(local, others[0]);
            const b = crossing(local, others[1]);
            const c = crossing(local, others[2]);
            const surface = centroidOf([
              { x: positions[a * 3], y: positions[a * 3 + 1], z: positions[a * 3 + 2] },
              { x: positions[b * 3], y: positions[b * 3 + 1], z: positions[b * 3 + 2] },
              { x: positions[c * 3], y: positions[c * 3 + 1], z: positions[c * 3 + 2] },
            ]);
            const outward = subtract(surface, cellPoints[tet[local]]);
            emitTriangle(a, b, c, outward);
            continue;
          }

          if (inside.length === 3) {
            const local = outside[0];
            const others = inside;
            const a = crossing(local, others[0]);
            const b = crossing(local, others[1]);
            const c = crossing(local, others[2]);
            const surface = centroidOf([
              { x: positions[a * 3], y: positions[a * 3 + 1], z: positions[a * 3 + 2] },
              { x: positions[b * 3], y: positions[b * 3 + 1], z: positions[b * 3 + 2] },
              { x: positions[c * 3], y: positions[c * 3 + 1], z: positions[c * 3 + 2] },
            ]);
            // 바깥쪽 꼭짓점 쪽이 표면의 바깥 방향이다.
            const outward = subtract(cellPoints[tet[local]], surface);
            emitTriangle(a, b, c, outward);
            continue;
          }

          // 두 개가 안쪽, 두 개가 바깥쪽. 표면은 사각형이 된다.
          const inner = inside;
          const outer = outside;
          const innerCenter = centroidOf(inner.map((position) => cellPoints[tet[position]]));
          const a = crossing(inner[0], outer[0]);
          const b = crossing(inner[0], outer[1]);
          const c = crossing(inner[1], outer[0]);
          const d = crossing(inner[1], outer[1]);
          const surface = centroidOf([
            { x: positions[a * 3], y: positions[a * 3 + 1], z: positions[a * 3 + 2] },
            { x: positions[b * 3], y: positions[b * 3 + 1], z: positions[b * 3 + 2] },
            { x: positions[c * 3], y: positions[c * 3 + 1], z: positions[c * 3 + 2] },
            { x: positions[d * 3], y: positions[d * 3 + 1], z: positions[d * 3 + 2] },
          ]);
          const outward = subtract(surface, innerCenter);
          emitTriangle(a, b, d, outward);
          emitTriangle(a, d, c, outward);
        }
      }
    }
  }

  for (let index = 0; index < normals.length; index += 3) {
    const x = normals[index];
    const y = normals[index + 1];
    const z = normals[index + 2];
    const length = Math.sqrt(x * x + y * y + z * z);
    if (length < 1e-12) {
      normals[index] = 0;
      normals[index + 1] = 1;
      normals[index + 2] = 0;
      continue;
    }
    normals[index] = x / length;
    normals[index + 1] = y / length;
    normals[index + 2] = z / length;
  }

  const positionArray = new Float32Array(positions);
  const normalArray = new Float32Array(normals);
  const indexArray = new Uint32Array(indices);

  return {
    positions: positionArray,
    normals: normalArray,
    indices: indexArray,
    volume: signedVolume(positionArray, indexArray),
    triangles: indexArray.length / 3,
  };
}

/**
 * 메시의 모든 간선이 정확히 두 번 쓰였는지 확인한다.
 * 닫힌 표면이면 참이어야 한다. 구멍이 나면 거짓이 된다.
 */
export function edgeCounts(indices) {
  const counts = new Map();
  for (let index = 0; index < indices.length; index += 3) {
    const triangle = [indices[index], indices[index + 1], indices[index + 2]];
    for (let edge = 0; edge < 3; edge += 1) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      const low = Math.min(a, b);
      const high = Math.max(a, b);
      const key = `${low}_${high}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}
