# 구현 계획 — 6번째 3D 게임 `robot/` (3D 로봇 팔 조립실)

- 작성일: 2026-10-20
- 실행 모델: `opencode/minimax-m3.1-flash-free`
- 선행 계획: [`PLAN.md`](PLAN.md) (1~3번), [`PLAN-ballistics.md`](PLAN-ballistics.md) (5번)
- 외부 API 호출 없음. 이 세션에서 직접 구현한다.

## 1. 왜 이 게임인가 — 기존 5종과 축 분리

| 게임 | 검증하는 능력 |
|---|---|
| `zoo/` | 절차적 지오메트리 조립 + 애니메이션 |
| `molecule/` | 클릭 상호작용 + 화학 규칙 + 판정 |
| `defense/` | 실시간 상태 머신 + 경로 + 전투 |
| `shapes/` | 3D 회전 + 격자 배치 + 형상 판정 |
| `ballistics/` | 수치 적분 + 연속 충돌 + 조준 + 연쇄 붕괴 |

**이번에 새로 검증하는 능력**

1. **역기구학(2절 IK)** — 목표 좌표에서 관절 각을 계산한다
2. **정방향 키네마틱과 왕복 검증** — 각도 → 좌표 → 각도가 항등으로 돌아온다
3. **관절 체인 좌표 변환** — 베이스 회전 + 어깨 + 팔꿈치의 누적 변환
4. **링크와 장애물의 충돌** — 세그먼트 ↔ 원기둥 최단거리
5. **두 해의 선택** — 같은 목표에 대해 팔꿈치가 위/아래 두 해를 갖는다

이 저장소가 실제로 두 번 실패한 영역("좌표·회전·부착")을 정면으로 겨냥하면서,
2절 IK는 닫힌 해가 있어 **수치로 판정**할 수 있다.

## 2. 게임 정의

**핵심 루프**: 조립 벤치 위의 표적 판을 클릭 → 로봇 팔이 역기구학으로 관절 각을 계산해
블록을 집어 옮기고 놓음 → 배치 오차를 판정

- 팔 구성: **베이스 회전(Y축) + 어깨 + 팔꿈치 + 그리퍼**. 그리퍼를 마지막 링크에 포함시켜
  링크 끝점이 곧 배치점이 된다
- 도달 반경 링이 벤치에 그려져 있다. 링 밖의 판을 누르면 "도달할 수 없습니다" 안내
- 판이 2개인 레벨이 있다 — 하나는 도달 불가(미끼), 하나가 정답
- **장애물 기둥**이 있으면 같은 목표에 대해 팔꿈치 두 해가 생긴다. 충돌 없는 해를
  팔이 자동으로 고른다
- 판정: 배치 오차(링크 끝점 ↔ 표적 중심)가 허용 오차 이내면 클리어, 오차 구간으로 별 3/2/1
- 클리어하면 결과 팝업에 **다음 단계** 버튼이 뜬다(다른 5게임과 동일)

## 3. 수치 계약

| 값 | 값 | 단위 |
|---|---|---|
| 어깨 높이 | 0.9 | m |
| 위팔 길이 l1 | 1.6 | m |
| 팔꿈치~그리퍼 길이 l2 | 1.65 | m (앞팔 1.4 + 그리퍼 0.25) |
| 최대 도달 반경 | 3.25 | m |
| 그리퍼 이동 | 관절 각 lerp, 0.8 s | s |
| 허용 오차 | 0.50 → 0.08 | m (레벨별) |

각도는 계산 rad / 표시 deg (`*Deg` `*Rad` 접미사). 순수 모듈은 three에 묶지 않는다
(`{x, y, z}` 평범한 객체).

### 역기구학 식 (구현 기준)

목표까지의 수평 거리 `r = hypot(x, z)`, 어깨 기준 높이 `y = target.y - 0.9`,
어깨에서 목표까지 `d = hypot(r, y)`.

```
baseYaw   = atan2(x, z)                     // +Z 쪽이 0
alpha     = atan2(y, r)                     // 목표 방향
gamma     = acos((l1² + d² - l2²) / (2·l1·d))
bend      = acos((d² - l1² - l2²) / (2·l1·l2))   // 0 = 곧게, π = 접기
shoulder  = alpha ± gamma
elbowRel  = ∓ bend                         // 해에 따라 부호가 반대
```

정방향 키네마틱(팔의 평면 좌표 `(r, y)`):

```
j1  = (l1·cos(shoulder),      l1·sin(shoulder))
j2  = j1 + (l2·cos(shoulder+elbowRel), l2·sin(shoulder+elbowRel))
tip = j2
```

월드 좌표는 `(r·sin(baseYaw), y, r·cos(baseYaw))` 로 옮긴다.
`forwardArm(solveArm(t))` 가 `t` 를 그대로 복원해야 한다(오차 1e-9).

## 4. 레벨 8종

| # | 레벨 | 내용 | 허용오차 |
|---|---|---|---|
| 01 | 첫 조립 | 가까운 표적 + 도달 불가 미끼 | 0.50 m |
| 02 | 먼 곳 | 최대 거리 부근 표적 | 0.40 m |
| 03 | 아래쪽 | 팔꿈치를 접어야 낮은 목표 | 0.35 m |
| 04 | 기둥 우회 | 두 해 중 하나만 기둥을 피함 | 0.30 m |
| 05 | 도달 불가 | 미끼 판 + 정답 판 | 0.28 m |
| 06 | 높은 목표 | 어깨보다 높은 지점 | 0.20 m |
| 07 | 이중 장애물 | 기둥 2개 | 0.14 m |
| 08 | 최종 | 먼 거리 + 기둥 + 좁은 오차 | 0.08 m |

