import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import sharp from "sharp";

// Written for checking by eye; set CONTACT_SHEET to put it somewhere else.
export const CONTACT_SHEET =
  process.env.CONTACT_SHEET ?? join(tmpdir(), "creatives.jpg");

export type Tile = { preview: Buffer; caption: string[] };

const TILE = { w: 270, h: 480 };
const CAPTION_H = 54;
const GAP = 6;

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function captionSvg(lines: string[]) {
  const text = lines
    .map(
      (line, i) =>
        `<text x="6" y="${16 + i * 15}" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#222">${escape(line)}</text>`,
    )
    .join("");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE.w}" height="${CAPTION_H}"><rect width="100%" height="100%" fill="#f2f2f2"/>${text}</svg>`,
  );
}

// One row of tiles per golden row, each with its caption (the judge medians and pass or fail).
export async function writeContactSheet(rows: Tile[][]) {
  if (rows.length === 0) return;
  const rowH = TILE.h + CAPTION_H + GAP;
  const width =
    Math.max(...rows.map((row) => row.length)) * (TILE.w + GAP) + GAP;
  const height = rows.length * rowH + GAP;
  const layers = rows.flatMap((row, r) =>
    row.flatMap((tile, c) => {
      const left = GAP + c * (TILE.w + GAP);
      const top = GAP + r * rowH;
      return [
        sharp(tile.preview)
          .resize(TILE.w, TILE.h)
          .toBuffer()
          .then((input) => ({ input, left, top })),
        Promise.resolve({
          input: captionSvg(tile.caption),
          left,
          top: top + TILE.h,
        }),
      ];
    }),
  );
  mkdirSync(dirname(CONTACT_SHEET), { recursive: true });
  writeFileSync(
    CONTACT_SHEET,
    await sharp({
      create: { width, height, channels: 3, background: "#ffffff" },
    })
      .composite(await Promise.all(layers))
      .jpeg({ quality: 88 })
      .toBuffer(),
  );
  console.log(`contact sheet: ${CONTACT_SHEET}`);
}
