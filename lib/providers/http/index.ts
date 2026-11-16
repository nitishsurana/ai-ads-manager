import type { Dns } from "@/lib/providers/dns";
import { createReplayHttp } from "./fake";
import { createRealHttp } from "./real";
import type { Http } from "./types";

export type {
  FollowResult,
  Http,
  HttpFailure,
  HttpGetOptions,
  HttpResponse,
  HttpResult,
} from "./types";
export { getFollowingRedirects } from "./follow";
export { createRealHttp };

export function createHttp(options: { dns: Dns; snapshotDir?: string }): Http {
  if (process.env.PROVIDERS !== "fake") return createRealHttp(options);
  if (!options.snapshotDir) throw new Error("http: replay needs a snapshotDir");
  return createReplayHttp({
    snapshotDir: options.snapshotDir,
    dns: options.dns,
  });
}
