import "server-only";
import { z } from "zod";
import {
  listCreativesOfRounds,
  listDoneRounds,
  type RoundCreative,
} from "@/lib/db/queries";
import { signUrls } from "@/lib/workspace/urls";
import { parseCreative, type Edit } from "./creative";
import { VIEW_URL_TTL_S } from "./view";

export const RATING_FILTERS = [
  "all",
  "approved",
  "rejected",
  "unrated",
] as const;

// An unknown or repeated `?rating=` falls back to All.
export const ratingFilterSchema = z.enum(RATING_FILTERS).catch("all");

export type RatingFilter = (typeof RATING_FILTERS)[number];

const RATING_OF = { approved: "approve", rejected: "reject" } as const;

export type LibraryCreative = {
  id: string;
  n: number;
  angle: string;
  previewUrl: string | null;
  headline: string;
  cta: string;
  rating: RoundCreative["rating"];
  tags: string[];
  note: string;
  editCount: number;
  netEdit: Pick<Edit, "from" | "to"> | null;
};

export type LibraryRound = {
  id: string;
  n: number;
  briefVersion: number;
  at: string;
  creatives: LibraryCreative[];
  allCreativeIds: string[];
};

// Every finished round of a workspace, newest first, with the creatives that match the filter (the zip always takes the whole round); rounds left with none are dropped. `hasRounds` tells an empty workspace from an empty filter.
export async function loadLibrary(
  userId: string,
  workspaceId: string,
  filter: RatingFilter,
) {
  const rounds = await listDoneRounds(userId, workspaceId);
  const all = (
    await listCreativesOfRounds(
      userId,
      rounds.map((round) => round.id),
    )
  ).map(parseCreative);
  const rows = all.filter((row) =>
    filter === "all"
      ? true
      : row.rating === (filter === "unrated" ? null : RATING_OF[filter]),
  );
  const previews = await signUrls(
    "previews",
    rows.map((row) => row.previewPath),
    VIEW_URL_TTL_S,
  );
  const library: LibraryRound[] = rounds
    .map((round) => ({
      id: round.id,
      n: round.n,
      briefVersion: round.briefVersion,
      at: round.finishedAt ?? round.startedAt,
      creatives: rows
        .filter((row) => row.roundId === round.id)
        .map((row) => ({
          id: row.id,
          n: row.n,
          angle: row.angle,
          previewUrl: previews.get(row.previewPath) ?? null,
          headline: row.copy.headline,
          cta: row.copy.cta,
          rating: row.rating,
          tags: row.tags,
          note: row.note ?? "",
          editCount: row.edits.length,
          netEdit: netEdit(row.edits),
        })),
      allCreativeIds: all
        .filter((row) => row.roundId === round.id)
        .map((row) => row.id),
    }))
    .filter((round) => round.creatives.length > 0);
  return { hasRounds: rounds.length > 0, rounds: library };
}

function netEdit(edits: Edit[]) {
  const [first] = edits;
  const last = edits.at(-1);
  return first && last ? { from: first.from, to: last.to } : null;
}
