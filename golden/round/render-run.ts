import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { createAi } from "@/lib/providers/ai";
import { createFal } from "@/lib/providers/fal";
import { createFontReplayHttp, FONT_FIXTURES } from "@/lib/providers/http";
import { createLocalStorage } from "@/lib/providers/storage";
import { renderProblems, type Rendered } from "./assert-render";
import { briefOf, rowRound } from "./inputs";
import { LAYOUT_CASES } from "./layout-cases";
import { memoryPhotos } from "./photos";
import {
  BASE_INPUTS,
  colourLogo,
  darkLogo,
  renderFixture,
  SPECS,
} from "./render-cases";
import { ROW_CASES } from "./rows";
import { runRender, runStages } from "./run";

// Written for checking by eye; set CONTACT_SHEET to put it somewhere else.
export const CONTACT_SHEET =
  process.env.CONTACT_SHEET ?? join(tmpdir(), "creatives-6c.jpg");

type Report = (name: string, problems: string[]) => void;

export function layoutCases(report: Report) {
  for (const { name, run } of LAYOUT_CASES) {
    const problem = run();
    report(`layout: ${name}`, problem ? [problem] : []);
  }
}

const LOGO_FIXTURE = {
  source: "header" as const,
  pngPath: "fx/logo.png",
  width: 260,
  height: 90,
  sourceUrl: null,
  text: null,
  textRead: null,
  colourClass: "one_colour" as const,
  colours: ["#222222"],
  transparent: true,
  headerBackground: "#ffffff",
  iconOnly: false,
  storeBrand: true,
};

async function allProblems(inputs: typeof BASE_INPUTS, rendered: Rendered[]) {
  return (
    await Promise.all(rendered.map((one) => renderProblems(inputs, one)))
  ).flat();
}

export async function fixtureRenders(report: Report) {
  const cases = [
    {
      name: "render: no logo, six variations",
      inputs: BASE_INPUTS,
      logo: null,
    },
    {
      name: "render: one-colour logo",
      inputs: { ...BASE_INPUTS, logo: LOGO_FIXTURE },
      logo: await darkLogo(),
    },
    {
      name: "render: multi-colour logo",
      inputs: {
        ...BASE_INPUTS,
        logo: {
          ...LOGO_FIXTURE,
          colourClass: "multi_colour" as const,
          colours: ["#ed288c", "#00afae"],
        },
      },
      logo: await colourLogo(),
    },
    {
      name: "render: wordmark, INR price",
      inputs: {
        ...BASE_INPUTS,
        values: {
          ...BASE_INPUTS.values,
          price: "1,299",
          wasPrice: null,
          currency: "INR",
        },
        logo: {
          ...LOGO_FIXTURE,
          source: "wordmark" as const,
          pngPath: null,
          text: "Acme Home",
        },
      },
      logo: null,
    },
  ];
  for (const { name, inputs, logo } of cases) {
    try {
      const rendered = await renderFixture(name, inputs, SPECS, logo);
      report(name, await allProblems(inputs, rendered));
    } catch (error) {
      report(name, [
        `threw: ${error instanceof Error ? error.message : error}`,
      ]);
    }
  }
}

// Recorded rows: plan and copy replay from ai.json, backgrounds from the round's fal.json, fonts from the committed files.
export async function rowRenders(report: Report) {
  const previews: Buffer[][] = [];
  for (const row of ROW_CASES) {
    const dir = join(".golden", row.row, "round");
    const name = `render: ${row.row}`;
    if (!existsSync(join(dir, "fal.json"))) {
      console.log(`SKIP ${name} (no background recording)`);
      continue;
    }
    const storageDir = mkdtempSync(join(tmpdir(), "golden-render-"));
    try {
      const storage = createLocalStorage(storageDir);
      const { inputs, photos } = await rowRound(row, storage);
      const { copied } = await runStages(
        row.row,
        inputs,
        briefOf(inputs, row.brief),
        createAi({ snapshotDir: dir }),
      );
      const composed = await runRender(row.row, inputs, copied, {
        fal: createFal({
          http: { get: async () => ({ ok: false, reason: "blocked" }) },
          snapshotDir: [dir, join(".golden", row.row)],
        }),
        http: createFontReplayHttp(FONT_FIXTURES),
        storage,
        photos: memoryPhotos(photos),
      });
      const rendered: Rendered[] = await Promise.all(
        composed.map(async (candidate) => ({
          candidate,
          preview:
            (await storage.get("previews", candidate.previewPath ?? "")) ??
            Buffer.alloc(0),
          background:
            (await storage.get(
              "backgrounds",
              candidate.backgroundPath ?? "",
            )) ?? Buffer.alloc(0),
        })),
      );
      report(name, await allProblems(inputs, rendered));
      previews.push(rendered.map((one) => one.preview));
    } catch (error) {
      report(name, [
        `threw: ${error instanceof Error ? error.message : error}`,
      ]);
    } finally {
      rmSync(storageDir, { recursive: true, force: true });
    }
  }
  return previews;
}

// One row of previews per recorded row, for checking by eye.
export async function writeContactSheet(rows: Buffer[][]) {
  if (rows.length === 0) return;
  const tile = { w: 270, h: 480 };
  const width = Math.max(...rows.map((row) => row.length)) * (tile.w + 6) + 6;
  const height = rows.length * (tile.h + 6) + 6;
  const tiles = rows.flatMap((row, r) =>
    row.map(async (preview, c) => ({
      input: await sharp(preview).resize(tile.w, tile.h).toBuffer(),
      left: 6 + c * (tile.w + 6),
      top: 6 + r * (tile.h + 6),
    })),
  );
  mkdirSync(dirname(CONTACT_SHEET), { recursive: true });
  writeFileSync(
    CONTACT_SHEET,
    await sharp({
      create: { width, height, channels: 3, background: "#ffffff" },
    })
      .composite(await Promise.all(tiles))
      .jpeg({ quality: 88 })
      .toBuffer(),
  );
  console.log(`contact sheet: ${CONTACT_SHEET}`);
}
