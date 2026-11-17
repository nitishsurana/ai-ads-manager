import type { MessageCode } from "@/lib/messages";

export const HEADLINE_WORDS = 6;
export const HEADLINE_CHARS = 75;
export const CTA_WORDS = 3;
export const COPY_WORDS = 8;

export const wordCount = (text: string) =>
  text.split(/\s+/).filter(Boolean).length;

export const squash = (text: string) => text.replace(/\s+/g, " ").trim();

// The first limit an edit breaks, as a message code. Shared by the edit panel and the server, so both say the same thing.
export function editProblem(edit: {
  headline: string;
  cta: string;
  eyebrow: string | null;
}): MessageCode | null {
  const headline = wordCount(edit.headline);
  if (headline === 0) return "edit_headline_empty";
  if (headline > HEADLINE_WORDS) return "edit_headline_words";
  if (edit.headline.length > HEADLINE_CHARS) return "edit_headline_chars";
  if (headline + (edit.eyebrow ? wordCount(edit.eyebrow) : 0) > COPY_WORDS) {
    return "edit_combined_words";
  }
  const cta = wordCount(edit.cta);
  if (cta === 0) return "edit_cta_empty";
  if (cta > CTA_WORDS) return "edit_cta_words";
  return null;
}
