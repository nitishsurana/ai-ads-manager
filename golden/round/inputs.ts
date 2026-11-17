import { applyAnswers, initialConfirm } from "@/lib/confirm";
import type { BriefContent } from "@/lib/brief/schema";
import { freezeInputs } from "@/lib/round/inputs";
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
    ...extra,
    campaign: inputs.campaign,
    values: inputs.values,
    exemplarCreativeIds: [],
  };
}

// The inputs a round would freeze after the tester gave the CSV row's S1 answers.
export async function rowInputs(row: RowCase) {
  const script = loadExpectations()[row.row]?.confirmed;
  const dir = snapshotDirOf(row.row);
  if (!script || !dir)
    throw new Error(`${row.row}: no confirm script or snapshot`);
  const result = await replayIntake(row.row, dir);
  const parsed = parseS1(script.s1, script.deselectPositions ?? []);
  const state = applyAnswers(initialConfirm(result), parsed.answers);
  return freezeInputs({
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
      })),
    facts: row.facts,
  });
}
