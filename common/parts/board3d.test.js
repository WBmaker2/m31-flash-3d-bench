import { describe, expect, it } from "vitest";
import {
  DIE_FACES,
  advancePath,
  cellPosition,
  createRng,
  faceFromUp,
  makeQuestion,
  rollDie,
  serpentinePath,
  upFromQuaternion,
} from "./board3d.js";

describe("시드 난수", () => {
  it("같은 시드는 같은 수열을 만든다", () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const first = Array.from({ length: 100 }, () => a());
    const second = Array.from({ length: 100 }, () => b());
    expect(first).toEqual(second);
  });

  it("다른 시드는 다른 수열을 만든다", () => {
    const a = createRng(1);
    const b = createRng(2);
    const first = Array.from({ length: 20 }, () => a());
    const second = Array.from({ length: 20 }, () => b());
    expect(first).not.toEqual(second);
  });

  it("값은 0 이상 1 미만이다", () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("주사위", () => {
  it("1200회 평균은 3.5 다", () => {
    const rng = createRng(2026);
    const rounds = 1200;
    let sum = 0;
    const counts = new Map();
    for (let i = 0; i < rounds; i += 1) {
      const value = rollDie(rng);
      sum += value;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    expect(sum / rounds).toBeGreaterThan(3.35);
    expect(sum / rounds).toBeLessThan(3.65);
    for (const [value, count] of counts) {
      expect(count / rounds, `${value} 면이 너무 자주 나왔습니다`).toBeGreaterThan(0.14);
      expect(count / rounds, `${value} 면이 너무 적게 나왔습니다`).toBeLessThan(0.2);
    }
  });

  it("값은 1 부터 6 사이다", () => {
    const rng = createRng(99);
    for (let i = 0; i < 200; i += 1) {
      const value = rollDie(rng);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });

  it("마주 보는 면의 합은 7 이다", () => {
    for (const [value, normal] of Object.entries(DIE_FACES)) {
      const opposite = DIE_FACES[7 - Number(value)];
      const dot = normal.x * opposite.x + normal.y * opposite.y + normal.z * opposite.z;
      expect(dot).toBe(-1);
    }
  });
});

describe("자세에서 면 읽기", () => {
  it("위쪽 방향으로 면이 읽힌다", () => {
    expect(faceFromUp({ x: 0, y: 1, z: 0 }).face).toBe(1);
    expect(faceFromUp({ x: 0, y: -1, z: 0 }).face).toBe(6);
    expect(faceFromUp({ x: 1, y: 0, z: 0 }).face).toBe(2);
    expect(faceFromUp({ x: -1, y: 0, z: 0 }).face).toBe(5);
    expect(faceFromUp({ x: 0, y: 0, z: 1 }).face).toBe(3);
    expect(faceFromUp({ x: 0, y: 0, z: -1 }).face).toBe(4);
  });

  it("회전에서 위쪽 방향을 읽는다", () => {
    expect(upFromQuaternion({ x: 0, y: 0, z: 0, w: 1 })).toEqual({ x: 0, y: 1, z: 0 });
    const half = Math.PI / 4;
    // Z 축으로 +90 도 돌면 위쪽(+Y) 은 -X 쪽을 향한다.
    const up = upFromQuaternion({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) });
    expect(up.x).toBeCloseTo(-1, 9);
    expect(up.y).toBeCloseTo(0, 9);
    expect(up.z).toBeCloseTo(0, 9);
  });

  it("읽은 면의 정렬도가 1 에 가깝다", () => {
    const result = faceFromUp({ x: 0, y: 1, z: 0 });
    expect(result.dot).toBeCloseTo(1, 12);
  });
});

describe("보드 경로", () => {
  it("모든 칸을 한 번씩 지난다", () => {
    const path = serpentinePath(5, 5);
    expect(path).toHaveLength(25);
    const keys = new Set(path.map((cell) => `${cell.col},${cell.row}`));
    expect(keys.size).toBe(25);
  });

  it("이어진 두 칸은 실제로 맞닿는다", () => {
    const path = serpentinePath(5, 6);
    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1];
      const b = path[i];
      const distance = Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
      expect(distance).toBe(1);
    }
  });

  it("칸 좌표가 가운데를 기준으로 놓인다", () => {
    const path = serpentinePath(5, 5);
    const first = cellPosition(0, path, 0.17);
    const last = cellPosition(path.length - 1, path, 0.17);
    expect(first.x).toBeCloseTo(-0.34, 9);
    expect(first.z).toBeCloseTo(-0.34, 9);
    expect(last.x).toBeCloseTo(0.34, 9);
    expect(last.z).toBeCloseTo(0.34, 9);
  });
});

describe("말 이동", () => {
  const path = serpentinePath(5, 5);

  it("n 칸 정확히 이동한다", () => {
    const result = advancePath({ path, jumps: {}, from: 3, steps: 4 });
    expect(result.index).toBe(7);
    expect(result.jumped).toBe(false);
    expect(result.reachedGoal).toBe(false);
  });

  it("사다리를 타면 한 번에 옮겨진다", () => {
    const result = advancePath({ path, jumps: { 7: 15 }, from: 3, steps: 4 });
    expect(result.landedIndex).toBe(7);
    expect(result.index).toBe(15);
    expect(result.jumped).toBe(true);
  });

  it("점프는 연쇄되지 않는다", () => {
    const result = advancePath({ path, jumps: { 7: 15, 15: 20 }, from: 3, steps: 4 });
    expect(result.index).toBe(15);
  });

  it("결승점을 넘으면 마지막 칸에서 멈춘다", () => {
    const result = advancePath({ path, jumps: {}, from: 20, steps: 10 });
    expect(result.index).toBe(24);
    expect(result.reachedGoal).toBe(true);
  });
});

describe("더하기 문제", () => {
  it("답이 맞다", () => {
    const rng = createRng(5);
    for (let i = 0; i < 50; i += 1) {
      const question = makeQuestion(rng);
      expect(question.answer).toBe(question.a + question.b);
    }
  });

  it("보기는 3개고 서로 다르며 정답을 포함한다", () => {
    const rng = createRng(6);
    for (let i = 0; i < 50; i += 1) {
      const question = makeQuestion(rng);
      expect(question.choices).toHaveLength(3);
      expect(new Set(question.choices).size).toBe(3);
      expect(question.choices).toContain(question.answer);
    }
  });

  it("같은 시드면 같은 문제가 나온다", () => {
    const a = createRng(77);
    const b = createRng(77);
    expect(makeQuestion(a)).toEqual(makeQuestion(b));
  });
});
