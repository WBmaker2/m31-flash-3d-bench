// 화면(HTML) 연결. 상태를 화면에 그리고, 미니맵을 그린다.
import { CELL_SIZE_M, cellOf } from "./maze.js";

const MAP_SIZE = 168;

export function createHud(handlers = {}) {
  const el = {
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    statSteps: document.getElementById("stat-steps"),
    statBest: document.getElementById("stat-best"),
    statKeys: document.getElementById("stat-keys"),
    statTime: document.getElementById("stat-time"),
    status: document.getElementById("status-line"),
    minimap: document.getElementById("minimap"),
    btnRetry: document.getElementById("btn-retry"),
    btnLevels: document.getElementById("btn-levels"),
  };

  const ctx = el.minimap?.getContext("2d") ?? null;

  function setLevel(level) {
    el.levelName.textContent = level.label;
    el.levelHint.textContent = level.hint;
  }

  function setStatus({ steps, par, keys, keysTotal, time }) {
    el.statSteps.textContent = `${steps} 칸`;
    el.statBest.textContent = par > 0 ? `최적 ${par}` : "—";
    el.statKeys.textContent = `${keys} / ${keysTotal}`;
    el.statTime.textContent = `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
  }

  function setMessage(text, tone = "info") {
    el.status.textContent = text;
    el.status.classList.toggle("is-bad", tone === "bad");
  }

  /** 방문한 칸만 그린다. 어두운 칸이 탐색하지 않은 곳이다. */
  function drawMinimap(maze, state) {
    if (!ctx || !maze) return;
    const cell = (MAP_SIZE / Math.max(maze.cols, maze.rows));
    const width = maze.cols * cell;
    const height = maze.rows * cell;
    const offsetX = (MAP_SIZE - width) / 2;
    const offsetY = (MAP_SIZE - height) / 2;

    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = "#0d1017";
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    for (const index of state.visited) {
      const { col, row } = cellOf(maze, index);
      ctx.fillStyle = "#2c3a4d";
      ctx.fillRect(offsetX + col * cell, offsetY + row * cell, cell - 1, cell - 1);
    }

    ctx.strokeStyle = "rgba(150, 172, 205, 0.65)";
    ctx.lineWidth = 1;
    for (const index of state.visited) {
      const { col, row } = cellOf(maze, index);
      const x = offsetX + col * cell;
      const y = offsetY + row * cell;
      const walls = maze.cells[index];
      ctx.beginPath();
      if (!walls.n) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + cell, y);
      }
      if (!walls.w) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + cell);
      }
      if (!walls.s) {
        ctx.moveTo(x, y + cell);
        ctx.lineTo(x + cell, y + cell);
      }
      if (!walls.e) {
        ctx.moveTo(x + cell, y);
        ctx.lineTo(x + cell, y + cell);
      }
      ctx.stroke();
    }

    for (const key of maze.keys) {
      if (state.visited.has(key.cell) && !(state.heldMask & (1 << key.index))) {
        const { col, row } = cellOf(maze, key.cell);
        ctx.fillStyle = "#ffc247";
        ctx.fillRect(offsetX + col * cell + cell * 0.25, offsetY + row * cell + cell * 0.25, cell * 0.5, cell * 0.5);
      }
    }

    if (state.visited.has(maze.exit)) {
      const { col, row } = cellOf(maze, maze.exit);
      ctx.fillStyle = "#54e0a0";
      ctx.fillRect(offsetX + col * cell + cell * 0.2, offsetY + row * cell + cell * 0.2, cell * 0.6, cell * 0.6);
    }

    const { col, row } = cellOf(maze, state.cell);
    ctx.fillStyle = "#ffb800";
    ctx.beginPath();
    ctx.arc(offsetX + col * cell + cell / 2, offsetY + row * cell + cell / 2, Math.max(2, cell * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }

  el.btnRetry.addEventListener("click", () => handlers.onRetry?.());
  el.btnLevels.addEventListener("click", () => handlers.onLevels?.());

  return { el, setLevel, setStatus, setMessage, drawMinimap, mapSize: MAP_SIZE, cellSize: CELL_SIZE_M };
}
