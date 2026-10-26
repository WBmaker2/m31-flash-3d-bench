# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **교사·학생 (확인됨):** 수업이나 학습 상황에서 브라우저로 3D 게임을 찾아 바로 플레이하려는 사람. 설치·로그인·빌드 없이 동작해야 한다.
- 그 밖의 방문자(모델 평가자, 일반 방문자, 결과물 열람자)는 확인되지 않았다. future work에서 임의로 주 사용자로 승격하지 않는다.

## Product Purpose

MiniMax M3.1 Flash가 처음부터 끝까지 구현한 three.js 3D 게임 18종을 한곳에서 보여주고, 방문자가 카탈로그를 훑어 관심 있는 게임을 그 자리에서 플레이하게 한다. 성공은 **전체 카탈로그 탐색**이다. 방문자가 18종의 범위를 파악하고 첫 게임을 시작하면 성공이다.

## Positioning

18종 모두가 실제로 플레이 가능한 브라우저 게임이며, 랜딩에 적힌 검사 수치는 `docs/checks.json`의 실제 실행 결과와 대조된다. 홍보 문구가 실제 검사 결과와 어긋나면 QA가 실패하므로, **쇼케이스가 거짓말할 수 없는 구조**다.

## Operating Context

- 정적 호스팅(GitHub Pages)에서 실행된다. 빌드 단계가 없고, `python3 -m http.server` 같은 정적 서버만 있으면 된다.
- three.js 0.186.1을 CDN importmap으로 불러온다. 폰트와 벤더 파일은 저장소에 자체 호스팅한다.
- 랜딩은 `index.html` + `landing/landing.css` + `landing/landing.js`로 이루어진 입체 팝업북이다. PLAY는 같은 페이지의 모달 iframe에서 게임을 연다. 게임의 뒤로 가기는 `target="_top"`으로 랜딩 모달을 닫는다.
- 진행 기록은 로그인 없이 브라우저 localStorage에 남는다. 랜딩의 "관찰 기록"이 이를 읽어 보여준다.
- 카드 이미지는 `npm run qa:cards`, 랜딩·게임 검사는 `npm run qa`, UI 계약은 `npm run qa:ui`가 담당한다.
- UI 문구는 한국어다.

## Capabilities and Constraints

- 게임 18종: zoo, molecule, defense, shapes, ballistics, robot, maze, flock, sculpt, gears, paint, dice, balance, cloud, laser, net, rail, draw.
- 검사 자산: 단위 테스트 615개, 카드 이미지 54장(3시점 × 18), 4시점 화면 판정, `docs/checks.json`.
- 랜딩은 `index.html` + `landing/landing.css` + `landing/landing.js`로 이루어진다. 게임 패널 18개, `progress-grid`, 플레이 dialog, `data-check` 수치 계약이 `scripts/check-ui.mjs`와 `scripts/shot.mjs`에 의해 검사된다. 실행 안내는 `run/index.html`로 분리되어 있다.
- 랜딩의 수치 표시는 하드코딩처럼 보여도 실제로는 `docs/checks.json`과 대조된다. 이 계약을 깨는 카피·구조 변경은 허용되지 않는다.
- 로그인, 서버 저장, 결제, 사용자 계정은 없다.
- 3D 접근성은 캔버스 조작 전체를 대체하는 대신 상태 텍스트 알림과 키보드/터치 경로를 우선한다.

## Brand Commitments

- 공개 이름: **M3.1 FLASH / 3D BENCH**.
- 제품 약속: 랜딩에 적힌 수치는 실제 실행 결과여야 한다. 검증되지 않은 수치·후기·고객·수상 실적을 만들지 않는다.
- 모델 표기: MiniMax M3.1 Flash (free). three.js 0.186.1.

## Evidence on Hand

- `docs/cards/` — 게임별 실제 플레이 화면 54장.
- `docs/checks.json` — 게임별 테스트 수·콘솔 오류·불변식 위반·시점 간 화면 차이.
- `docs/shots/` — 게임별 4시점·모바일·랜딩 스크린샷.
- `README.md`, `docs/BENCHMARK.md`, `docs/RUNS.md`, `docs/ACCESSIBILITY.md` — 검증 방법과 결과 기록.
- 실제 사용자 후기, 언론 보도, 고객 수, 수상 실적은 없다. 새로 만들지 않는다.

## Product Principles

1. **18종 전체가 상품이다.** 한 게임의 완성도뿐 아니라 카탈로그의 범위와 다양성이 먼저 읽혀야 한다.
2. **진실이 홍보보다 앞선다.** 표시 수치는 실제 검사 결과와 연결되어야 하며, 과장된 카피를 넣지 않는다.
3. **설치 없이 바로.** 로그인·빌드·다운로드 없이 세계를 고르면 그 자리에서 플레이된다.
4. **교실에서 설명 없이.** 한국어 라벨, 게임별 한 줄 설명, 명확한 PLAY로 처음 온 교사·학생이 바로 이해해야 한다.
5. **검증은 신뢰 장치다.** 검증 3층은 쇼케이스를 지지하되, 카탈로그 탐색을 가로막지 않는다.

## Accessibility & Inclusion

- `docs/ACCESSIBILITY.md`의 원칙을 따른다: 상태 알림(`aria-live`), 별점 라벨, dialog 제목·포커스 복귀, 실제 `<button>` 기반 터치 패드, `prefers-reduced-motion` 존중.
- 남은 과제: 키보드만으로 일부 게임 완주, 화면 낭독기용 상태 요약, 자동 axe 검사, 색 대비 계산, WebKit 검증. 이번 랜딩 개선에서 새로 악화시키지 않는다.
