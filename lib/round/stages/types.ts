import type { BriefContent } from "@/lib/brief/schema";
import type { Ai } from "@/lib/providers/ai";
import type { Fal } from "@/lib/providers/fal";
import type { ReadBack } from "../checks/readback";
import type { Http } from "@/lib/providers/http";
import type { Storage } from "@/lib/providers/storage";
import type { Box } from "@/lib/render";
import type { Candidate, Stage } from "../types";

export type ProgressEvent =
  | { kind: "planned"; candidates: Candidate[] }
  | { kind: "stage"; stage: Stage; done: number; total: number };

// A photo as the round's stages need it. Paths are relative to the photos and cutouts buckets.
export type StoredPhoto = {
  id: string;
  // Of the original photo, which keys replayed Fal masks.
  sha256: string;
  workPath: string;
  maskPath: string | null;
  // The cached backdrop mask and which mask the recipe chose; null until a cut-out first needs them.
  backdropPath: string | null;
  maskChoice: string | null;
  // The product's box as fractions (0 to 1) of the work image; null until the photo is first cut out.
  productBbox: Box | null;
};

// The round's photos, already scoped to its workspace and owner.
export type RoundPhotos = {
  get(photoId: string): Promise<StoredPhoto>;
  setCutout(
    photoId: string,
    cutout: {
      cutoutPath?: string;
      maskPath?: string;
      backdropPath?: string;
      maskChoice?: string;
      productBbox?: Box;
    },
  ): Promise<void>;
};

// The swappable services of a stage. Faults live in the fakes (slow and fail in Fal, the judge's scores in the scripted ai, the fake read-back in `readBack`).
export type StageDeps = {
  ai: Ai;
  fal: Fal;
  http: Http;
  storage: Storage;
  photos: RoundPhotos;
  // The brief version the round works from.
  brief: () => Promise<BriefContent>;
  progress: (event: ProgressEvent) => Promise<void>;
  readBack: ReadBack;
  // The last moment (epoch milliseconds) a regeneration may start, so the checks and the judge panel still fit before the round's deadline.
  regenerateUntil: number;
};
