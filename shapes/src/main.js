import * as THREE from "three";
import { createStage, createPicker } from "./stage.js";
import { BLOCKS } from "./blocks.js";
import { GRID_SIZE, LEVELS } from "./levels.js";
import {
  blockOrientations,
  evaluateAssembly,
  orientationOf,
  placeCells,
  scoreFor,
} from "./assembly.js";
import { checkInvariants } from "./invariants.js";
import { createInvariantBadge, createViewController } from "../../common/ui-kit.js";
import { createProgress, starsFor } from "../../common/progress.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";
import { showEndingScreen } from "../../common/ending.js";

const GAME_ID = "shapes";
const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const picker = createPicker(canvas, stage.camera);

const progress = createProgress(GAME_ID, { levels: LEVELS.map((level) => ({ id: level.id })) });

const levelName = document.getElementById("level-name");
const levelHint = document.getElementById("level-hint");
const statFilled = document.getElementById("stat-filled");
const statUsed = document.getElementById("stat-used");
const statLeft = document.getElementById("stat-left");
const heldName = document.getElementById("held-name");
const heldDetail = document.getElementById("held-detail");
const btnRotate = document.getElementById("btn-rotate");
const btnUndo = document.getElementById("btn-undo");
const btnLevels = document.getElementById("btn-levels");

const targetGroup = new THREE.Group();
const placedGroup = new THREE.Group();
const trayGroup = new THREE.Group();
const previewGroup = new THREE.Group();
stage.scene.add(targetGroup, placedGroup, trayGroup, previewGroup);

let levelIndex = 0;
let level = LEVELS[0];
let placements = [];
let available = [];
let held = null;
let startedAt = 0;
let finished = false;

let ghostCells = [];
let trayEntries = [];
let invariantProblems = [];
let invariantTimer = 0;

function cellToWorld(cell) {
  const half = (GRID_SIZE - 1) / 2;
  return new THREE.Vector3(cell[0] - half, cell[1] + 0.5, cell[2] - half);
}

function disposeGroup(group) {
  group.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    const material = object.material;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const entry of list) {
      if (entry.map) entry.map.dispose();
      entry.dispose();
    }
  });
  group.clear();
}

function buildTarget() {
  disposeGroup(targetGroup);
  ghostCells = [];
  const fill = new THREE.MeshBasicMaterial({
    color: 0x63d6ff,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
  });
  const line = new THREE.LineBasicMaterial({ color: 0x63d6ff, transparent: true, opacity: 0.55 });

  for (const cell of level.target) {
    const position = cellToWorld(cell);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.94, 0.94), fill);
    box.position.copy(position);
    targetGroup.add(box);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.94, 0.94, 0.94)),
      line,
    );
    edges.position.copy(position);
    targetGroup.add(edges);

    const pickBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 0.94, 0.94),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    pickBox.position.copy(position);
    pickBox.userData.cell = cell;
    targetGroup.add(pickBox);
    ghostCells.push(pickBox);
  }
}

