const PERMUTATIONS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

const SIGN_SETS = [];
for (const s0 of [1, -1]) {
  for (const s1 of [1, -1]) {
    for (const s2 of [1, -1]) {
      SIGN_SETS.push([s0, s1, s2]);
    }
  }
}

function permutationSign(perm) {
  const inversions = [];
  for (let i = 0; i < perm.length; i += 1) {
    for (let j = i + 1; j < perm.length; j += 1) {
      if (perm[i] > perm[j]) inversions.push(1);
    }
  }
  return inversions.length % 2 === 0 ? 1 : -1;
}

export function generateRotations() {
  const rotations = [];
  for (const perm of PERMUTATIONS) {
    for (const signs of SIGN_SETS) {
      const signProduct = signs[0] * signs[1] * signs[2];
      if (permutationSign(perm) * signProduct !== 1) continue;
      rotations.push({ perm: [...perm], signs: [...signs] });
    }
  }
  return rotations;
}

export const ROTATIONS = generateRotations();

export function applyRotation(rotation, cell) {
  const [a, b, c] = rotation.perm;
  const [s0, s1, s2] = rotation.signs;
  return [rotation.signs[0] * cell[a], rotation.signs[1] * cell[b], rotation.signs[2] * cell[c]];
}

export function rotateCells(rotation, cells) {
  return cells.map((cell) => applyRotation(rotation, cell));
}

export function cellKey(cell) {
  return `${cell[0]},${cell[1]},${cell[2]}`;
}

export function sameCells(left, right) {
  if (left.length !== right.length) return false;
  const a = left.map(cellKey).sort();
  const b = right.map(cellKey).sort();
  return a.every((value, index) => value === b[index]);
}

export function normalizeCells(cells) {
  const min = [Infinity, Infinity, Infinity];
  for (const cell of cells) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], cell[axis]);
    }
  }
  return cells.map((cell) => [cell[0] - min[0], cell[1] - min[1], cell[2] - min[2]]);
}

export function distinctRotations(cells) {
  const seen = new Set();
  const result = [];
  for (const rotation of ROTATIONS) {
    const rotated = rotateCells(rotation, cells);
    const key = normalizeCells(rotated)
      .map(cellKey)
      .sort()
      .join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ rotation, cells: rotated });
  }
  return result;
}
