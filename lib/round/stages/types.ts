import type { BriefContent } from "@/lib/brief/schema";
import type { Ai } from "@/lib/providers/ai";
import type { Fal } from "@/lib/providers/fal";
import type { Http } from "@/lib/providers/http";
import type { Storage } from "@/lib/providers/storage";
import type { Box } from "@/lib/render";
import type { Fault } from "../fake";
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
  // The product's box as fractions (0 to 1) of the work image; null until the photo is first cut out.
  productBbox: Box | null;
};

// The round's photos, already scoped to its workspace and owner.
export type RoundPhotos = {
  get(photoId: string): Promise<StoredPhoto>;
  setCutout(
    photoId: string,
    cutout: { cutoutPath?: string; maskPath?: string; productBbox: Box },
  ): Promise<void>;
};

// The swappable services of a stage. Only the no_pass fault is left here, read by the stub checks until 6d; slow and fail live in the fake Fal.
export type StageDeps = {
  ai: Ai;
  fal: Fal;
  http: Http;
  storage: Storage;
  photos: RoundPhotos;
  // The brief version the round works from.
  brief: () => Promise<BriefContent>;
  progress: (event: ProgressEvent) => Promise<void>;
  fault: Fault | null;
};
