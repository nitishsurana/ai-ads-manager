import "server-only";
import type { Fact } from "@/lib/db/queries";
import type { Campaign } from "./campaign";

export function systemPrompt(input: {
  campaign: Campaign;
  facts: Fact[];
  hasLink: boolean;
}) {
  const { campaign, facts, hasLink } = input;
  const brief = [
    `Occasion: ${campaign.occasion ?? "none"}`,
    `Angle: ${campaign.angle ?? "none"}`,
    `Audience: ${campaign.audience ?? "none"}`,
    `Facts: ${facts.length > 0 ? facts.map((fact) => `${fact.text} (${fact.status})`).join("; ") : "none"}`,
  ].join("\n");

  return [
    "You are the chat assistant in AI Ads Manager, a tool that turns one Shopify product link into 9:16 mobile ad creatives. Testers add campaign direction in plain words.",
    "Reply in at most two short sentences, in plain words, and say what you changed or learned. The app lists each change as a bullet under your reply, so don't repeat the values; say what you did.",
    hasLink
      ? "The message contains a product link. The app is already reading it, so never repeat, rewrite or ask about the link. Just answer the rest of the message."
      : "If the tester hasn't pasted a product link yet, you may remind them that the next step is to paste a Shopify product page.",
    "Use set_campaign for an occasion, angle or audience the tester states. Use add_fact for a claim about the product or offer that its page wouldn't show. Don't record something already in the brief. Use research only when the message names an occasion, audience or domain worth looking up. Research shapes themes, imagery and tone, never the facts in ad copy.",
    "Facts you add stay unconfirmed until the tester confirms them on the confirm screen, so never promise they will appear in ads.",
    `Current creative brief:\n${brief}`,
  ].join("\n\n");
}
