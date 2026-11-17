import {
  ANGLES,
  type Angle,
  type Candidate,
  type RoundContext,
  type SupportingElement,
} from "../types";
import type { StageDeps } from "./types";

const CANDIDATES = 6;

// STUB (6a): Opus art direction replaces this in 6b. It cycles the usable angles and the selected photos.
function usableAngles({ inputs }: RoundContext): Angle[] {
  const { values, facts } = inputs;
  return ANGLES.filter((angle) => {
    if (angle === "social_proof") return values.rating !== null;
    if (angle === "price") return values.price !== null;
    if (angle === "offer") return facts.some((fact) => fact.kind === "offer");
    return true;
  });
}

function supportingElement(angle: Angle): SupportingElement | null {
  if (angle === "price") return "price";
  if (angle === "social_proof") return "rating";
  if (angle === "offer") return "offer";
  return null;
}

export async function planCandidates(
  input: RoundContext,
  deps: StageDeps,
): Promise<Candidate[]> {
  const angles = usableAngles(input);
  const { photoIds } = input.inputs;
  if (photoIds.length === 0) throw new Error("round has no selected photos");
  const candidates = Array.from({ length: CANDIDATES }, (_, index) => {
    const angle = angles[index % angles.length] ?? "benefit";
    return {
      index,
      angle,
      photoId: photoIds[index % photoIds.length] ?? "",
      supportingElement: supportingElement(angle),
      background: { method: "stub" as const },
      copy: null,
      backgroundPath: null,
      previewPath: null,
    };
  });
  await deps.progress({ kind: "planned", candidates });
  return candidates;
}
