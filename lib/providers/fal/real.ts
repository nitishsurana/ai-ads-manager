import { createFalClient } from "@fal-ai/client";
import { getFollowingRedirects, type Http } from "@/lib/providers/http";
import { EDIT_MODEL, MASK_MODEL } from "./models";
import { birefnetResponseSchema, briaResponseSchema } from "./schemas";
import type { Fal } from "./types";

const POLL_INTERVAL_MS = 1_000;
const QUEUE_TIMEOUT_MS = 90_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const dataUri = (type: string, bytes: Uint8Array) =>
  `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;

export function createRealFal({ http }: { http: Http }): Fal {
  const client = () => {
    const credentials = process.env.FAL_KEY;
    if (!credentials) throw new Error("fal: FAL_KEY is not set");
    return createFalClient({ credentials });
  };

  async function download(url: string) {
    const result = await getFollowingRedirects(http, url, {
      maxBytes: IMAGE_MAX_BYTES,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
    });
    if (!result.ok || result.response.status !== 200) {
      throw new Error(`fal: image download failed: ${url}`);
    }
    if (result.response.truncated) {
      throw new Error("fal: image download was truncated");
    }
    return result.response.body;
  }

  return {
    async backgroundMask({ image, contentType }) {
      const { data } = await client().subscribe(MASK_MODEL, {
        input: {
          image_url: dataUri(contentType, image),
          mask_only: true,
          output_format: "png",
        },
        mode: "polling",
        pollInterval: POLL_INTERVAL_MS,
        timeout: QUEUE_TIMEOUT_MS,
      });
      return download(birefnetResponseSchema.parse(data).image.url);
    },

    async backgroundEdit({ instruction, canvas, mask, seed }) {
      const { data } = await client().subscribe(EDIT_MODEL, {
        input: {
          instruction,
          image_urls: [dataUri("image/png", canvas)],
          mask_url: dataUri("image/png", mask),
          seed,
        },
        mode: "polling",
        pollInterval: POLL_INTERVAL_MS,
        timeout: QUEUE_TIMEOUT_MS,
      });
      const [first] = briaResponseSchema.parse(data).images;
      if (!first) throw new Error("fal: the edit returned no image");
      return download(first.url);
    },
  };
}