function buildBlockMesh(blockId, cells, scale = 1) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: BLOCKS[blockId].color,
    roughness: 0.42,
    metalness: 0.12,
    emissive: new THREE.Color(BLOCKS[blockId].color).multiplyScalar(0.12),
    flatShading: true,
  });
  for (const cell of cells) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.92 * scale, 0.92 * scale, 0.92 * scale), material);
    mesh.position.copy(cellToWorld(cell)).multiplyScalar(scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

function buildPlaced() {
  disposeGroup(placedGroup);
  for (const placement of placements) {
    const group = buildBlockMesh(placement.blockId, placement.cells);
    placedGroup.add(group);
  }
}

function buildTray() {
  disposeGroup(trayGroup);
  trayEntries = [];
  const step = 1.15;
  const totalWidth = Math.max(available.length - 1, 0) * step;
  available.forEach((entry, index) => {
    const orientations = blockOrientations(entry.blockId);
    const orientation = orientations[0];
    const group = buildBlockMesh(entry.blockId, orientation.cells, 0.52);
    group.position.set(
      -totalWidth / 2 + index * step,
      0.3,
      2.0,
    );
    trayGroup.add(group);

    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(0.9 * 0.52 + 0.35, 0.9 * 0.52 + 0.35, 0.9 * 0.52 + 0.35),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    proxy.position.copy(group.position);
    proxy.position.y += 0.3;
    proxy.userData.trayIndex = index;
    trayGroup.add(proxy);
    trayEntries.push({ entry, group, proxy });
  });
}

function currentOrientation() {
  if (!held) return null;
  return orientationOf(held.blockId, held.orientationIndex);
}

function refreshStatus() {
  const result = evaluateAssembly(level.target, placements);
  statFilled.textContent = `${result.placedCount} / ${level.target.length}`;
  statUsed.textContent = String(placements.length);
  statLeft.textContent = String(available.length);
  btnRotate.disabled = !held;
  btnUndo.disabled = placements.length === 0;

  if (held) {
    heldName.textContent = BLOCKS[held.blockId].label;
    heldDetail.textContent = `방향 ${held.orientationIndex + 1} / ${blockOrientations(held.blockId).length} · R 키로 돌립니다.`;
  } else {
    heldName.textContent = "블록을 고르세요";
    heldDetail.textContent = "아래 트레이에서 블록을 눌러 고른 뒤 보드의 반투명 모양을 채우세요.";
  }
}

function loadLevel(index) {
  levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  level = LEVELS[levelIndex];
  placements = [];
  available = level.blocks.map((blockId, order) => ({ id: `${level.id}-${order}`, blockId }));
  held = null;
  finished = false;
  startedAt = performance.now();
  levelName.textContent = level.label;
  levelHint.textContent = level.hint;
  buildTarget();
  buildPlaced();
  buildTray();
  refreshStatus();
}

function placeHeld(origin) {
  if (!held) return;
  const orientation = currentOrientation();
  const cells = placeCells(orientation, origin);
  const probe = evaluateAssembly(level.target, [...placements, { cells }]);
  const invalid = probe.outside.length > 0 || probe.overlaps.length > 0;
  if (invalid) {
    showToast(probe.outside.length > 0 ? "목표 모양 밖에는 놓을 수 없습니다." : "이미 채운 칸입니다.", "bad");
    return;
  }
  const entryIndex = available.findIndex((entry) => entry.blockId === held.blockId);
  const entry = available[entryIndex];
  available.splice(entryIndex, 1);
  placements.push({ id: entry.id, blockId: entry.blockId, cells });
  held = null;
  buildPlaced();
  buildTray();
  refreshStatus();
  checkComplete();
}

function checkComplete() {
  const result = evaluateAssembly(level.target, placements);
  if (!result.complete) return;
  finished = true;
  const used = placements.length;
  const par = level.par;
  const timeMs = performance.now() - startedAt;
  const stars = used <= par ? 3 : used <= par + 1 ? 2 : 1;
  const score = scoreFor({ par, used, timeMs });
  progress.record(level.id, { stars, score, timeMs });
  const hasNext = levelIndex + 1 < LEVELS.length;

  if (!hasNext) {
    showToast("목표 모양 완성!", "info");
    showEndingScreen({
      progress,
      levels: LEVELS.map((entry) => ({ id: entry.id, label: entry.label })),
      title: "마지막 도형까지 완성했어요!",
      rows: [
        ["마지막 단계", level.label],
        ["사용 블록", `${used}개`],
        ["소요 시간", `${(timeMs / 1000).toFixed(1)}초`],
      ],
      onFirst: () => loadLevel(0),
      onLevels: openLevels,
    });
    return;
  }

  // 단계를 통과하면 다음 단계로 바로 이어 갈 수 있게 첫 버튼으로 둔다.
  const actions = [
    { id: "next", label: "다음 단계", primary: true, pulse: true },
    { id: "retry", label: "다시 하기" },
    { id: "levels", label: "레벨 선택" },
  ];
  showToast("목표 모양 완성!", "info");
  showResult({
    kicker: `레벨 ${String(levelIndex + 1).padStart(2, "0")}`,
    title: level.label,
    stars,
    score,
    bestScore: progress.levelState(level.id)?.bestScore ?? score,
    rows: [
      ["사용 블록", `${used}개 (최소 ${par}개)`],
      ["소요 시간", `${(timeMs / 1000).toFixed(1)}초`],
    ],
    detail: "다음 단계가 열렸습니다.",
    actions,
  }).then((action) => {
    if (action === "next") loadLevel(levelIndex + 1);
    if (action === "first") loadLevel(0);
    if (action === "retry") loadLevel(levelIndex);
    if (action === "levels") openLevels();
  });
}

function openLevels() {
  showLevelSelect({
    title: "레벨 선택",
    levels: LEVELS.map((entry, index) => ({
      id: entry.id,
      label: entry.label,
      stars: progress.levelState(entry.id)?.stars ?? 0,
      unlocked: progress.isUnlocked(entry.id),
    })),
    footerActions: [{ id: "close", label: "닫기" }],
  }).then((result) => {
    if (result && result.levelId) {
      const index = LEVELS.findIndex((entry) => entry.id === result.levelId);
      if (index >= 0) loadLevel(index);
    }
  });
}

function rotateHeld(direction) {
  if (!held) return;
  const count = blockOrientations(held.blockId).length;
  held.orientationIndex = (held.orientationIndex + direction + count) % count;
  refreshStatus();
}

function undo() {
  if (placements.length === 0) return;
  const placement = placements.pop();
  available.push({ id: placement.id, blockId: placement.blockId });
  buildPlaced();
  buildTray();
  refreshStatus();
}

btnRotate.addEventListener("click", () => rotateHeld(1));
btnUndo.addEventListener("click", undo);
btnLevels.addEventListener("click", openLevels);

window.addEventListener("keydown", (event) => {
  if (event.key === "r" || event.key === "R") rotateHeld(1);
  if (event.key === "q" || event.key === "Q") rotateHeld(-1);
  if (event.key === "z" || event.key === "Z") undo();
  if (event.key === "Escape") {
    held = null;
    refreshStatus();
  }
});

let pointerDownAt = null;

canvas.addEventListener("pointerdown", (event) => {
  pointerDownAt = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (!pointerDownAt) return;
  const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
  pointerDownAt = null;
  if (moved > 5) return;

  const trayHits = picker.pick(event.clientX, event.clientY, trayEntries.map((entry) => entry.proxy));
  if (trayHits.length > 0) {
    const index = trayHits[0].object.userData.trayIndex;
    const entry = trayEntries[index]?.entry;
    if (entry) {
      held = { blockId: entry.blockId, orientationIndex: 0 };
      refreshStatus();
    }
    return;
  }

  if (!held) return;
  const cell = hoveredCell(event.clientX, event.clientY);
  if (!cell) return;
  const orientation = currentOrientation();
  const origin = [cell[0] - orientation.anchor[0], cell[1] - orientation.anchor[1], cell[2] - orientation.anchor[2]];
  placeHeld(origin);
});

function hoveredCell(clientX, clientY) {
  const hits = picker.pick(clientX, clientY, ghostCells);
  if (hits.length === 0) return null;
  return hits[0].object.userData.cell;
}

let pointerPosition = { x: 0, y: 0 };

canvas.addEventListener("pointermove", (event) => {
  pointerPosition = { x: event.clientX, y: event.clientY };
});

const badge = createInvariantBadge({ bottom: "86px" });

function updateInvariants(delta) {
  invariantTimer += delta;
  if (invariantTimer < 0.5) return;
  invariantTimer = 0;
  invariantProblems = checkInvariants({ placements, target: level.target });
  badge.show(invariantProblems);
  if (invariantProblems.length > 0) {
    console.error(`[불변식 위반] ${invariantProblems.map((problem) => problem.message).join(" | ")}`);
  }
}

const VIEWS = {
  default: { position: [4.1, 3.5, 6.2], target: [0, 0.85, 0.55] },
  card: { position: [3.5, 2.9, 5.2], target: [0, 0.8, 0.4] },
  front: { position: [0, 1.8, 7.6], target: [0, 0.8, 0.3] },
  side: { position: [7.6, 1.8, 0], target: [0, 0.8, 0.3] },
  top: { position: [0, 9, 0.02], target: [0, 0.4, 0.2] },
};
const views = createViewController(stage, VIEWS);


stage.start((delta, elapsed) => {
  const orientation = currentOrientation();
  if (orientation) {
    const cell = hoveredCell(pointerPosition.x, pointerPosition.y);
    disposeGroup(previewGroup);
    const origin = cell
      ? [cell[0] - orientation.anchor[0], cell[1] - orientation.anchor[1], cell[2] - orientation.anchor[2]]
      : [0, 0, 0];
    const cells = placeCells(orientation, origin);
    const probe = evaluateAssembly(level.target, [{ cells }]);
    const valid = probe.outside.length === 0 && probe.overlaps.length === 0 && cell !== null;
    const material = new THREE.MeshBasicMaterial({
      color: valid ? 0xffb800 : 0xff6b5c,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    for (const cellToDraw of cells) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.92), material);
      mesh.position.copy(cellToWorld(cellToDraw));
      previewGroup.add(mesh);
    }
  } else {
    disposeGroup(previewGroup);
  }
  void elapsed;
  updateInvariants(delta);
});

loadLevel(0);

window.__gameApi = {
  getState: () => {
    const result = evaluateAssembly(level.target, placements);
    return {
      level: level.id,
      placed: result.placedCount,
      target: level.target.length,
      used: placements.length,
      par: level.par,
      remaining: result.remaining.length,
      complete: result.complete,
      finished,
    };
  },
  getInvariants: () => invariantProblems,
  getScreenPositions: () => {
    const cells = level.target.map((cell, index) => {
      const projected = cellToWorld(cell).project(stage.camera);
      return {
        id: `cell-${index}`,
        x: projected.x,
        y: projected.y,
        visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
      };
    });
    const tray = trayEntries.map((entry, index) => {
      const projected = entry.group.position.clone().project(stage.camera);
      return {
        id: `tray-${index}`,
        x: projected.x,
        y: projected.y,
        visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
      };
    });
    return [...cells, ...tray];
  },
  setView: views.setView,
  setChrome: (options = {}) => {
    if (options.labels === false) {
      for (const entry of trayEntries) entry.group.visible = false;
    }
    if (options.labels === true) {
      for (const entry of trayEntries) entry.group.visible = true;
    }
  },
  levelIndex: () => levelIndex,
  loadLevel,
};
