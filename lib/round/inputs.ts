import { z } from "zod";
import {
  confirmedLogo,
  confirmedValues,
  type ConfirmState,
} from "@/lib/confirm";
import { campaignPatchSchema } from "@/lib/chat/campaign-schema";
import { confirmedValuesSchema } from "@/lib/brief/schema";
import { brandKitSchema, logoSchema } from "@/lib/workspace/schemas";

const frozenPhotoSchema = z.object({
  id: z.string(),
  position: z.number(),
  tier: z.enum(["clean", "clean_low_res", "added_text"]),
  background: z.enum(["plain", "scene"]),
  person: z.boolean(),
});

export type FrozenPhoto = z.infer<typeof frozenPhotoSchema>;

// Everything a round may read, copied at start. Stages never look at the live workspace.
export const roundInputsSchema = z.object({
  productTitle: z.string(),
  sourceUrl: z.string(),
  values: confirmedValuesSchema,
  brandKit: brandKitSchema,
  logo: logoSchema.nullable(),
  photos: z.array(frozenPhotoSchema),
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
  sourceUrl: string;
  campaign: RoundInputs["campaign"];
  state: ConfirmState;
  photos: FrozenPhoto[];
  facts: RoundInputs["facts"];
}): RoundInputs {
  const { state } = source;
  const selected = new Set(
    state.photos.filter((photo) => photo.selected).map((p) => p.position),
  );
  return roundInputsSchema.parse({
    productTitle: source.title,
    sourceUrl: source.sourceUrl,
    values: confirmedValues(state),
    brandKit: state.brandKit,
    logo: confirmedLogo(state),
    photos: source.photos.filter((photo) => selected.has(photo.position)),
    facts: source.facts,
    campaign: source.campaign,
  });
}
