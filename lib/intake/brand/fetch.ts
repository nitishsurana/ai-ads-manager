import { getFollowingRedirects, type Http } from "@/lib/providers/http";
import { logSwallowed } from "./log";

const MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

export type Fetched = { bytes: Buffer; contentType: string | undefined };

// Every candidate URL goes through the http provider (SSRF guard, caps); a failure is logged and the next URL tried.
export async function fetchFirst(
  urls: string[],
  label: string,
  deps: { http: Http },
): Promise<Fetched | null> {
  for (const url of urls) {
    const fetched = await getFollowingRedirects(deps.http, url, {
      maxBytes: MAX_BYTES,
      timeoutMs: TIMEOUT_MS,
    });
    if (!fetched.ok) {
      logSwallowed(label, `fetch of ${url}`, fetched.reason);
      continue;
    }
    const { status, truncated, body, headers } = fetched.response;
    if (status !== 200 || truncated || body.length === 0) {
      logSwallowed(
        label,
        `fetch of ${url}`,
        `HTTP ${status}, ${body.length} bytes${truncated ? ", truncated" : ""}`,
      );
      continue;
    }
    return { bytes: body, contentType: headers["content-type"] };
  }
  return null;
}
