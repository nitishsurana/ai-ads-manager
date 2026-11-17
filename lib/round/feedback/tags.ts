export const TAGS = [
  "Copy",
  "Product",
  "Background",
  "Colour",
  "CTA",
  "Brand fit",
  "Layout",
] as const;

export type Tag = (typeof TAGS)[number];

export type Rating = "approve" | "reject";

// A reject needs a reason: a tag or a note.
export const hasReason = (tags: readonly string[], note: string) =>
  tags.length > 0 || note.trim() !== "";
