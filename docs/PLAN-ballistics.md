# 구현 계획 — 5번째 3D 게임 `ballistics/` (3D 탄도 타워)

- 작성일: 2026-10-20
- 실행 모델: `opencode/minimax-m3.1-flash-free`
- 선행 계획: [`PLAN.md`](PLAN.md) (1~3번 게임), 4번째 게임은 `shapes/`
- 외부 API 호출 없음. 이 세션에서 직접 구현한다.

## 1. 왜 이 게임인가 — 기존 4종과 축 분리

| 게임 | 검증하는 능력 | 탄도 타워와의 중복 |
|---|---|---|
| `zoo/` | 절차적 지오메트리 조립 + 애니메이션 | 없음 |
| `molecule/` | 클릭 상호작용 + 화학 규칙 + 판정 | 없음 |
| `defense/` | 실시간 상태 머신 + 경로 + 전투 | 일부 겹침(점수·웨이브). 탄도 타워는 **물리 수치 축**이라 별개 |
| `shapes/` | 3D 회전 + 격자 배치 + 형상 판정 | 없음 |

**이번에 새로 검증하는 능력**

1. **수치 적분** — 중력·바람·공기저항을 고정 스텝으로 누적하는 물리 계산
2. **연속 충돌 판정** — 빠른 발사체가 표적을 관통하지 않도록 선분 샘플링으로 잡기
3. **조준 변환** — 각도(방위·고도) ↔ 방향 벡터 ↔ 초기 속도의 왕복 변환
4. **예측 궤적 ↔ 실제 궤적 일치** — 미리보기와 실제 비행이 같은 수치를 갖는가
5. **파괴 후 구조 붕괴** — 지지 상실 판정과 낙하 잔해의 정지

## 2. 게임 정의

**핵심 루프**: 조준(방위·고도·파워) → 발사 → 탄도 비행 → 표적 파괴 → 잔해 낙하 → 남은 샷으로 클리어

- **표적(target)**: 격자 칸(2 m)에 놓인 2×2×2 m 상자. 명중하면 파괴되고, 그 위 표적은
  지지를 잃고 낙하해 바닥에 쌓인다. **무너뜨린 것 역시 클리어로 친다.**
- **벽(wall)**: 파괴되지 않는 블록. 발사체를 막고, 위에 올라간 표적을 받친다.
- **이동 표적**: x축을 따라 왕복하는 표적. 궤적이 아니라 그 자리에서 기다린다.
- **레벨 8종**: 단일 표적 → 두 표적 → 바람 → 탑 무너뜨리기 → 장애물 회피 → 이동 표적 →
  성(다층 구조) → 최종(복합).
- **승패**: 표적을 모두 없애면 클리어. 샷을 다 쓰면 실패. 사용 샷 수로 별점(3/2/1).
- **범위 제외**: localStorage 저장·별점 기록·진행 해금. 레벨 선택은 세션 내에서만.
  (이번 작업 범위는 "게임 추가"만. `common/progress.js` 는 쓰지 않는다.)

## 3. 수치 계약 (단위 명시)

README의 "코딩 규칙 1"을 그대로 적용한다. 계산은 rad, 표시는 deg, 함수 이름에 접미사를 붙인다.

| 값 | 값 | 단위 |
|---|---|---|
| 중력 | 9.8 | m/s² |
| 거리 · 속도 · 시간 | m · m·s⁻¹ · s | |
| 각도 | 계산 rad / 표시 deg (`*Deg` `*Rad`) | |
| 고정 스텝 | 1/60 | s |
| 발사체 반지름 | 0.18 | m |
| 격자 칸 · 표적 상자 | 2 · 2×2×2 | m |
| 발사대 | 원점, 발사구 높이 1.6 | m |
| 표적 배치 | +Z 방향 8~20 | m |
| 파워 | 6~30 | m/s |
| 고도각 · 방위각 | 5~80 · -45~45 | deg |

**순수 모듈은 three에 묶지 않는다.** 좌표는 `{x, y, z}` 평범한 객체로 다루므로 Node에서
그대로 테스트된다(`shapes/src/rotations.js` 와 같은 방식).

## 4. 파일 구조

```
ballistics/
  index.html              # shapes/index.html 템플릿 (importmap 로컬→CDN 폴백)
  README.md
  src/
    stage.js              # 렌더러·조명·카메라·picker
    physics.js            # 적분·충돌·지지 검사·낙하 정지 (순수)
    aim.js                # 각도↔방향·발사 속도·궤적 예측 (순수)
    levels.js             # 레벨 데이터 (단일 진실 공급원)
    invariants.js         # 기하 불변식
    main.js               # UI 배선
    ballistics.test.js    # 단위 테스트
```

### 순수 API

```js
// physics.js
stepProjectile(state, { dt, gravity, wind, drag }) -> state
simulateFlight(initial, options) -> { points, landed, hit }
closestPointOnAabb(point, box) -> { x, y, z }
sphereIntersectsAabb(center, radius, box) -> boolean
hitAlongSegment(from, to, radius, boxes) -> { box, point, t } | null
findUnsupported(blocks) -> ids[]
settleDebris(body, dt) -> body
scoreForShot({ targets, shotsUsed, shotsLeft }) -> number
starsForShots(shotsUsed, par) -> 0 | 1 | 2 | 3

// aim.js
directionFromAngles(yawDeg, pitchDeg) -> { x, y, z }
anglesFromDirection(dir) -> { yawDeg, pitchDeg }
launchVelocity({ yawDeg, pitchDeg, power }) -> { x, y, z }
predictTrajectory(initial, options) -> points[]
```

## 5. 검증 설계 3층

### 1층 — 단위 테스트 (55개)

