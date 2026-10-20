import * as THREE from "three";
import { createStage, createPicker } from "./stage.js";
import { ELEMENTS } from "./elements.js";
import { TARGETS, buildTargetSkeleton, computeLayout, findBond, validate } from "./chemistry.js";
import { createAtomFactory } from "./atoms.js";
import { createUi } from "./ui.js";
import { LEVELS, createSession } from "./session.js";
import { checkInvariants } from "./invariants.js";
import { createProgress } from "../../common/progress.js";
import { createInvariantBadge, createViewController } from "../../common/ui-kit.js";
import { showLevelSelect, showResult, showToast } from "../../common/overlay.js";

const WORK_Y = 2.0;
const MOLECULE_SCALE = 1.45;

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const picker = createPicker(canvas, stage.camera);
const factory = createAtomFactory(stage.scene);

let selectedAtomId = null;
let placeElement = null;
let currentTarget = TARGETS[0];
let pointerStart = null;
let session = null;
let lastLayout = null;

const sessionProgress = createProgress("molecule", { levels: LEVELS.map((level) => ({ id: level.id })) });

const selectionRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.5, 0.03, 8, 32),
  new THREE.MeshBasicMaterial({ color: 0x35d6c0, transparent: true, opacity: 0.9 }),
);
selectionRing.visible = false;
stage.scene.add(selectionRing);

const ui = createUi({
  onTarget: (target) => setTarget(target),
  onElement: (element) => setPlaceElement(placeElement === element ? null : element),
});

function setStatus(html, isBad = false) {
  ui.setStatus(html, isBad);
}

function setTarget(target) {
  currentTarget = target;
  ui.setTarget(target);
  setStatus(`<strong>목표: ${target.label}</strong> ${target.shape} · 결합각 ${target.angleDeg}°.`);
}

function setPlaceElement(element) {
  placeElement = element;
  ui.setElement(element);
  if (element) {
    selectedAtomId = null;
    setStatus(`<strong>${ELEMENTS[element].name}(${element})</strong>를 놓을 준비가 되었습니다. 작업대를 클릭하세요.`);
  }
}

function clearAll() {
  factory.clear();
  selectedAtomId = null;
  lastLayout = null;
}

function applyLayout() {
  if (factory.atoms.length === 0) {
    setStatus("<strong>원자가 없습니다.</strong> 원자 팔레트에서 원자를 골라 작업대를 클릭하세요.", true);
    return false;
  }
  const layout = computeLayout(factory.atoms, factory.bonds);
  if (!layout) return false;
  lastLayout = layout;

  const centerPosition = layout.positions.get(layout.centerId) ?? new THREE.Vector3();
  const neighborPositions = layout.neighbors
    .map((id) => layout.positions.get(id))
    .filter(Boolean);

  for (const [atomId, position] of layout.positions) {
    const atom = factory.byId(atomId);
    if (!atom) continue;
    atom.target.copy(position.clone().multiplyScalar(MOLECULE_SCALE)).add(new THREE.Vector3(0, WORK_Y, 0));

    let direction;
    if (atomId === layout.centerId) {
      const away = new THREE.Vector3();
      for (const neighborPosition of neighborPositions) away.add(neighborPosition);
      direction = away.lengthSq() > 1e-8 ? away.normalize().multiplyScalar(-1) : new THREE.Vector3(0, 1, 0);
    } else {
      direction = position.clone().sub(centerPosition);
      direction = direction.lengthSq() > 1e-8 ? direction.normalize() : new THREE.Vector3(0, 1, 0);
    }
    atom.label.position.copy(direction.multiplyScalar(ELEMENTS[atom.element].radius + 0.3));
  }

  const shape =
    layout.domains === 4
      ? layout.lonePairs === 0
        ? "정사면체"
        : layout.lonePairs === 1
          ? "삼각뿔"
          : "굽은형"
      : layout.domains === 3
        ? "평면 삼각형"
        : "직선";
  setStatus(
    `<strong>배치 완료.</strong> 전자 영역 ${layout.domains}개 · 비공유 전자쌍 ${layout.lonePairs}쌍 · 결합각 ${layout.angleDeg.toFixed(1)}° (${shape}).`,
  );
  return true;
}

function loadExample() {
  clearAll();
  const skeleton = buildTargetSkeleton(currentTarget);
  const spacing = 1.25;
  const offset = ((skeleton.atoms.length - 1) * spacing) / 2;
  for (const [index, entry] of skeleton.atoms.entries()) {
    factory.add(entry.element, new THREE.Vector3(index * spacing - offset, WORK_Y, 0));
  }
  for (const entry of skeleton.bonds) {
    factory.addBond(entry.a, entry.b, entry.order);
  }
  setStatus(
    `<strong>${currentTarget.label}</strong> 예시를 불러왔습니다. 원자가 일직선으로 늘어져 있으니 <em>자동 배치</em>를 눌러 모양을 정리하세요.`,
  );
}

