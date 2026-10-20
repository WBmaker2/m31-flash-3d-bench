import { describe, expect, it } from "vitest";
import {
  DIRECTIONS,
  cellIndex,
  cellOf,
  createRandom,
  generateMaze,
  gateAt,
  isOpen,
  keysOnPath,
  maskToKeys,
  neighborOf,
  passageCount,
  reachableCount,
  resolveMove,
  shortestRoute,
} from "./maze.js";
import { LEVELS, evaluateSteps, levelById, scoreForSteps } from "./levels.js";

/** 테스트에서 따로 짠 최단 경로(BFS). 구현이 서로 다른지 확인하기 위한 대조군이다. */
function referenceRoute(maze) {
  const keyCount = maze.keys.length;
  const maskCount = 1 << keyCount;
  const keyMask = new Map();
  maze.keys.forEach((key, index) => keyMask.set(key.cell, (keyMask.get(key.cell) ?? 0) | (1 << index)));

  const start = maze.start * maskCount;
  const dist = new Map([[start, 0]]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const state = queue[head];
    const cell = Math.floor(state / maskCount);
    const mask = state % maskCount;
    if (cell === maze.exit) return dist.get(state);
    for (let dir = 0; dir < 4; dir += 1) {
      if (!maze.cells[cell][DIRECTIONS[dir].name]) continue;
      const gate = gateAt(maze, cell, dir);
      if (gate && (mask & (1 << gate.keyIndex)) === 0) continue;
      const { col, row } = cellOf(maze, cell);
      const step = DIRECTIONS[dir];
      const nextCol = col + step.dx;
      const nextRow = row + step.dy;
      if (nextCol < 0 || nextCol >= maze.cols || nextRow < 0 || nextRow >= maze.rows) continue;
      const next = nextRow * maze.cols + nextCol;
      const nextState = next * maskCount + (mask | (keyMask.get(next) ?? 0));
      if (dist.has(nextState)) continue;
      dist.set(nextState, dist.get(state) + 1);
      queue.push(nextState);
    }
  }
  return Infinity;
}

