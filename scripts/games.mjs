// 게임 목록의 단일 진실 공급원. 스크립트는 이 목록을 읽어 검사 대상을 정한다.
// 게임을 추가할 때는 이 파일과 폴더·index.html·steps.mjs 만 갱신하면 된다.
export const GAMES = [
  { id: "zoo", title: "폴리곤 동물원", capability: "절차적 지오메트리 조립 + 애니메이션" },
  { id: "molecule", title: "3D 분자 빌더", capability: "클릭 상호작용 + 화학 규칙 + 판정" },
  { id: "defense", title: "3D 타워 디펜스", capability: "실시간 상태 머신 + 경로 + 전투" },
  { id: "shapes", title: "3D 도형 조립실", capability: "3D 회전 + 격자 배치 + 형상 판정" },
  { id: "ballistics", title: "3D 탄도 타워", capability: "수치 적분 + 연속 충돌 + 조준" },
  { id: "robot", title: "3D 로봇 팔 조립실", capability: "역기구학 + 관절 체인 + 링크 충돌" },
  { id: "maze", title: "3D 미로 탈출", capability: "1인칭 카메라 + 절차 생성 + 최단 경로" },
  { id: "flock", title: "3D 무리 유도", capability: "다체 에머전트 행동 + 이웃 탐색" },
  { id: "sculpt", title: "3D 형태 공방", capability: "암시적 곡면(SDF) + CSG + 등표면 메시 추출" },
  { id: "gears", title: "3D 기어 공방", capability: "회전 동역학 + 기어비 전파 + 톱니 위상" },
  { id: "paint", title: "3D 물감칠 공방", capability: "표면 셀 그래프 + 국소 flood fill + 색 비교 채점" },
  { id: "dice", title: "3D 주사위 놀이", capability: "시드 난수 결정론 + 자세→면 매핑 + 턴 상태 머신" },
  { id: "balance", title: "3D 균형저울", capability: "역학 평형(모멘트) + 무게중심 + 최소 추 열거" },
  { id: "cloud", title: "3D 구름 점프", capability: "캐릭터 컨트롤러 + 스윕(CCD) 착지 + 3인칭 카메라 리그" },
  { id: "laser", title: "3D 빛 거울 공방", capability: "기하 광학(반사 법칙) + 격자 광선 추적 + 전수 해법 탐색" },
  { id: "net", title: "3D 전개도 맞추기", capability: "전개도 접기(굴리는 큐브) + 면 대응 + 정답 유일성" },
  { id: "rail", title: "3D 기차 레일", capability: "조각 포트 연결 + 격자 경로 탐색 + 최소 조각 수" },
  { id: "draw", title: "3D 그림 그리기", capability: "픽셀 그림 해석 + 자유 배치 + 스냅샷 비교" },
];

export const GAME_IDS = GAMES.map((game) => game.id);

export function gameById(id) {
  return GAMES.find((game) => game.id === id) ?? null;
}