function checkMolecule() {
  if (factory.atoms.length === 0) {
    setStatus("<strong>아직 만든 분자가 없습니다.</strong>", true);
    return;
  }
  const result = validate(factory.atoms, factory.bonds, currentTarget);

  if (session) {
    const accepted = session.answer(result.ok);
    if (result.ok) {
      if (accepted.finished) {
        finishSession();
        return;
      }
      loadSessionTarget();
      refreshSessionPanel();
      setStatus("<strong>정답!</strong> 다음 문제를 준비했습니다.");
    } else {
      refreshSessionPanel();
      setStatus("<strong>아직 다릅니다.</strong> 원자 수와 결합을 다시 확인하세요.", true);
    }
    return;
  }

  if (result.ok) {
    setStatus(
      `<strong>정답입니다.</strong> ${currentTarget.label} 완성. ${currentTarget.shape} · 결합각 ${currentTarget.angleDeg}°. ${currentTarget.description}`,
    );
    return;
  }
  const problems = [];
  if (!result.countOk) problems.push("원자 종류와 개수가 목표와 다릅니다");
  if (!result.centerOk) problems.push(`중심 원자가 ${currentTarget.center}가 아닙니다 (현재 ${result.centerElement ?? "없음"})`);
  if (!result.neighborOk) problems.push("중심 원자에 연결된 원자의 종류·수가 다릅니다");
  setStatus(`<strong>아직 다릅니다.</strong> ${problems.join(" · ")}.`, true);
}

function openSessionLevels() {
  showLevelSelect({
    title: "분자 레벨",
    levels: LEVELS.map((level) => ({
      id: level.id,
      label: `${level.label} · ${level.targets.length}문제 · ${level.timeLimit}초`,
      stars: sessionProgress.levelState(level.id)?.stars ?? 0,
      unlocked: sessionProgress.isUnlocked(level.id),
    })),
  }).then((result) => {
    if (!result || !result.levelId) return;
    const level = LEVELS.find((entry) => entry.id === result.levelId);
    if (level) startSession(level);
  });
}

function startSession(level) {
  session = createSession(level);
  loadSessionTarget();
  refreshSessionPanel();
  setStatus(`<strong>${level.label}</strong> ${level.description}`);
}

function loadSessionTarget() {
  if (!session) return;
  const target = TARGETS.find((entry) => entry.id === session.current);
  if (!target) return;
  currentTarget = target;
  ui.setTarget(target);
  ui.lockTargets(true);
  clearAll();
  loadExample();
}

function refreshSessionPanel() {
  if (!session) return;
  const target = TARGETS.find((entry) => entry.id === session.current);
  ui.showSession(session, target ? `${target.label} 를 만드세요` : "완료");
}

function finishSession() {
  const level = session.level;
  const bonus = session.timeBonus();
  const score = session.score + bonus;
  const stars = session.stars();
  sessionProgress.record(level.id, { stars, score, timeMs: (level.timeLimit - session.timeLeft) * 1000 });
  session = null;
  ui.showSession(null);
  ui.lockTargets(false);
  const levelIndex = LEVELS.findIndex((entry) => entry.id === level.id);
  const nextLevel = levelIndex >= 0 ? LEVELS[levelIndex + 1] : null;
  // 단계를 통과하면 다음 단계로 바로 이어 갈 수 있게 첫 버튼으로 둔다.
  const actions = nextLevel
    ? [
        { id: "next", label: "다음 단계", primary: true, pulse: true },
        { id: "retry", label: "다시 하기" },
        { id: "levels", label: "레벨 선택" },
      ]
    : [
        { id: "first", label: "처음부터", primary: true, pulse: true },
        { id: "retry", label: "다시 하기" },
        { id: "levels", label: "레벨 선택" },
      ];
  showResult({
    kicker: "분자 레벨",
    title: level.label,
    stars,
    score,
    bestScore: sessionProgress.levelState(level.id)?.bestScore ?? score,
    rows: [
      ["맞힌 문제", `${level.targets.length} / ${level.targets.length}`],
      ["시간 보너스", `+${bonus}`],
    ],
    actions,
  }).then((action) => {
    if (action === "next" && nextLevel) startSession(nextLevel);
    if (action === "first") startSession(LEVELS[0]);
    if (action === "retry") startSession(level);
    if (action === "levels") openSessionLevels();
  });
}

document.getElementById("btn-levels").addEventListener("click", openSessionLevels);
document.getElementById("btn-example").addEventListener("click", loadExample);
document.getElementById("btn-layout").addEventListener("click", applyLayout);
document.getElementById("btn-check").addEventListener("click", checkMolecule);
document.getElementById("btn-clear").addEventListener("click", () => {
  clearAll();
  setPlaceElement(null);
  setStatus("<strong>초기화했습니다.</strong> 원자 팔레트에서 원자를 골라 작업대를 클릭하세요.");
});

