import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FONT_FAMILIES } from "@/lib/fonts";
import { SnapshotError } from "@/lib/providers/snapshot";
import type { Http } from "../types";

// Committed Fontsource files for the families the golden rows and fixtures use.
export const FONT_FIXTURES = join("golden", "fonts");

const FONT_URL =
  /^https:\/\/cdn\.jsdelivr\.net\/fontsource\/fonts\/([a-z0-9-]+)@([0-9.]+)\/([a-z0-9-]+\.ttf)$/;

// Serves pinned-version Fontsource downloads from committed files at <dir>/<id>/<file>, for the golden runners and the end-to-end tests.
export function createFontReplayHttp(dir: string): Http {
  return {
    async get(url) {
      const [, id = "", version = "", name = ""] = FONT_URL.exec(url) ?? [];
      const pinned = FONT_FAMILIES.find((family) => family.fontsourceId === id);
      if (!name || pinned?.version !== version) {
        throw new SnapshotError(`http: ${url} is not a pinned font URL`);
      }
      const file = join(/* turbopackIgnore: true */ dir, id, name);
      if (!existsSync(file)) {
        throw new SnapshotError(`http: font ${url} was not recorded`);
      }
      return {
        ok: true,
        response: {
          status: 200,
          headers: { "content-type": "font/ttf" },
          location: null,
          body: readFileSync(file),
          truncated: false,
        },
      };
    },
  };
}
