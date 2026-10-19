import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const FONT_DIR = path.join(ROOT, "vendor", "fonts");
const CSS_FILE = path.join(FONT_DIR, "fonts.css");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const FAMILIES = [
  { name: "IBM Plex Mono", query: "IBM+Plex+Mono:wght@400;500;600" },
  { name: "Nanum Gothic Coding", query: "Nanum+Gothic+Coding:wght@400;700" },
];

await mkdir(FONT_DIR, { recursive: true });

const blocks = [];

for (const family of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${family.query}&display=swap`;
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) {
    console.error(`폰트 CSS 요청 실패 (${family.name}): ${response.status}`);
    process.exit(1);
  }
  const css = await response.text();

  const pieces = css.split("@font-face").slice(1);
  let index = 0;
  for (const piece of pieces) {
    const weight = piece.match(/font-weight:\s*(\d+)/)?.[1] ?? "400";
    const unicodeRange = piece.match(/unicode-range:\s*([^;]+);/)?.[1];
    const source = piece.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!source) continue;
    index += 1;

    const chunk = source.match(/\.(\d+)\.woff2/)?.[1] ?? String(index);
    const fileName = `${family.name.toLowerCase().replace(/\s+/g, "-")}-${weight}-${chunk}.woff2`;
    const fontResponse = await fetch(source, { headers: { "User-Agent": UA } });
    if (!fontResponse.ok) {
      console.error(`폰트 파일 요청 실패 (${fileName}): ${fontResponse.status}`);
      process.exit(1);
    }
    const buffer = Buffer.from(await fontResponse.arrayBuffer());
    await writeFile(path.join(FONT_DIR, fileName), buffer);

    blocks.push(
      [
        "@font-face {",
        `  font-family: "${family.name}";`,
        "  font-style: normal;",
        `  font-weight: ${weight};`,
        "  font-display: swap;",
        `  src: url("./${fileName}") format("woff2");`,
        unicodeRange ? `  unicode-range: ${unicodeRange};` : null,
        "}",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  console.log(`${family.name}: ${index}개 서브셋`);
}

await writeFile(CSS_FILE, `${blocks.join("\n\n")}\n`);
console.log(`폰트 자체 호스팅 완료 — ${path.relative(ROOT, CSS_FILE)}`);