canvas.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (!pointerStart) return;
  const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  pointerStart = null;
  if (moved > 5) return;

  const atomHit = picker.pick(
    event.clientX,
    event.clientY,
    factory.atoms.map((atom) => atom.mesh),
  )[0];

  if (placeElement && (!atomHit || !atomHit.object.userData.atomId)) {
    const point = picker.pickPlane(event.clientX, event.clientY, WORK_Y);
    if (!point) return;
    if (Math.hypot(point.x, point.z) > 3.3) {
      setStatus("<strong>작업대 바깥입니다.</strong> 원형 작업대 안쪽을 클릭하세요.", true);
      return;
    }
    factory.add(placeElement, new THREE.Vector3(point.x, WORK_Y, point.z));
    setStatus(`<strong>${ELEMENTS[placeElement].name}</strong> 원자를 놓았습니다. 다른 원자를 클릭하면 결합됩니다.`);
    return;
  }

  if (atomHit && atomHit.object.userData.atomId) {
    const id = atomHit.object.userData.atomId;
    if (placeElement) setPlaceElement(null);
    if (selectedAtomId && selectedAtomId !== id) {
      const existing = findBond(factory.bonds, selectedAtomId, id);
      if (existing) {
        if (existing.order < 3) {
          factory.removeBond(existing.id);
          factory.addBond(existing.a, existing.b, existing.order + 1);
          setStatus(`<strong>결합 차수를 ${existing.order + 1}중으로 올렸습니다.</strong>`);
        } else {
          setStatus("<strong>최대 3중 결합입니다.</strong>", true);
        }
      } else {
        factory.addBond(selectedAtomId, id, 1);
        setStatus("<strong>결합을 만들었습니다.</strong> 같은 두 원자를 다시 누르면 결합 차수가 올라갑니다.");
      }
      selectedAtomId = null;
    } else {
      selectedAtomId = selectedAtomId === id ? null : id;
      if (selectedAtomId) setStatus("<strong>원자를 선택했습니다.</strong> 다른 원자를 누르면 결합이 만들어집니다.");
    }
    return;
  }

  const bondHit = picker.pick(
    event.clientX,
    event.clientY,
    factory.bonds.map((bond) => bond.proxy),
  )[0];
  if (bondHit && bondHit.object.userData.bondId) {
    factory.removeBond(bondHit.object.userData.bondId);
    setStatus("<strong>결합을 삭제했습니다.</strong>");
    return;
  }

  selectedAtomId = null;
});

const VIEWS = {
  card: { position: [0, 2.45, 5.4], target: [0, 2.0, 0] },
  default: { position: [0, 4.1, 9.8], target: [0, 1.9, 0] },
  front: { position: [0, 2.1, 10.5], target: [0, 2, 0] },
  side: { position: [10.5, 2.1, 0], target: [0, 2, 0] },
  top: { position: [0, 11, 0.02], target: [0, 1.6, 0] },
};

const views = createViewController(stage, VIEWS);
const badge = createInvariantBadge();

let invariantProblems = [];
let invariantTimer = 0;

function updateInvariants(delta) {
  invariantTimer += delta;
  if (invariantTimer < 0.5) return;
  invariantTimer = 0;
  invariantProblems = checkInvariants({
    atoms: factory.atoms,
    bonds: factory.bonds,
    layout: lastLayout,
    camera: stage.camera,
    target: currentTarget,
    view: views.current,
  });
  badge.show(invariantProblems);
  if (invariantProblems.length > 0) {
    console.error(`[불변식 위반] ${invariantProblems.map((problem) => problem.message).join(" | ")}`);
  }
}

stage.start((delta) => {
  const smoothing = Math.min(1, delta * 7);
  for (const atom of factory.atoms) {
    atom.group.position.lerp(atom.target, smoothing);
  }
  factory.updateAll();

  updateInvariants(delta);

  const selected = selectedAtomId ? factory.byId(selectedAtomId) : null;
  if (selected) {
    selectionRing.visible = true;
    selectionRing.position.copy(selected.group.position);
    selectionRing.quaternion.copy(stage.camera.quaternion);
  } else {
    selectionRing.visible = false;
  }
});

setTarget(currentTarget);
setStatus("<strong>준비됨.</strong> 목표 분자를 고르고 <em>예시 불러오기</em>를 눌러 시작하세요.");

window.__gameApi = {
  getState: () => ({
    target: currentTarget.id,
    atoms: factory.atoms.map((atom) => atom.element),
    bonds: factory.bonds.map((bond) => ({ a: bond.a, b: bond.b, order: bond.order })),
    selected: selectedAtomId,
    placeElement,
  }),
  getInvariants: () => invariantProblems,
  getSession: () =>
    session
      ? {
          level: session.level.id,
          index: session.index,
          total: session.total,
          current: session.current,
          score: session.score,
          timeLeft: Math.ceil(session.timeLeft),
          wrong: session.wrong,
        }
      : null,
  getScreenPositions: () =>
    factory.atoms.map((atom) => {
      const projected = atom.group.position.clone().project(stage.camera);
      return {
        id: atom.id,
        x: projected.x,
        y: projected.y,
        visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
      };
    }),
  setView: views.setView,
};
