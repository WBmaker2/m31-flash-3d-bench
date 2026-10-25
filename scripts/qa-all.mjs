import { spawn } from "node:child_process";
import { GAME_IDS } from "./games.mjs";

function run(target) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/shot.mjs", target], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${target} 검사가 종료 코드 ${code} 로 실패했습니다.`));
    });
  });
}

for (const target of [...GAME_IDS, "landing"]) {
  console.log(`\n=== ${target} ===`);
  await run(target);
}
