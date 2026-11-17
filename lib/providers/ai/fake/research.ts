import type { Researcher } from "../types";

export function createFakeResearcher(): Researcher {
  return {
    async research(topic) {
      return {
        notes: [
          `${topic} is a gifting season; warm, festive imagery works.`,
          "Keep the tone calm and personal rather than sale-like.",
        ],
        sources: [
          { label: "example.com", href: "https://example.com/gifting" },
        ],
        costs: [],
      };
    },
  };
}
