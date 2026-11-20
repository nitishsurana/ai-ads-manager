import { applyAnswers, initialConfirm } from "@/lib/confirm";
import { DEFAULT_SETTINGS, type BriefContent } from "@/lib/brief/schema";
import type { Storage } from "@/lib/providers/storage";
import { freezeInputs } from "@/lib/round/inputs";
import type { StoredPhoto } from "@/lib/round/stages";
import { loadExpectations } from "../expectations";
import { replayIntake, snapshotDirOf } from "../replay";
import { parseS1 } from "../s1-answers";
import type { RowCase } from "./rows";

export function briefOf(
  inputs: ReturnType<typeof freezeInputs>,
  extra: RowCase["brief"] = {},
): BriefContent {
  return {
    rules: [],
    research: [],
    approvedAngles: [],
    settings: DEFAULT_SETTINGS,
    notApplied: [],
    ...extra,
    campaign: inputs.campaign,
    values: inputs.values,
    exemplarCreativeIds: [],
  };
}

// The inputs a round would freeze after the tester gave the CSV row's S1 answers, and the row's kept photos as the round's stages see them (their files are in `storage`, when given).
export async function rowRound(row: RowCase, storage?: Storage) {
  const script = loadExpectations()[row.row]?.confirmed;
  const dir = snapshotDirOf(row.row);
  if (!script || !dir)
    throw new Error(`${row.row}: no confirm script or snapshot`);
  const result = await replayIntake(row.row, dir, storage);
  const parsed = parseS1(script.s1, script.deselectPositions ?? []);
  const state = applyAnswers(initialConfirm(result), parsed.answers);
  const inputs = freezeInputs({
    title: result.product.title,
    sourceUrl: result.finalUrl,
    campaign: row.campaign,
    state,
    photos: result.photos.photos
      .filter((photo) => !photo.dropped)
      .map((photo) => ({
        id: String(photo.position),
        position: photo.position,
        tier: photo.tier,
        background: photo.checks.background,
        person: photo.checks.person,
        giftSet: photo.checks.gift_set,
        backdropUniform: photo.checks.backdrop_uniform ?? null,
      })),
    facts: row.facts,
  });
  const stored: StoredPhoto[] = result.photos.photos
    .filter((photo) => !photo.dropped)
    .map((photo) => ({
      id: String(photo.position),
      sha256: photo.sha256,
      workPath: photo.workPath,
      maskPath: photo.maskPath,
      backdropPath: null,
      maskChoice: null,
      productBbox: null,
    }));
  return { inputs, photos: stored };
}

export const rowInputs = async (row: RowCase) => (await rowRound(row)).inputs;
