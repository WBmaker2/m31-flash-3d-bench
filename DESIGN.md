---
name: M3.1 FLASH / 3D BENCH — Pop-up Book
description: 18개의 3D 게임을 한 권의 입체 팝업북으로 펼치는 교실용 쇼케이스.
colors:
  paper: "#f4ead8"
  paper-bright: "#fff8eb"
  paper-mid: "#efe1c9"
  paper-edge: "#e3d4bb"
  crease: "#cbb896"
  ink: "#2b2118"
  ink-soft: "#65543f"
  ink-faint: "#685741"
  red: "#b93d29"
  red-deep: "#8d2c1e"
  blue: "#2f5fa8"
  ochre: "#d9a62e"
  green: "#6f9b52"
  table: "#2b1e14"
  table-deep: "#1b110a"
typography:
  display:
    fontFamily: "Nanum Myeongjo, AppleMyungjo, Georgia, serif"
    fontSize: "clamp(36px, 4.4vw, 58px)"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Nanum Gothic Coding, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "IBM Plex Mono, Nanum Gothic Coding, ui-monospace, monospace"
    fontSize: "9px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.12em"
rounded:
  none: "0"
  paper: "2px"
  paper-edge: "3px"
  page-sm: "4px"
  page: "6px"
spacing:
  page: "clamp(22px, 3.2vw, 48px)"
  page-gap: "40px"
  book-width: "1240px"
  tab-height: "22px"
components:
  paper-tab:
    backgroundColor: "{colors.red}"
    textColor: "{colors.paper-bright}"
    rounded: "{rounded.paper}"
    padding: "12px 18px"
  paper-tab-small:
    backgroundColor: "{colors.red}"
    textColor: "{colors.paper-bright}"
    rounded: "{rounded.paper}"
    padding: "8px 12px"
  tab:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "2px 5px"
  tab-current:
    backgroundColor: "{colors.red}"
    textColor: "{colors.paper-bright}"
    rounded: "{rounded.none}"
    padding: "2px 5px"
  progress-stamp:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "7px 8px"
  player-dialog:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.page}"
    padding: "0"
  run-command:
    backgroundColor: "{colors.paper-mid}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "10px 12px"
---

# Design System: M3.1 FLASH / 3D BENCH — Pop-up Book

## Overview

**Creative North Star: "The Pop-up Book"**

18개의 3D 게임을 한 권의 두꺼운 카드스톡 책으로 펼친다. 표지나 균일한 카드 그리드가 아니라, 펼친 두 페이지·거터·탭 레일·팝업 무대가 화면의 구조다. 게임은 종이 색지 레이어 사이에서 튀어나오고, 실제 스크린샷이 무대 위에 서며, "이 세계로 들어가기"가 그 무대 위에 있다. 검증은 책 뒤쪽의 책갈피와 접이식 기록으로 물러난다.

**Key Characteristics:**
- 크림색 종이와 잉크, 주홍·코발트·황토·풀색 색지.
- 2px 종이 모서리, 6px 책 모서리, 아래로 두꺼운 종이 탭 그림자.
- 명조 헤드라인, 모노 라벨·숫자, 본문은 나눔고딕코딩.
- 한 번에 한 펼침. 18개 번호와 6·6·6 그룹은 유지한다.
- 실제 `docs/cards/` 스크린샷만 쓴다. 가짜 목업을 만들지 않는다.

## Colors

- **Paper / Ink** — `#f4ead8` 위의 `#2b2118`은 13.2:1. 보조 `#65543f`는 6.1:1.
- **Red** — `#b93d29`는 종이 위 4.7:1이라 작은 글씨에는 쓰지 않는다. 활성 탭·주 행동·현재 위치에는 `#fff8eb` 글자로 5.3:1을 확보한다. `#8d2c1e`는 작은 글씨와 종이 탭 아래쪽 두께.
- **Blue / Ochre / Green** — 팝업 무대의 색지 레이어와 보조 표식. 본문 텍스트에는 쓰지 않는다.
- **Table** — `#2b1e14`는 책이 놓인 어두운 책상. 페이지 위 잉크로 쓰지 않는다.

색은 게임이 가져온다. 책의 크림·잉크·색지는 고정이고, 18개 스크린샷의 색이 페이지마다 달라진다. 책 자체에 그라데이션·네온을 더하지 않는다.

