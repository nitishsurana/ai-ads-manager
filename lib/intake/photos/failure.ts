import type { Step1FailureCode } from "@/lib/messages";
import type { PhotosResult, SkipReason } from "./types";

// Why a result with no selected photo ends the intake: none could be read, our check is down, or what was read is all unusable.
export function photosFailure({
  photos,
  skipped,
}: PhotosResult): Step1FailureCode | null {
  if (photos.some((photo) => photo.selected)) return null;
  const skippedFor = (...reasons: SkipReason[]) =>
    skipped.some((s) => reasons.includes(s.reason));
  if (
    photos.length === 0 &&
    skippedFor("check_failed") &&
    !skippedFor("fetch_failed", "processing_failed")
  ) {
    return "photo_check_down";
  }
  if (
    photos.length === 0 ||
    skippedFor("fetch_failed", "check_failed", "processing_failed")
  ) {
    return "photos_unreadable";
  }
  return "no_photos";
}
