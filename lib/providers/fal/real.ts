import { createFalClient } from "@fal-ai/client";
import { getFollowingRedirects, type Http } from "@/lib/providers/http";
import { birefnetResponseSchema } from "./schemas";
import type { Fal } from "./types";

const MODEL = "fal-ai/birefnet/v2";
const POLL_INTERVAL_MS = 1_000;
const QUEUE_TIMEOUT_MS = 90_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MASK_MAX_BYTES = 10 * 1024 * 1024;

export function createRealFal({ http }: { http: Http }): Fal {
  return {
    async backgroundMask({ image, contentType }) {
      const credentials = process.env.FAL_KEY;
      if (!credentials) throw new Error("fal: FAL_KEY is not set");
      const client = createFalClient({ credentials });

      const dataUri = `data:${contentType};base64,${Buffer.from(image).toString("base64")}`;
      const { data } = await client.subscribe(MODEL, {
        input: { image_url: dataUri, mask_only: true, output_format: "png" },
        mode: "polling",
        pollInterval: POLL_INTERVAL_MS,
        timeout: QUEUE_TIMEOUT_MS,
      });

      const { image: mask } = birefnetResponseSchema.parse(data);
      const download = await getFollowingRedirects(http, mask.url, {
        maxBytes: MASK_MAX_BYTES,
        timeoutMs: DOWNLOAD_TIMEOUT_MS,
      });
      if (!download.ok || download.response.status !== 200) {
        throw new Error(`fal: mask download failed: ${mask.url}`);
      }
      if (download.response.truncated) {
        throw new Error("fal: mask download was truncated");
      }
      return download.response.body;
    },
  };
}
