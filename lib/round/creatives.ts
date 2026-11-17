import type { NewCreative } from "@/lib/db/queries";
import type { Candidate } from "./types";

function creativeRow(candidate: Candidate, n: number): NewCreative {
  if (
    !candidate.copy ||
    !candidate.layout ||
    !candidate.previewPath ||
    !candidate.judge
  ) {
    throw new Error(`candidate ${candidate.index} is not finished`);
  }
  return {
    n,
    angle: candidate.angle,
    photo_id: candidate.photoId,
    background: candidate.background,
    supporting_element: candidate.supportingElement,
    copy: candidate.copy,
    layout: candidate.layout,
    background_path: candidate.backgroundPath,
    preview_path: candidate.previewPath,
    judge: candidate.judge,
  };
}

// Built before the finishing step, so a malformed candidate fails the round instead of retrying the step.
export function creativeRows(shown: Candidate[]) {
  return shown.map((candidate, index) => creativeRow(candidate, index + 1));
}