| 묶음 | 검증 내용 |
|---|---|
| 적분 기본 | `dt=0` 이면 상태 불변 · 초기속도 0 + 무중력이면 위치 불변 · 중력 0 수평발사에서 `x = v·t` 정확히 |
| 수치 해석 | 등거리 45° 최대 사거리 `= v²/g` (±1%) · 에너지 보존 `v²/2 + g·y` 일정 (±1e-6) · 바람 가속 `z(t) = v·t + ½a·t²` · 드래그 0 이면 속도 크기 일정 |
| 조준 | yaw 0/pitch 0 → +Z · yaw 90° → +X · pitch 90° → +Y · deg ↔ 방향 왕복 일치 |
| 궤적 일치 | **예측 궤적 vs 실제 시뮬 궤적 최대 오차 < 1e-9** |
| 충돌 | 정면 명중 판정 · 빗나감 판정 · AABB 클램프 경계값 · 선분 중간 관통도 잡힘 |
| 붕괴 | 아래 블록 파괴 시 위 블록만 낙하 대상 · 바닥 블록은 지지됨 · 잔해가 `y = 1` 에서 정지 · 잔해가 지면 아래로 내려가지 않음 |
| 레벨·점수 | 레벨 id 유일 · 샷 수 ≥ 표적 수 · 좌표 유한 · 별점 경계 |

### 2층 — 기하 불변식 (0.5초마다, 화면 배지)

발사체 위치·속도 유한 / 발사체 속도 상한 / 표적 y 범위 / 잔해 `y ≥ 1` / 정적 블록 격자 중복 없음 /
샷 카운터 ≤ 제한 / 남은 표적 수 ≥ 0

### 3층 — 화면 판정

기존 파이프라인을 그대로 쓴다. `setView` 는 `default · card · front · side · top` 5개 시점을
지원해야 한다(카드 생성은 `card` 각도를 쓴다).

## 6. 통합 체크리스트

| 파일 | 변경 |
|---|---|
| `scripts/steps.mjs` | `STEPS.ballistics` (조준 → 발사 → 명중 캡처), `CARD_SETUP.ballistics` |
| `scripts/shot.mjs` | 대상 안내 문구에 `ballistics` 추가 |
| `scripts/card-shots.mjs` | `GAMES` 배열에 추가 |
| `scripts/visual-regress.mjs` | `GAMES` 배열에 추가 |
| `package.json` | `qa` 스크립트 + `qa:ballistics` |
| `index.html` | 5번째 카드 · 제목 "3D 게임 4종" → "5종" · 각주 하드코딩 수치 갱신 |
| `docs/checks.json` | `npm run qa:cards` 로 재생성 |
| `docs/baseline/ballistics.png/.json` | `npm run qa:visual:update` 로 생성 |
| `docs/PLAN.md` | 게임 표에 5번째 행 + 설계 절 |
| `README.md` | 게임 표 · 검증 수치 · "## 내역" 갱신 |

## 7. 작업 순서

1. 기준 확보 — `npm test`(122개) · `npm run qa` 통과 확인
2. `physics.js` + `aim.js` 작성 → 단위 테스트를 먼저 쓴다(TDD)
3. `levels.js` (레벨 8종) + `invariants.js`
4. `stage.js` → `index.html` (슬라이더 3개 + 발사 버튼 `btn-pulse`)
5. `main.js` — 발사 · 비행 · 충돌 · 붕괴 · 판정
6. `node scripts/shot.mjs ballistics` → 콘솔 오류 0 · 불변식 통과 · 4시점 판정 통과
7. `npm run qa:cards` → 카드 3장 + `checks.json` → `npm run qa:visual:update` → `npm run qa` → `npm run qa:visual`
8. 랜딩 카드 · README · `docs/PLAN.md` · 내역 갱신 → `node scripts/check-sync.mjs` 통과

## 8. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| 탄도 수치가 조용히 틀림 (README가 경고한 대표 실패) | 예측 궤적과 실제 궤적을 **같은 함수**로 계산하고, 불변식으로 두 경로의 오차를 1e-9 미만으로 강제 |
| deg/rad 혼용 (분자 결합각 180° 사건의 재현) | `*Deg` `*Rad` 접미사 + 왕복 변환 단위 테스트 |
| 정지 상태 좌표 미갱신 (동물원 사건) | 예측 궤적은 매 프레임 재계산하고, 정지 상태에서도 좌표가 반영됨을 테스트 |
| 잔해가 지면 아래로 파묻힘 | 잔해는 `y ≥ 1` 에서 정지. 불변식으로 상시 확인 |
| 지지 검사가 격자 좌표와 월드 좌표를 혼용 | 격자 좌표는 `levels.js` 한 곳에서 관리, 월드 변환은 `main.js` 경계에서 한 번만 |
| 발사체가 표적을 관통함 | 선분 샘플링 기반 `hitAlongSegment` 로 스텝 사이 충돌까지 잡음 |
| `main.js` 비대화 | 도메인 로직은 `physics.js` `aim.js` 에 모으고 `main.js` 는 UI 배선만 (PLAN §7 규칙) |
| 회귀 | 새 게임 추가만 — 기존 4종 코드는 건드리지 않는다. `npm test` 122개 유지 |

## 9. 완료 기준

- `npm test` 통과 (기존 122 + 신규 55 = 177)
- `npm run qa` 5개 타깃 통과 (콘솔 오류 0 · 불변식 위반 0)
- `npm run qa:visual` 통과
- `node scripts/check-sync.mjs` 통과 — 랜딩 수치가 `docs/checks.json` 과 일치
- 모바일 390×844 에서 HUD 겹침·화면 밖 패널 없음
- README 내역에 항목 기록
