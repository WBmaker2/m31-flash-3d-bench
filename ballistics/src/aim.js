// 조준 계산. three에 의존하지 않는다.
// 각도는 deg 로 들어오고, 계산은 rad 로 한다. 이름에 단위를 붙인다.

import { DEFAULT_STEP_SECONDS, simulateFlight } from "./physics.js";

export const MUZZLE_HEIGHT_M = 1.6;
export const MAX_PITCH_DEG = 80;
export const MIN_PITCH_DEG = 5;
export const MAX_YAW_DEG = 45;
export const MIN_YAW_DEG = -45;
export const MIN_POWER_MPS = 6;
export const MAX_POWER_MPS = 30;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function clampPower(power) {
  if (!Number.isFinite(power)) return MIN_POWER_MPS;
  return Math.min(MAX_POWER_MPS, Math.max(MIN_POWER_MPS, power));
}

export function clampPitch(pitchDeg) {
  if (!Number.isFinite(pitchDeg)) return MIN_PITCH_DEG;
  return Math.min(MAX_PITCH_DEG, Math.max(MIN_PITCH_DEG, pitchDeg));
}

export function clampYaw(yawDeg) {
  if (!Number.isFinite(yawDeg)) return 0;
  return Math.min(MAX_YAW_DEG, Math.max(MIN_YAW_DEG, yawDeg));
}

/** 발사구 위치. 발사대는 원점. */
export function muzzlePosition() {
  return { x: 0, y: MUZZLE_HEIGHT_M, z: 0 };
}

/**
 * 방위각(yaw)·고도각(pitch) → 단위 방향 벡터.
 * yaw 0 / pitch 0 은 +Z(사거리 방향), yaw 90° 는 +X, pitch 90° 는 +Y.
 */
export function directionFromAngles(yawDeg, pitchDeg) {
  const yaw = yawDeg * DEG_TO_RAD;
  const pitch = pitchDeg * DEG_TO_RAD;
  const cosPitch = Math.cos(pitch);
  return {
    x: Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: Math.cos(yaw) * cosPitch,
  };
}

/** 방향 벡터 → 방위각·고도각(deg). directionFromAngles 의 역함수. */
export function anglesFromDirection(direction) {
  const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
  const x = direction.x / length;
  const y = direction.y / length;
  const z = direction.z / length;
  const pitch = Math.asin(Math.min(1, Math.max(-1, y))) * RAD_TO_DEG;
  const yaw = Math.atan2(x, z) * RAD_TO_DEG;
  return { yawDeg: yaw, pitchDeg: pitch };
}

/** 초기 속도 = 방향 × 파워. */
export function launchVelocity({ yawDeg, pitchDeg, power }) {
  const direction = directionFromAngles(yawDeg, pitchDeg);
  const speed = clampPower(power);
  return {
    x: direction.x * speed,
    y: direction.y * speed,
    z: direction.z * speed,
  };
}

/** 발사 상태를 한 번에 만든다. */
export function launchState({ yawDeg, pitchDeg, power }) {
  return {
    position: muzzlePosition(),
    velocity: launchVelocity({ yawDeg, pitchDeg, power }),
  };
}

/**
 * 예측 궤적. 실제 비행과 **같은** simulateFlight 를 쓴다.
 * 미리보기와 실제 궤적이 어긋나면 안 되기 때문이다.
 */
export function predictTrajectory(initial, options = {}) {
  const { points } = simulateFlight(initial, {
    dt: DEFAULT_STEP_SECONDS,
    maxSteps: 420,
    ...options,
  });
  return points;
}
