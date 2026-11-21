import "server-only";
import { createSecretClient } from "@/lib/db/secret";
import { messages } from "@/lib/messages";
import { readIntake } from "../workflow";
import { progressSchema } from "../workflow/types";
import type { ReadingStatus } from "./schema";

const THUMB_URL_TTL_S = 10 * 60;

async function signThumbs(
  intakeId: string,
  thumbs: { position: number; thumbPath: string }[],
) {
  const own = thumbs.filter((thumb) =>
    thumb.thumbPath.startsWith(`${intakeId}/`),
  );
  if (own.length === 0) return [];
  const { data, error } = await createSecretClient()
    .storage.from("photos")
    .createSignedUrls(
      own.map((thumb) => thumb.thumbPath),
      THUMB_URL_TTL_S,
    );
  if (error) {
    console.error(`intake ${intakeId}: signing thumbnails failed`, error);
    return [];
  }
  return own.flatMap((thumb) => {
    const url = data.find(
      (signed) => signed.path === thumb.thumbPath,
    )?.signedUrl;
    return url ? [{ position: thumb.position, url }] : [];
  });
}

// The stuck rule applies here through readIntake. Thumbnails are signed only while reading: a failed intake's files are gone, and a done one has left the screen.
export async function getReadingStatus(
  userId: string,
  intakeId: string,
): Promise<ReadingStatus | null> {
  const intake = await readIntake(userId, intakeId);
  if (!intake) return null;

  const progress = progressSchema.safeParse(intake.progress).data;
  return {
    status: intake.status,
    url: intake.url,
    stage: progress?.stage ?? "product",
    phase: progress?.phase ?? null,
    done: progress?.done ?? null,
    total: progress?.total ?? null,
    product: progress?.product ?? null,
    failure: intake.failureCode
      ? { code: intake.failureCode, message: messages[intake.failureCode] }
      : null,
    canRetry: intake.canRetry,
    workspaceId: intake.workspaceId,
    photos:
      intake.status === "reading" && progress
        ? await signThumbs(intakeId, progress.photos)
        : [],
  };
}
