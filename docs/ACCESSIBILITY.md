# 접근성 점검 — 2026-10-25

## 이번에 적용한 것

- **상태 알림**: 게임의 `#status-line`, `#status`, `#info`, `#toast`에 `aria-live="polite"`를 붙였습니다.
  공용 `showToast`도 `role="status"`·`aria-live="polite"`·`aria-atomic="true"`를 사용합니다.
- **별점**: `★`을 화면 낭독기에서 읽지 않도록 `aria-hidden` 처리하고, 별 묶음에
  `aria-label="별 2개 / 3개"`를 붙였습니다.
- **팝업**: 공용 dialog에 `aria-labelledby`(제목)를 붙이고, 닫을 때 이전 포커스로 돌아갑니다.
  기본 포커스는 primary 버튼, 없으면 첫 버튼으로 이동합니다.
- **랜딩**: `PLAY` 버튼에 게임 이름을 포함한 `aria-label`을 붙였습니다. 플레이어 dialog는
  `aria-labelledby="player-name"`을 씁니다.
- **터치**: cloud·maze·flock에 실제 `<button>` 기반 터치 패드를 추가했습니다.
- **모션**: `prefers-reduced-motion`에서 펄스·전환을 끕니다(기존 처리 유지).

## 남은 과제

| 과제 | 현재 상태 | 다음 단계 |
|---|---|---|
| 키보드만으로 완주 | 일부 게임은 캔버스 클릭이 필요 | 슬롯/칸 커서를 키보드로 이동하는 공용 헬퍼 |
| 화면 낭독기로 3D 플레이 | 캔버스는 `role="img"` + 설명만 제공 | 게임 상태를 텍스트 패널로 요약하는 보조 모드 |
| 자동 접근성 검사 | 수동 점검 | `@axe-core/playwright`를 QA에 연결 |
| 색 대비 | 육안 확인 | 대비 계산 스크립트 또는 axe 규칙 |
| Safari·구형 기기 | Chromium QA만 | WebKit 프로젝트 추가 |

## 원칙

3D 게임의 모든 조작을 화면 낭독기로 대체하는 것은 현실적이지 않습니다. 대신
**상태를 텍스트로 알리고, 키보드/터치로 같은 조작을 할 수 있게** 하는 것을 우선합니다.
새 게임은 `docs/GAME-IDEAS.md`의 체크리스트에 이 항목을 포함합니다.
