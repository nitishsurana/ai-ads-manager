import type { BriefContent } from "@/lib/brief/schema";
import type { RoundInputs } from "@/lib/round/inputs";

export type RowCase = {
  row: string;
  campaign: RoundInputs["campaign"];
  // What the tester confirmed in chat; the CSV rows have no chat.
  facts: RoundInputs["facts"];
  brief: Partial<Pick<BriefContent, "rules" | "research" | "approvedAngles">>;
};

// Creative-producing rows between them cover price, strike-through, rating, an offer and a campaign. The confirm answers come from each row's expectations.
export const ROW_CASES: RowCase[] = [
  {
    row: "G06",
    campaign: {},
    facts: [{ id: "f1", text: "Machine washable", kind: "other" }],
    brief: {
      rules: [
        {
          id: "r1",
          kind: "dont",
          text: "Don't show people",
          source: "chat",
          locked: false,
        },
      ],
    },
  },
  {
    row: "G21",
    campaign: { occasion: "Mother's Day" },
    facts: [{ id: "f1", text: "20% off for Mother's Day", kind: "offer" }],
    brief: {
      approvedAngles: ["benefit", "social_proof"],
      research: [
        {
          topic: "Mother's Day",
          notes: [
            "Gifting season: soft, warm imagery in pinks and neutrals works.",
            "Tone is personal and appreciative rather than sale-like.",
          ],
          sources: [],
        },
      ],
    },
  },
  {
    row: "G11",
    campaign: {},
    facts: [],
    brief: { approvedAngles: ["price"] },
  },
];
