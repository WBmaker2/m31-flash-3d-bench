// 픽셀 그림과 3D 복셀 배치의 비교. 순수 함수라 Node 에서 그대로 테스트된다.

export function cellKey(col, row) {
  return `${col},${row}`;
}

/**
 * 픽셀 그림을 칸 목록으로 바꾼다.
 * rows: 문자열 배열. '.' 은 빈 칸, 나머지 문자는 색 이름이다.
 */
export function parsePicture(rows) {
  const cells = [];
  let maxCol = 0;
  let maxRow = 0;
  rows.forEach((line, row) => {
    maxRow = Math.max(maxRow, row);
    [...line].forEach((char, col) => {
      maxCol = Math.max(maxCol, col);
      if (char === "." || char === " ") return;
      cells.push({ col, row, color: char });
    });
  });
  return {
    cells,
    width: maxCol + 1,
    height: maxRow + 1,
  };
}

/** 그림에 쓰인 색 목록. */
export function pictureColors(rows) {
  const colors = new Set();
  for (const line of rows) {
    for (const char of line) {
      if (char !== "." && char !== " ") colors.add(char);
    }
  }
  return [...colors];
}

/**
 * 배치와 목표 그림을 비교한다.
 * placement: Map("col,row" → 색 이름)
 */
export function comparePicture({ rows, placement }) {
  const picture = parsePicture(rows);
  let matched = 0;
  let wrong = 0;
  for (const cell of picture.cells) {
    const placed = placement.get(cellKey(cell.col, cell.row));
    if (placed === cell.color) matched += 1;
    else wrong += 1;
  }
  let extra = 0;
  for (const [key, color] of placement) {
    const target = picture.cells.find((cell) => cellKey(cell.col, cell.row) === key);
    if (!target || target.color !== color) extra += 1;
  }
  const total = picture.cells.length;
  return {
    matched,
    wrong,
    extra,
    total,
    rate: total === 0 ? 0 : matched / total,
    width: picture.width,
    height: picture.height,
  };
}
