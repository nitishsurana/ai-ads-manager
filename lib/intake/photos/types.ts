import { z } from "zod";
import type { Fal } from "@/lib/providers/fal";
import type { Http } from "@/lib/providers/http";
import type { Ai } from "@/lib/providers/ai";
import type { Storage } from "@/lib/providers/storage";

export const photoChecksSchema = z.object({
  added_text: z.boolean(),
  background: z.enum(["plain", "scene"]),
  person: z.boolean(),
  has_product: z.boolean(),
  product_count: z.number().int().min(0),
  text_overlaps_product: z.boolean(),
  product_cropped_by_frame: z.boolean(),
  confidence: z.enum(["low", "medium", "high"]),
});

export type PhotoChecks = z.infer<typeof photoChecksSchema> & { model: string };

export type PhotoTier = "clean" | "clean_low_res" | "added_text";

export type DropReason =
  | "text_card"
  | "multiple_products"
  | "text_over_product"
  | "product_cropped"
  | "mask_not_one_shape";

export type PhotoWarning = "low_resolution" | "photo_text";

export type Photo = {
  position: number;
  sourceUrl: string;
  origWidth: number;
  origHeight: number;
  workPath: string;
  thumbPath: string;
  sha256: string;
  phash: string;
  checks: PhotoChecks;
  tier: PhotoTier;
  dropped: boolean;
  dropReason: DropReason | null;
  cutoutPath: string | null;
  maskPath: string | null;
  selected: boolean;
  warnings: PhotoWarning[];
};

// fetch_failed (any fetch failure other than gone or too big) and check_failed mean a retry may work; unavailable (gone, or over the size cap) and unreadable are the photo's own fault.
export type SkipReason =
  "fetch_failed" | "unavailable" | "unreadable" | "check_failed";

export type CostEntry = {
  provider: "ai" | "fal";
  model: string;
  usd: number | null;
  // The round's paid calls name their task.
  task?: string;
};

export type PhotosResult = {
  photos: Photo[];
  duplicates: { position: number; duplicateOf: number }[];
  skipped: { position: number; reason: SkipReason }[];
  costs: CostEntry[];
};

export type PhotosProgress = {
  stage: "photos";
  // "reading" counts originals fetched and decoded; "checking" counts unique photos finished.
  phase: "reading" | "checking";
  done: number;
  total: number;
  photo: { position: number; thumbPath: string } | null;
};

export type PhotosDeps = {
  http: Http;
  ai: Ai;
  fal: Fal;
  storage: Storage;
  progress: (event: PhotosProgress) => void | Promise<void>;
};

export type PhotosInput = {
  intakeId: string;
  images: { src: string }[];
};

// Carries the spend so far, so a failed stage can still be costed.
export class PhotosStageError extends Error {
  constructor(
    message: string,
    readonly costs: CostEntry[],
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
