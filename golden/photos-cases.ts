import sharp from "sharp";
import { runPhotos, photosFailure } from "@/lib/intake/photos";
import type { Photo, PhotosDeps, PhotosResult } from "@/lib/intake/photos";
import {
  IntakeAbandonedError,
  isAbandoned,
} from "@/lib/intake/workflow/errors";
import type { Storage } from "@/lib/providers/storage";
import { same, type Case } from "./round/cases";

type Skips = PhotosResult["skipped"][number]["reason"][];

const result = (photos: Pick<Photo, "selected">[], skips: Skips) =>
  ({
    photos,
    duplicates: [],
    skipped: skips.map((reason, i) => ({ position: i + 1, reason })),
    costs: [],
  }) as unknown as PhotosResult;

const SELECTED = { selected: true };
const DROPPED = { selected: false };

const FAILURES: [string, PhotosResult, string | null][] = [
  ["a selected photo", result([SELECTED], ["check_failed"]), null],
  ["only failed checks", result([], ["check_failed"]), "photo_check_down"],
  [
    "failed checks and a failed fetch",
    result([], ["check_failed", "fetch_failed"]),
    "photos_unreadable",
  ],
  [
    "failed checks and a processing failure",
    result([], ["check_failed", "processing_failed"]),
    "photos_unreadable",
  ],
  [
    "only gone and unreadable photos",
    result([], ["unavailable", "unreadable"]),
    "photos_unreadable",
  ],
  ["no photos at all", result([], []), "photos_unreadable"],
  [
    "processed photos with a failed check",
    result([DROPPED], ["check_failed"]),
    "photos_unreadable",
  ],
  ["all dropped", result([DROPPED], []), "no_photos"],
  [
    "all dropped, the rest gone",
    result([DROPPED], ["unavailable", "unreadable"]),
    "no_photos",
  ],
];

const png = (colour: string) =>
  sharp({
    create: { width: 400, height: 400, channels: 3, background: colour },
  })
    .png()
    .toBuffer();

async function stubDeps(failPut: (path: string) => Error | null) {
  const bytes = new Map<string, Buffer>(
    await Promise.all(
      ["#aa3333", "#33aa33", "#3333aa"].map(
        async (colour, i) =>
          [`https://img.test/${i + 1}.png`, await png(colour)] as const,
      ),
    ),
  );
  const stored = new Set<string>();
  const storage: Storage = {
    async put(bucket, path) {
      const error = failPut(path);
      if (error) throw error;
      stored.add(`${bucket}/${path}`);
    },
    async get() {
      return null;
    },
    async remove(bucket, paths) {
      for (const path of paths) stored.delete(`${bucket}/${path}`);
    },
    async removePrefix() {},
  };
  const deps: PhotosDeps = {
    http: {
      async get(url) {
        const body = bytes.get(url);
        return {
          ok: true,
          response: {
            status: body ? 200 : 404,
            headers: {},
            location: null,
            body: body ?? Buffer.alloc(0),
            truncated: false,
          },
        };
      },
    },
    ai: {
      async generate(request) {
        return {
          object: request.schema.parse({
            added_text: false,
            background: "plain",
            person: false,
            transparent: false,
            gift_set: false,
            has_product: true,
            product_count: 1,
            text_overlaps_product: false,
            product_cropped_by_frame: false,
            confidence: "high",
          }),
          costUsd: 0,
        };
      },
    },
    fal: {
      async backgroundMask() {
        throw new Error("no mask expected");
      },
    },
    storage,
    progress: () => {},
  };
  return { deps, stored, images: [...bytes.keys()].map((src) => ({ src })) };
}

export const PHOTOS_CASES: Case[] = [
  ...FAILURES.map(([name, input, code]): Case => ({
    name: `photosFailure: ${name}`,
    run: () => same(photosFailure(input), code),
  })),
  {
    name: "runPhotos: a failed storage write skips that photo and removes its files",
    run: async () => {
      const { deps, stored, images } = await stubDeps((path) =>
        path === "t/2-thumb.jpg" ? new Error("storage down") : null,
      );
      const run = await runPhotos({ intakeId: "t", images }, deps);
      return same(
        {
          selected: run.photos.map((p) => p.position),
          skipped: run.skipped,
          stored: [...stored].sort(),
        },
        {
          selected: [1, 3],
          skipped: [{ position: 2, reason: "processing_failed" }],
          stored: [
            "photos/t/1-thumb.jpg",
            "photos/t/1-work.jpg",
            "photos/t/3-thumb.jpg",
            "photos/t/3-work.jpg",
          ],
        },
      );
    },
  },
  {
    name: "runPhotos: an abandoned intake during a write stops the stage",
    run: async () => {
      const { deps, images } = await stubDeps(
        () => new IntakeAbandonedError("t"),
      );
      const error = await runPhotos({ intakeId: "t", images }, deps).then(
        () => null,
        (thrown: unknown) => thrown,
      );
      return same(isAbandoned(error), true);
    },
  },
];