## Typography

- **Display: Nanum Myeongjo 700.** h1은 `clamp(36px, 4.4vw, 58px)`, 섹션 제목은 30–44px, 게임명은 18–32px. 자간은 -0.03~-0.04em.
- **Body: Nanum Gothic Coding 400/700.** 설명은 11–13px, 라벨은 9–12px. Gowun Dodum은 용량 가드(4.10MB)로 제외했다.
- **Mono: IBM Plex Mono 400/600.** 탭 번호, 쪽번호, 검사 수, 표 수치에만 쓴다. 본문에 쓰지 않는다.

## Layout

- 책 최대 폭 1240px. 두 페이지 48/52, 거터 36px, 페이지 여백 `clamp(22px, 3.2vw, 48px)`.
- 첫 화면: 왼쪽 페이지는 zoo 팝업 무대, 오른쪽 페이지는 h1·설명·18개 탭·수치 한 줄.
- 980px 이하: 한 페이지로 접고 탭은 가로 스크롤 스트립. 390px에서 가로 스크롤 0.
- 8개 펼침: 첫 장 → 목차 → 세 그룹 → 관찰 기록 → 검증의 책갈피 → 책 뒤쪽.
- 섹션 사이는 40px, 책 안쪽 리듬은 위 여백이 아래보다 크다.

## Elevation & Depth

- 책은 어두운 책상 위에 놓인다. 페이지 가장자리는 `#e3d4bb`, 접힌 자리는 `#cbb896`, 거터는 36px 그라데이션.
- 종이 탭은 아래로 5px 두께의 단단한 그림자 + 부드러운 바닥 그림자. hover에서 2px 떠오르고 active에서 3px 눌린다.
- 팝업 무대의 색지 레이어는 18–26px 부드러운 그림자로 층을 만든다.
- 모달은 책상 위로 종이 한 장이 떠오르는 느낌. 유리·글래스모피즘·금색 펄스 장식은 쓰지 않는다.

## Shapes

- 페이지 모서리는 4–6px, 종이 탭·패널은 2px. 카드마다 다른 둥근 모서리를 쓰지 않는다.
- 괘선은 1px 실선 또는 점선. 표와 목차는 책의 괘선처럼 얇게.
- 팝업 색지는 직사각형을 회전·겹쳐 만든다. 유기적 클립패스로 사진을 오려내지 않는다.

## Components

- **Paper tab** — 주 행동. 주홍 바탕, 크림 글자, 아래로 5px 두께. 첫 화면의 "이 세계로 들어가기"에만 `btn-pulse` 금빛 링.
- **Tab rail** — 18개 세계의 번호·짧은 이름. 활성 탭은 10px 오른쪽으로 나오고 주홍 바탕. 모바일에서는 가로 스크롤.
- **Game panel** — 실제 스크린샷 16:10, 번호, 게임명, 능력 한 줄, 설명 한 줄, `검사 N`, 플레이 탭. 6개 패널이 한 펼침.
- **Progress stamp** — 점선 테두리의 관찰 스탬프. 번호·게임명·별·단계·점수. 빈 상태는 흐리게.
- **Player dialog** — 종이 프레임 안의 iframe. 상단에 게임명·새 탭·닫기. `aria-labelledby="player-name"`.
- **Run command** — `run/index.html`의 명령 행. 모노 코드 + 복사 버튼.

## Do's and Don'ts

- **Do** 실제 게임 스크린샷과 실제 `docs/checks.json` 수치를 쓴다.
- **Do** 18개 번호와 6·6·6 그룹을 유지한다.
- **Do** 종이의 두께·거터·탭 레일을 레이아웃 구조로 쓴다.
- **Do** 키보드 포커스, `aria-current`, `aria-label`, reduced motion을 유지한다.
- **Don't** 다크 터미널·네온·글래스모피즘을 랜딩에 다시 넣지 않는다.
- **Don't** 카드 18개를 같은 크기로 반복하는 그리드로 돌아가지 않는다.
- **Don't** 검증 수치를 카드마다 네 줄로 반복하지 않는다. 책 뒤쪽 표에 모은다.
- **Don't** 가짜 후기·고객 수·수상·벤치마크 수치를 만들지 않는다.
- **Don't** Gowun Dodum을 다시 추가하지 않는다. 용량 가드에서 제외된 결정이다.
