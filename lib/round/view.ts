import "server-only";
import { listRoundCreatives, type Round } from "@/lib/db/queries";
import { FONT_FAMILIES } from "@/lib/fonts";
import type { Layout } from "@/lib/render";
import { signUrls } from "@/lib/workspace/urls";
import { campaignText } from "./campaign-line";
import { parseCreative } from "./creative";
import { roundInputsSchema } from "./inputs";
import type { Copy } from "./types";

export type CreativeView = {
  id: string;
  n: number;
  angle: string;
  rev: number;
  previewUrl: string | null;
  backgroundUrl: string | null;
  logoUrl: string | null;
  // Brand families of the text the overlay draws, for the browser's font stylesheet.
  families: string[];
  copy: Copy;
  layout: Layout;
  rating: "approve" | "reject" | null;
  tags: string[];
  note: string;
};

export type RoundView = {
  id: string;
  n: number;
  attempt: number;
  madeInS: number | null;
  briefVersion: number;
  campaign: string;
  creatives: CreativeView[];
};

// The round view stays open while the tester rates, so its images outlive the default.
export const VIEW_URL_TTL_S = 60 * 60;

const known = new Set(FONT_FAMILIES.map((entry) => entry.family));

// A finished round as the round view shows it, with signed URLs for the preview, the background and the logo.
export async function loadRoundView(
  userId: string,
  round: Round,
): Promise<RoundView> {
  const inputs = roundInputsSchema.parse(round.inputs);
  const rows = (await listRoundCreatives(userId, round.id)).map(parseCreative);
  const logoPath = inputs.logo?.pngPath ?? null;
  const [previews, backgrounds, logos] = await Promise.all([
    signUrls(
      "previews",
      rows.map((row) => row.previewPath),
      VIEW_URL_TTL_S,
    ),
    signUrls(
      "backgrounds",
      rows.flatMap((row) => (row.backgroundPath ? [row.backgroundPath] : [])),
      VIEW_URL_TTL_S,
    ),
    signUrls("logos", logoPath ? [logoPath] : [], VIEW_URL_TTL_S),
  ]);
  return {
    id: round.id,
    n: round.n,
    attempt: round.attempt,
    madeInS:
      round.runningAt && round.finishedAt
        ? Math.round(
            (Date.parse(round.finishedAt) - Date.parse(round.runningAt)) / 1000,
          )
        : null,
    briefVersion: round.briefVersion,
    campaign: campaignText(inputs.campaign),
    creatives: rows.map((row) => ({
      id: row.id,
      n: row.n,
      angle: row.angle,
      rev: row.rev,
      previewUrl: previews.get(row.previewPath) ?? null,
      backgroundUrl: row.backgroundPath
        ? (backgrounds.get(row.backgroundPath) ?? null)
        : null,
      logoUrl:
        row.layout.logo?.kind === "image" && logoPath
          ? (logos.get(logoPath) ?? null)
          : null,
      families: [
        ...new Set(
          [row.layout.headline, row.layout.cta].map((text) => text.font.family),
        ),
      ].filter((family) => known.has(family)),
      copy: row.copy,
      layout: row.layout,
      rating: row.rating,
      tags: row.tags,
      note: row.note ?? "",
    })),
  };
}