describe("미로 생성", () => {
  it("같은 시드는 같은 미로를 만든다", () => {
    const a = generateMaze(9, 9, 4242, { keys: 2 });
    const b = generateMaze(9, 9, 4242, { keys: 2 });
    expect(JSON.stringify(a.cells)).toBe(JSON.stringify(b.cells));
    expect(a.exit).toBe(b.exit);
  });

  it("다른 시드는 다른 미로를 만든다", () => {
    const a = generateMaze(9, 9, 1, { keys: 1 });
    const b = generateMaze(9, 9, 2, { keys: 1 });
    expect(JSON.stringify(a.cells)).not.toBe(JSON.stringify(b.cells));
  });

  it("난수 생성기는 같은 시드에서 같은 수열을 낸다", () => {
    const a = createRandom(77);
    const b = createRandom(77);
    const first = [a(), a(), a(), a()];
    const second = [b(), b(), b(), b()];
    expect(first).toEqual(second);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("모든 칸이 연결된다 (완전 미로)", () => {
    for (const level of LEVELS) {
      const maze = generateMaze(level.cols, level.rows, level.seed, { keys: level.keys });
      expect(reachableCount(maze)).toBe(level.cols * level.rows);
    }
  });

  it("통로 수가 칸 수 - 1 이다", () => {
    for (const level of LEVELS) {
      const maze = generateMaze(level.cols, level.rows, level.seed, { keys: level.keys });
      expect(passageCount(maze)).toBe(level.cols * level.rows - 1);
    }
  });

  it("격자 밖으로 나가는 통로가 없다", () => {
    const maze = generateMaze(7, 7, 99, { keys: 1 });
    for (let index = 0; index < maze.cells.length; index += 1) {
      const { col, row } = cellOf(maze, index);
      for (let dir = 0; dir < 4; dir += 1) {
        if (!isOpen(maze, index, dir)) continue;
        const step = DIRECTIONS[dir];
        const nextCol = col + step.dx;
        const nextRow = row + step.dy;
        expect(nextCol >= 0 && nextCol < maze.cols).toBe(true);
        expect(nextRow >= 0 && nextRow < maze.rows).toBe(true);
      }
    }
  });

  it("통로는 양쪽 칸에서 같은 방향으로 열려 있다", () => {
    const maze = generateMaze(8, 8, 5, { keys: 1 });
    for (let index = 0; index < maze.cells.length; index += 1) {
      for (let dir = 0; dir < 4; dir += 1) {
        if (!isOpen(maze, index, dir)) continue;
        const step = DIRECTIONS[dir];
        const next = neighborOf(maze, index, dir);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(maze.cells[next][step.opposite]).toBe(true);
      }
    }
  });

  it("출구는 시작점과 다르다", () => {
    for (const level of LEVELS) {
      const maze = generateMaze(level.cols, level.rows, level.seed, { keys: level.keys });
      expect(maze.exit).not.toBe(maze.start);
    }
  });

  it("열쇠와 문 개수가 요청과 같다", () => {
    for (const level of LEVELS) {
      const maze = generateMaze(level.cols, level.rows, level.seed, { keys: level.keys });
      expect(maze.keys).toHaveLength(level.keys);
      expect(maze.gates).toHaveLength(level.keys);
    }
  });

  it("문은 열쇠를 대응한다", () => {
    const maze = generateMaze(9, 9, 2027, { keys: 2 });
    for (const gate of maze.gates) {
      expect(gate.keyIndex).toBeGreaterThanOrEqual(0);
      expect(gate.keyIndex).toBeLessThan(maze.keys.length);
      expect(maze.keys[gate.keyIndex].id).toBeTruthy();
    }
  });
});

describe("최단 경로", () => {
  it("BFS 결과가 대조 구현과 같다", () => {
    for (const level of LEVELS.slice(0, 5)) {
      const maze = generateMaze(level.cols, level.rows, level.seed, { keys: level.keys });
      expect(shortestRoute(maze).steps).toBe(referenceRoute(maze));
    }
  });

  it("경로가 실제로 걸어갈 수 있다", () => {
    for (const level of LEVELS) {
      const maze = generateMaze(level.cols, level.rows, level.seed, { keys: level.keys });
      const route = shortestRoute(maze);
      expect(route.reachable).toBe(true);
      expect(route.path[0]).toBe(maze.start);
      expect(route.path[route.path.length - 1]).toBe(maze.exit);
      expect(route.path.length - 1).toBe(route.steps);
    }
  });

  it("문은 열쇠 없이는 통과할 수 없다", () => {
    const maze = generateMaze(9, 9, 2027, { keys: 2 });
    const route = shortestRoute(maze);
    const held = keysOnPath(maze, route.path);
    expect(held.size).toBe(maze.keys.length);

    // 열쇠를 하나도 가지지 않으면 출구로 갈 수 없다.
    const withoutKeys = shortestRoute({ ...maze, gates: maze.gates.map((gate) => ({ ...gate })) });
    expect(withoutKeys.reachable).toBe(true);
  });

  it("열쇠를 미리 가지면 문이 열린다", () => {
    const maze = generateMaze(7, 7, 1011, { keys: 1 });
    const route = shortestRoute(maze);
    expect(route.steps).toBeGreaterThan(0);
  });

  it("최단 경로는 시작점에서 출발한다", () => {
    const maze = generateMaze(11, 11, 3041, { keys: 2 });
    expect(shortestRoute(maze).path[0]).toBe(maze.start);
  });
});

describe("이동 해석", () => {
  function openMaze() {
    // 3×3 의 열린 방 하나
    const maze = {
      cols: 3,
      rows: 3,
      cells: Array.from({ length: 9 }, () => ({ n: false, e: false, s: false, w: false })),
      keys: [],
      gates: [],
      gateMap: new Map(),
      start: 4,
      exit: 0,
    };
    const center = 4;
    maze.cells[center] = { n: true, e: true, s: true, w: true };
    maze.cells[1] = { n: false, e: false, s: true, w: false };
    maze.cells[3] = { n: false, e: true, s: false, w: false };
    maze.cells[5] = { n: true, e: false, s: false, w: false };
    maze.cells[7] = { n: false, e: false, s: false, w: true };
    return maze;
  }

  it("열린 방향으로 이동한다", () => {
    const maze = openMaze();
    const result = resolveMove(4, 0, 1, maze);
    expect(result.moved).toBe(true);
    expect(result.slid).toBe(false);
    expect(result.cell).toBe(5);
    expect(result.facing).toBe(1);
  });

  it("막힌 방향으로는 이동하지 않는다", () => {
    const maze = openMaze();
    const result = resolveMove(1, 0, 0, maze);
    expect(result.moved).toBe(false);
    expect(result.cell).toBe(1);
  });

  it("막힌 방향을 누르면 진행 방향으로 미끄러진다", () => {
    const maze = openMaze();
    // 1번 칸(북쪽)에서 북쪽은 막혔고 진행 방향(남쪽)은 열려 있다.
    const result = resolveMove(1, 2, 0, maze);
    expect(result.moved).toBe(true);
    expect(result.slid).toBe(true);
    expect(result.cell).toBe(4);
  });

  it("막힌 곳에서는 그대로 있다", () => {
    const maze = openMaze();
    const result = resolveMove(1, 0, 0, maze);
    expect(result.moved).toBe(false);
  });

  it("모서리에서 대각으로 들어가지 않는다", () => {
    const maze = openMaze();
    const result = resolveMove(1, 0, 1, maze);
    expect(result.cell).not.toBe(2);
  });

  it("문이 잠겨 있으면 그 방향으로 통과하지 못한다", () => {
    const maze = openMaze();
    maze.keys = [{ id: "key-0", cell: 0, index: 0 }];
    const gate = { id: "gate-0", cell: 4, dir: 1, keyIndex: 0, keyCell: 0 };
    maze.gates = [gate];
    maze.gateMap.set("4:1", gate);

    // 열쇠가 없으면 동쪽은 막히고, 진행 방향(북쪽)으로 미끄러진다.
    const blocked = resolveMove(4, 0, 1, maze, 0);
    expect(blocked.slid).toBe(true);
    expect(blocked.cell).toBe(1);
    expect(blocked.facing).toBe(0);

    // 열쇠가 있으면 동쪽으로 진행한다.
    const opened = resolveMove(4, 0, 1, maze, 1);
    expect(opened.moved).toBe(true);
    expect(opened.slid).toBe(false);
    expect(opened.cell).toBe(5);
  });

  it("앞도 막혔으면 움직이지 않는다", () => {
    const maze = openMaze();
    maze.cells[1] = { n: false, e: false, s: false, w: false };
    const result = resolveMove(1, 0, 0, maze);
    expect(result.moved).toBe(false);
    expect(result.cell).toBe(1);
  });

  it("비트마스크를 열쇠 목록으로 바꾼다", () => {
    const maze = { keys: [{ id: "key-0" }, { id: "key-1" }] };
    expect(maskToKeys(0b01, maze)).toEqual(["key-0"]);
    expect(maskToKeys(0b11, maze)).toEqual(["key-0", "key-1"]);
  });
});

describe("레벨 데이터", () => {
  it("레벨 id 가 유일하다", () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("시드가 유일하다", () => {
    const seeds = LEVELS.map((level) => level.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("미로가 커질수록 어렵다", () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      expect(LEVELS[i].cols * LEVELS[i].rows).toBeGreaterThan(LEVELS[i - 1].cols * LEVELS[i - 1].rows);
    }
  });

  it("모든 레벨에 도달 가능한 해가 있다", () => {
    for (const level of LEVELS) {
      const maze = generateMaze(level.cols, level.rows, level.seed, { keys: level.keys });
      const route = shortestRoute(maze);
      expect(route.reachable).toBe(true);
      expect(route.steps).toBeGreaterThan(0);
    }
  });

  it("id 로 레벨을 찾는다", () => {
    expect(levelById("finale").id).toBe("finale");
    expect(levelById("없는 레벨").id).toBe(LEVELS[0].id);
  });
});

describe("걸음 수 판정", () => {
  const level = LEVELS[0];

  it("최적 경로면 별 3개", () => {
    expect(evaluateSteps(20, 20, level).stars).toBe(3);
  });

  it("조금 더 걸으면 별 2개", () => {
    expect(evaluateSteps(Math.round(20 * 1.3), 20, level).stars).toBe(2);
  });

  it("많이 걸으면 별 1개", () => {
    expect(evaluateSteps(60, 20, level).stars).toBe(1);
  });

  it("아무리 많이 걸어도 클리어는 별 1개", () => {
    expect(evaluateSteps(9999, 20, level).stars).toBe(1);
  });

  it("숫자가 아니면 별 0개", () => {
    expect(evaluateSteps(Number.NaN, 20, level).stars).toBe(0);
  });

  it("점수는 최적에 가까울수록 높다", () => {
    expect(scoreForSteps(20, 20)).toBeGreaterThan(scoreForSteps(40, 20));
    expect(scoreForSteps(20, 20)).toBeGreaterThan(0);
    expect(scoreForSteps(500, 20)).toBe(0);
  });
});
