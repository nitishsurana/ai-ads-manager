import sharp from "sharp";
import type { Candidate, RoundContext } from "../types";
import type { StageDeps } from "./types";

const COLOURS = [
  "#e11d48",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
];

// STUB (6a): the Satori text layer and the real preview JPEG replace this in 6c. Each candidate gets a flat 9:16 placeholder under the round's prefix.
export async function composite(
  input: RoundContext,
  candidates: Candidate[],
  deps: StageDeps,
): Promise<Candidate[]> {
  const composed: Candidate[] = [];
  for (const candidate of candidates) {
    const bytes = await sharp({
      create: {
        width: 270,
        height: 480,
        channels: 3,
        background: COLOURS[candidate.index % COLOURS.length] ?? "#e11d48",
      },
    })
      .jpeg()
      .toBuffer();
    const path = `${input.roundId}/c${candidate.index}.jpg`;
    await deps.storage.put("previews", path, bytes, "image/jpeg");
    composed.push({ ...candidate, previewPath: path });
    await deps.progress({
      kind: "stage",
      stage: "compositing",
      done: composed.length,
      total: candidates.length,
    });
  }
  return composed;
}
