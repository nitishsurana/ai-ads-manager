import { getFollowingRedirects } from "@/lib/providers/http";
import type { PhotosDeps, SkipReason } from "./types";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 30_000;
const GONE_STATUSES = new Set([404, 410]);

export async function fetchOriginal(
  url: string,
  deps: Pick<PhotosDeps, "http">,
): Promise<
  { ok: true; bytes: Buffer } | { ok: false; reason: SkipReason; cause: string }
> {
  const fetched = await getFollowingRedirects(deps.http, url, {
    maxBytes: MAX_IMAGE_BYTES,
    timeoutMs: IMAGE_TIMEOUT_MS,
  });
  if (!fetched.ok) {
    return { ok: false, reason: "fetch_failed", cause: fetched.reason };
  }
  const { status, truncated, body } = fetched.response;
  if (GONE_STATUSES.has(status)) {
    return { ok: false, reason: "unavailable", cause: `HTTP ${status}` };
  }
  if (status !== 200) {
    return { ok: false, reason: "fetch_failed", cause: `HTTP ${status}` };
  }
  if (truncated) {
    return {
      ok: false,
      reason: "unavailable",
      cause: `over the ${MAX_IMAGE_BYTES} byte cap`,
    };
  }
  return { ok: true, bytes: body };
}
