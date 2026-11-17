import "server-only";
import { createSecretClient } from "@/lib/db/secret";

const URL_TTL_S = 10 * 60;

// A path whose URL can't be signed is left out, so its image just doesn't show.
export async function signUrls(bucket: string, paths: string[]) {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const { data, error } = await createSecretClient()
    .storage.from(bucket)
    .createSignedUrls(paths, URL_TTL_S);
  if (error) {
    console.error(`workspace: signing ${bucket} urls failed`, error);
    return urls;
  }
  for (const item of data) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
