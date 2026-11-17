import { z } from "zod";
import { campaignPatchSchema, type Campaign } from "@/lib/chat/campaign-schema";

// "Diwali · Gifting · Young professionals".
export const campaignText = (campaign: Campaign) =>
  [campaign.occasion, campaign.angle, campaign.audience]
    .filter(Boolean)
    .join(" · ");

// The campaign a round was frozen with; rounds with no readable inputs have none.
export function campaignLine(inputs: unknown) {
  const { campaign } =
    z.object({ campaign: campaignPatchSchema }).safeParse(inputs).data ?? {};
  return campaign ? campaignText(campaign) : "";
}
