import type { Dns } from "@/lib/providers/dns";
import {
  httpSnapshotSchema,
  readSnapshotBody,
  readSnapshotJson,
  SnapshotError,
} from "@/lib/providers/snapshot";
import { resolvePublic } from "../guard";
import type { Http } from "../types";

export function createReplayHttp({
  snapshotDir,
  dns,
}: {
  snapshotDir: string;
  dns: Dns;
}): Http {
  const snapshot = readSnapshotJson(
    snapshotDir,
    "http.json",
    httpSnapshotSchema,
  );

  return {
    async get(rawUrl) {
      const url = URL.parse(rawUrl);
      if (!url) return { ok: false, reason: "blocked" };

      const resolved = await resolvePublic(url, dns);
      if (!resolved.ok) return resolved;

      const entry = snapshot[`GET ${rawUrl}`];
      if (!entry)
        throw new SnapshotError(`http: GET ${rawUrl} was not recorded`);
      if ("failure" in entry) return { ok: false, reason: entry.failure };

      return {
        ok: true,
        response: {
          status: entry.status,
          headers: entry.headers,
          location: entry.location,
          truncated: entry.truncated,
          body: entry.body
            ? readSnapshotBody(snapshotDir, entry.body)
            : Buffer.alloc(0),
        },
      };
    },
  };
}
