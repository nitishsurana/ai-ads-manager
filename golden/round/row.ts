import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { Ai } from "@/lib/providers/ai";
import type { Fal } from "@/lib/providers/fal";
import { createFontReplayHttp, FONT_FIXTURES } from "@/lib/providers/http";
import { createLocalStorage } from "@/lib/providers/storage";
import { checkCandidate } from "@/lib/round/checks";
import { createReadBack } from "@/lib/round/checks/readback";
import { createBuilder } from "@/lib/round/stages";
import type { Candidate } from "@/lib/round/types";
import type { Tile } from "./contact-sheet";
import { loadExpectations } from "../expectations";
import { briefOf, rowRound } from "./inputs";
import { memoryPhotos } from "./photos";
import { barProblems } from "./pass-bar";
import type { RowCase } from "./rows";
import { roundContext, runRound } from "./run";

// What a live run saved beside the row's recordings, so replay can check the time bar and the report can show cost.
export const liveSchema = z.object({
  elapsedMs: z.number(),
  planMs: z.number(),
  copyMs: z.number(),
  modelsUsd: z.number(),
  falEdits: z.number(),
  falMasks: z.number(),
});
export type Live = z.infer<typeof liveSchema>;

const MEDIAN_KEYS = [
  "message",
  "hierarchy",
  "product",
  "brand_fit",
  "slop",
] as const;

function caption(candidate: Candidate, n: number) {
  const { judge } = candidate;
  const medians = judge
    ? MEDIAN_KEYS.map((key) => judge.medians[key]).join("/")
    : "no judge";
  return [
    `c${n} ${candidate.angle} · ${candidate.supportingElement ?? "no badge"}`,
    `${medians}  mean ${judge?.mean.toFixed(1) ?? "-"}`,
    `${judge?.pass ? "PASS" : "FAIL"}${judge?.lowConfidence ? " · low confidence" : ""} · rank ${judge?.rank ?? "-"}`,
  ];
}

const expectedLogo = (row: RowCase) => {
  const confirm = loadExpectations()[row.row]?.confirmed?.confirm;
  if (!confirm) throw new Error(`${row.row}: no confirm expectation`);
  return { source: confirm.logoSource, name: confirm.brandName ?? null };
};

// One golden row's whole round with the services given (recorded or live), checked against the pass bar.
export async function runRow(
  row: RowCase,
  services: { ai: Ai; fal: Fal },
  reportedMs: number | null = null,
) {
  const dir = mkdtempSync(join(tmpdir(), "golden-row-"));
  try {
    const storage = createLocalStorage(dir);
    const { inputs, photos } = await rowRound(row, storage);
    const deps = {
      ...services,
      readBack: createReadBack(services),
      http: createFontReplayHttp(FONT_FIXTURES),
      storage,
      photos: memoryPhotos(photos),
    };
    const result = await runRound(
      row.row,
      inputs,
      briefOf(inputs, row.brief),
      deps,
    );

    const read = (bucket: string) =>
      Promise.all(
        result.shown.map(
          async (c) =>
            (await storage.get(bucket, `${row.row}/c${c.index}.jpg`)) ??
            Buffer.alloc(0),
        ),
      );
    const [previews, backgrounds] = await Promise.all([
      read("previews"),
      read("backgrounds"),
    ]);

    const ctx = roundContext(row.row, inputs);
    const builder = createBuilder(ctx, deps);
    const { fonts, logo } = await builder.assets();
    const problems = await barProblems({
      inputs,
      shown: result.shown,
      previews,
      backgrounds,
      elapsedMs: reportedMs ?? result.elapsedMs,
      logo: expectedLogo(row),
      recheck: (candidate) =>
        checkCandidate(candidate, {
          input: ctx,
          fonts,
          logo,
          deps,
          prepared: builder.prepared,
        }),
    });
    const tiles: Tile[] = result.shown.map((candidate, i) => ({
      preview: previews[i] ?? Buffer.alloc(0),
      caption: caption(candidate, i + 1),
    }));
    return { ...result, inputs, problems, tiles };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
