import type { FollowResult, Http, HttpGetOptions } from "./types";

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// http.get checks every URL it is given, so each hop is re-validated.
export async function getFollowingRedirects(
  http: Http,
  url: string,
  options?: HttpGetOptions,
): Promise<FollowResult> {
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const result = await http.get(current, options);
    if (!result.ok) return result;

    const { response } = result;
    if (!REDIRECT_STATUSES.has(response.status) || !response.location) {
      return { ok: true, finalUrl: current, response };
    }
    current = response.location;
  }
  return { ok: false, reason: "too_many_redirects" };
}
