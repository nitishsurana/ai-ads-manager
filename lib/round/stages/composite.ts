import { currentVersions, loadFonts } from "@/lib/render";
import { composeCandidate, readLogo } from "../compose";
import type { Candidate, RoundContext } from "../types";
import type { StageDeps } from "./types";

async function required(
  storage: StageDeps["storage"],
  bucket: string,
  path: string,
) {
  const bytes = await storage.get(bucket, path);
  if (!bytes) throw new Error(`storage: ${bucket}/${path} is missing`);
  return bytes;
}

export async function composite(
  input: RoundContext,
  candidates: Candidate[],
  deps: StageDeps,
): Promise<Candidate[]> {
  const { inputs } = input;
  const fonts = await loadFonts(
    currentVersions([
      inputs.brandKit.fonts.heading.family,
      inputs.brandKit.fonts.body.family,
    ]),
    deps,
  );
  const logo = inputs.logo?.pngPath
    ? await readLogo(
        await required(deps.storage, "logos", inputs.logo.pngPath),
        inputs.logo,
      )
    : null;

  const composed: Candidate[] = [];
  for (const candidate of candidates) {
    if (!candidate.backgroundPath) {
      throw new Error(`candidate ${candidate.index} has no background`);
    }
    const { layout, preview } = await composeCandidate(
      candidate,
      await required(deps.storage, "backgrounds", candidate.backgroundPath),
      {
        inputs,
        fonts,
        logo,
        label: `round ${input.roundId} candidate ${candidate.index}`,
      },
    );
    const path = `${input.roundId}/c${candidate.index}.jpg`;
    await deps.storage.put("previews", path, preview, "image/jpeg");
    composed.push({ ...candidate, layout, previewPath: path });
    await deps.progress({
      kind: "stage",
      stage: "compositing",
      done: composed.length,
      total: candidates.length,
    });
  }
  return composed;
}