## 5. 파일 구조

```
robot/
  index.html
  README.md
  src/
    stage.js       렌더러 · 조명 · 카메라 · 4시점
    ik.js          2절 IK · FK · 링크 세그먼트 · 기둥 충돌 · 배치 계획 (순수)
    levels.js      레벨 8종 데이터 + 배치 오차 판정 (순수)
    arm.js         로봇 팔 메시 조립과 관절 회전
    invariants.js  기하 불변식
    hud.js         HTML 연결
    main.js        상태 머신 + UI 배선
    robot.test.js  단위 테스트
```

### 순수 API

```js
// ik.js
solveArm(target, config, sign = 1)   // → { baseYaw, shoulder, elbow, reachable, residual }
forwardArm(angles, config)            // → { shoulderPos, elbowPos, tip }
armLinks(angles, config)              // → [세그먼트, 세그먼트]
segmentHitsCylinder(segment, pillar)  // → boolean
planPlacement(target, pillars, config)// → { angles, reachable, blocked, residual }

// levels.js
evaluatePlacement(error, level)       // → { cleared, stars }
```

## 6. 검증 3층

### 1층 — 단위 테스트 (약 40개)

| 묶음 | 검증 내용 |
|---|---|
| IK 왕복 | `forwardArm(solveArm(t))` 의 끝점이 목표와 오차 1e-9 |
| 도달 판정 | `l1+l2` 초과 → 미도달, `|l1-l2|` 미만 → 미도달, 경계값 |
| 각도 변환 | `baseYaw = atan2(x, z)`, 어깨/팔꿈치가 유효 범위 |
| 두 해 | 위로/아래로 접은 두 해가 모두 유효하고 각기 다르다 |
| 충돌 | 링크 세그먼트 ↔ 기둥 거리, 회피 가능한 해 선택 |
| 판정 | 오차 구간 → 별 3/2/1, 허용 오차 경계 |
| 레벨 데이터 | 표적 좌표 유한, 정답 판이 존재하고 해가 있음 |

### 2층 — 기하 불변식 (0.5초마다, 화면 배지)

관절 각 유한 · 끝점이 도달 반경 이내 · 링크가 기둥을 관통하지 않음 ·
블록이 벤치 아래로 내려가지 않음 · 오차 값 유한

### 3층 — 화면 판정

4시점 캡처 + 콘솔 오류 0 + 개체 가시성. 하네스 단계는 표적 판의 화면 좌표를 조회해
클릭 → 이동 → 배치 → 결과 팝업 캡처.

## 7. 통합 체크리스트

| 파일 | 변경 |
|---|---|
| `scripts/steps.mjs` | `STEPS.robot`, `CARD_SETUP.robot` |
| `scripts/shot.mjs` · `card-shots.mjs` · `visual-regress.mjs` | 대상 목록에 `robot` 추가 |
| `package.json` | `qa` + `qa:robot` |
| `index.html` | 6번째 카드, "5종" → "6종", 하드코딩 수치 갱신 |
| `docs/checks.json` · `docs/baseline/` · `docs/cards/` | 재생성 |
| `docs/PLAN.md` · `README.md` · `robot/README.md` | 문서 추가·갱신 |

## 8. 작업 순서

1. `docs/PLAN-robot.md` 작성 (이 문서)
2. `ik.js` + `levels.js` + 단위 테스트 (TDD)
3. 레벨 해법 검증 스크립트로 지오메트리 튜닝
4. `stage.js` → `arm.js` → `hud.js` + `index.html`
5. `main.js` — 계획 → 집기 → 이동 → 놓기 → 판정
6. `node scripts/shot.mjs robot` 통과
7. 하네스 · 랜딩 · 문서 갱신
8. `npm test` · `npm run qa` · `npm run qa:visual` · `node scripts/check-sync.mjs`

## 9. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| 팔꿈치 해의 부호 혼동 | IK→FK 왕복 테스트가 즉시 잡는다 (deg/rad 사건과 같은 유형) |
| 관절 축·각도 단위 혼동 | `*Deg`/`*Rad` 접미사 + 각도↔좌표 왕복 테스트 |
| 도달 불가 판정의 경계 | `l1+l2` ± 1e-9 경계 테스트 |
| 링크-기둥 충돌의 수치 안정성 | 세그먼트-원기둥 최단거리로 계산하고 오차를 명시 |
| 레벨이 해가 없거나 너무 빡빡함 | 레벨마다 정답 판의 해가 존재하는지 스크립트로 확인 |
| 회귀 | 기존 5게임 코드 미변경. `npm test` 181개 유지 |

## 10. 완료 기준

- `npm test` 통과 (181 + 신규 약 40)
- `npm run qa` 6게임 + 랜딩 통과, `npm run qa:visual` 통과
- `node scripts/check-sync.mjs` 통과, 모바일 390×844 HUD 겹침 없음
- README 내역 기록
