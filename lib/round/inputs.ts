import { z } from "zod";
import { confirmedValues, type ConfirmState } from "@/lib/confirm";
import { campaignPatchSchema } from "@/lib/chat/campaign";
import { confirmedValuesSchema } from "@/lib/brief/schema";
import type { Fact } from "@/lib/db/queries";
import { brandKitSchema, logoSchema } from "@/lib/workspace/schemas";
import type { WorkspacePhoto, WorkspaceRow } from "@/lib/db/queries";

// Everything a round may read, copied at start. Stages never look at the live workspace.
export const roundInputsSchema = z.object({
  productTitle: z.string(),
  sourceUrl: z.string(),
  values: confirmedValuesSchema,
  brandKit: brandKitSchema,
  logo: logoSchema.nullable(),
  photoIds: z.array(z.string()),
  facts: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      kind: z.enum(["offer", "other"]),
    }),
  ),
  campaign: campaignPatchSchema,
});

export type RoundInputs = z.infer<typeof roundInputsSchema>;

export function freezeInputs(source: {
  title: string;
  workspace: WorkspaceRow;
  state: ConfirmState;
  photos: WorkspacePhoto[];
  facts: Fact[];
}): RoundInputs {
  const { workspace, state } = source;
  const selected = new Set(
    state.photos.filter((photo) => photo.selected).map((p) => p.position),
  );
  return roundInputsSchema.parse({
    productTitle: source.title,
    sourceUrl: workspace.sourceUrl,
    values: confirmedValues(state),
    brandKit: state.brandKit,
    logo: state.logo,
    photoIds: source.photos
      .filter((photo) => selected.has(photo.position))
      .map((photo) => photo.id),
    facts: source.facts
      .filter((fact) => fact.status === "confirmed")
      .map(({ id, text, kind }) => ({ id, text, kind })),
    campaign: workspace.campaign,
  });
}
