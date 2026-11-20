import type { RoundPhotos, StoredPhoto } from "@/lib/round/stages";

// The round's photos held in memory, for the runners: the same contract as the database-backed ones.
export function memoryPhotos(photos: StoredPhoto[]): RoundPhotos {
  const byId = new Map(photos.map((photo) => [photo.id, { ...photo }]));
  return {
    async get(photoId) {
      const photo = byId.get(photoId);
      if (!photo) throw new Error(`golden: photo ${photoId} is not there`);
      return photo;
    },
    async setCutout(photoId, cutout) {
      const photo = byId.get(photoId);
      if (!photo) throw new Error(`golden: photo ${photoId} is not there`);
      byId.set(photoId, {
        ...photo,
        maskPath: cutout.maskPath ?? photo.maskPath,
        backdropPath: cutout.backdropPath ?? photo.backdropPath,
        maskChoice: cutout.maskChoice ?? photo.maskChoice,
        productBbox: cutout.productBbox ?? photo.productBbox,
      });
    },
  };
}
