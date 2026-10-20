export async function placeShapesBlocks(page, count = 2) {
  const toPixels = (entry) => ({ x: ((entry.x + 1) / 2) * 1280, y: ((1 - entry.y) / 2) * 800 });

  for (let index = 0; index < count; index += 1) {
    const positions = await page.evaluate(() => window.__gameApi?.getScreenPositions?.() ?? []);
    const tray = positions.find((entry) => entry.id === "tray-0");
    const cells = positions.filter((entry) => entry.id.startsWith("cell-"));
    if (!tray || cells.length === 0) return;

    const trayPoint = toPixels(tray);
    await page.mouse.click(trayPoint.x, trayPoint.y);
    await page.waitForTimeout(300);

    const cell = cells[index] ?? cells[0];
    const point = toPixels(cell);
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(150);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(400);
  }
}

export const STEPS = {
  zoo: async (page, shot) => {
    await page.getByRole("button", { name: "강아지" }).click();
    await page.waitForTimeout(800);
    await shot("02-강아지");
    await page.getByRole("button", { name: "동물 추가" }).click();
    await page.waitForTimeout(600);
    await shot("03-추가후");
    await page.getByRole("button", { name: "모두 걷기" }).click();
    await page.waitForTimeout(1200);
    await shot("04-걷기");
    const positions = await page.evaluate(() => window.__gameApi?.getScreenPositions?.() ?? []);
    const animal = positions.find((entry) => entry.visible);
    if (animal) {
      await page.mouse.click(((animal.x + 1) / 2) * 1280, ((1 - animal.y) / 2) * 800);
      await page.waitForTimeout(500);
    }
    await page.getByRole("button", { name: "도감" }).click();
    await page.waitForTimeout(500);
    await shot("05-도감");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "찾기 게임" }).click();
    await page.waitForTimeout(500);
    await shot("06-찾��레벨");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  },
  molecule: async (page, shot) => {
    await page.getByRole("button", { name: "물 (H₂O)" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "예시 불러오기" }).click();
    await page.waitForTimeout(900);
    await shot("02-예시");
    await page.getByRole("button", { name: "자동 배치" }).click();
    await page.waitForTimeout(1200);
    await shot("03-자동배치");
    await page.getByRole("button", { name: "검사" }).click();
    await page.waitForTimeout(400);
    await shot("04-검사");
    await page.getByRole("button", { name: "암모니아 (NH₃)" }).click();
    await page.getByRole("button", { name: "예시 불러오기" }).click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "자동 배치" }).click();
    await page.waitForTimeout(1400);
    await shot("05-암모니아");
  },
  defense: async (page, shot) => {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    await page.getByRole("button", { name: "고속" }).click();
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.42);
    await page.waitForTimeout(600);
    await shot("02-타워배치");
    await page.getByRole("button", { name: "다음 웨이브" }).click();
    await page.getByRole("button", { name: "배속 1×" }).click();
    await page.waitForTimeout(3000);
    await shot("03-전투");
    await page
      .waitForFunction(() => window.__gameApi?.getState?.().waveActive === false, null, { timeout: 40000 })
      .catch(() => console.log("WARN: 웨이브가 제한 시간 안에 끝나지 않음"));
    await page.waitForTimeout(400);
    await shot("04-웨이브종료");
    await page.getByRole("button", { name: "난이도" }).click();
    await page.waitForTimeout(500);
    await shot("05-난이도");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  },
  shapes: async (page, shot) => {
    await placeShapesBlocks(page, 2);
    await shot("02-배치중");
  },
  maze: async (page, shot) => {
    await page.evaluate(() => window.__gameApi?.solve?.());
    await page.waitForTimeout(1200);
    await shot("02-탈출");
    await page.waitForTimeout(700);
    await shot("03-결과");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "레벨 선택" }).click();
    await page.waitForTimeout(500);
    await shot("04-레벨선택");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  },
  robot: async (page, shot) => {
    const positions = await page.evaluate(() => window.__gameApi?.getScreenPositions?.() ?? []);
    const goal = positions.find((entry) => entry.id === "plate-goal");
    if (goal) {
      await page.mouse.click(((goal.x + 1) / 2) * 1280, ((1 - goal.y) / 2) * 800);
    }
    await page.waitForTimeout(900);
    await shot("02-이동");
    await page.waitForTimeout(2200);
    await shot("03-조립완료");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "레벨 선택" }).click();
    await page.waitForTimeout(500);
    await shot("04-레벨선택");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  },
  ballistics: async (page, shot) => {
    await page.getByRole("button", { name: "발사 (Space)" }).click();
    await page.waitForTimeout(280);
    await shot("02-비행");
    await page.waitForTimeout(700);
    await shot("03-명중");
    await page.waitForTimeout(1400);
    await shot("04-결과");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "레벨 선택" }).click();
    await page.waitForTimeout(500);
    await shot("05-레벨선택");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  },
};

export const CARD_SETUP = {  zoo: async (page) => {
    await page.getByRole("button", { name: "동물 추가" }).click();
    await page.waitForTimeout(400);
  },
  molecule: async (page) => {
    await page.getByRole("button", { name: "물 (H₂O)" }).click();
    await page.getByRole("button", { name: "예시 불러오기" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "자동 배치" }).click();
    await page.waitForTimeout(1400);
  },
  shapes: async (page) => {
    await placeShapesBlocks(page, 2);
  },
  defense: async (page) => {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    await page.getByRole("button", { name: "고속" }).click();
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.42);
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "다음 웨이브" }).click();
    await page.waitForTimeout(2600);
  },
  maze: async (page) => {
    await page.evaluate(() => window.__gameApi?.loadLevel?.(4));
    await page.waitForTimeout(500);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(1400);
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(300);
  },
  robot: async (page) => {
    await page.evaluate(() => window.__gameApi?.loadLevel(3));
    await page.waitForTimeout(400);
    const positions = await page.evaluate(() => window.__gameApi?.getScreenPositions?.() ?? []);
    const goal = positions.find((entry) => entry.id === "plate-goal");
    if (goal) {
      await page.mouse.click(((goal.x + 1) / 2) * 1280, ((1 - goal.y) / 2) * 800);
    }
    await page.waitForTimeout(1650);
  },
  ballistics: async (page) => {
    await page.evaluate(() => {
      window.__gameApi?.loadLevel(4);
      window.__gameApi?.setAim({ yawDeg: 0, pitchDeg: 45, power: 11.7 });
    });
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "발사 (Space)" }).click();
    await page.waitForTimeout(620);
  },
};
