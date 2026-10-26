# 실행 기록 — 모델·커밋·검사 결과

이 파일은 "언제, 어떤 모델이, 어떤 상태를 만들었는지"를 남기는 실행 로그입니다.
수치가 바뀌면 해당 커밋의 `docs/checks.json`을 함께 봅니다.

## 2026-10-26 — 랜딩 입체 팝업북

- 모델: `opencode/minimax-m3.1-flash-free`
- 작업: 랜딩을 입체 팝업북으로 전면 교체, `landing/` 분리, `run/index.html` 분리
- 단위 테스트: 615개 통과
- QA: `npm run qa` 18종+랜딩, `npm run qa:ui`, `npm run qa:visual` 통과
- 화면: 1440×900·1280×800·1366×768·980×800·768×1024·390×844 확인, 가로 스크롤 0
- 폰트: Nanum Myeongjo 700 추가(1.36MB). Gowun Dodum은 4.10MB로 가드 초과 → 기존 Nanum Gothic Coding 사용

## 2026-10-25 — 개선 작업

- 모델: `opencode/minimax-m3.1-flash-free`
- 기준 커밋: `320e71b` (2026-10-24, 엔딩 화면 추가)
- 작업 범위: P0(신뢰성) → P1(구조·접근성·성능) → P2(벤치마크·교실 기능)
- 단위 테스트: 615개 통과 (게임 448 + 공통 167)
- 테스트 환경: 순수 테스트는 Node, DOM 테스트는 jsdom (`common/common.test.js`, `zoo/src/animals.test.js`)
- 주요 변경:
  - defense·molecule에 공용 스타일·폰트 적용, 레벨 팝업 닫기 버튼
  - 18개 게임 back-link `target="_top"` (iframe 모달 탈출)
  - cloud·maze·flock 터치 패드
  - 랜딩 문서 수치·경로 정정, 카드 전체 클릭, 이미지 lazy loading
  - 공용 실행 계층 `common/engine/stage.js` 도입 (net·draw·laser·rail·gears·paint·dice)
  - QA: 엔딩 스모크, 공용 팝업 스타일, 모바일 터치 버튼, `qa:ui` 계약 검사
  - 랜딩 MY PROGRESS 대시보드, `docs/BENCHMARK.md`
- QA 결과 (2026-10-25): `npm test` 615개 · `npm run qa` 게임 18종+랜딩 · `npm run qa:visual` 18종 · `npm run qa:ui` 통과
- 화면 기준 갱신: zoo는 `?still=1`에서 애니메이션이 멈추도록 바뀌어 기준을 다시 저장했고, maze는 1인칭 플레이어 투영이 NaN이던 기준을 고쳤습니다.

## 2026-10-24 — 18종 완성

- 기준 커밋: `320e71b`
- 18개 게임, 613개 테스트, 엔딩 화면 도입
- 상세 내역: `README.md`의 `## 내역` 참고

## 기록 규칙

1. 작업을 마치면 날짜 섹션을 추가하고 모델·커밋·검사 결과를 적는다.
2. 수치가 바뀌면 `docs/checks.json`과 랜딩 `data-check`도 함께 갱신한다.
3. 실패한 검사가 있으면 숨기지 않고 "실패 → 원인 → 수정" 순서로 적는다.
