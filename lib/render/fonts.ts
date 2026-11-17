import * as fontkit from "fontkit";
import { FALLBACK_FAMILY, FONT_FAMILIES } from "@/lib/fonts";
import { getFollowingRedirects, type Http } from "@/lib/providers/http";
import type { Storage } from "@/lib/providers/storage";

export type Weight = 400 | 700;
const WEIGHTS: readonly Weight[] = [400, 700];

export type Face = {
  family: string;
  version: string;
  subset: "latin" | "latin-ext";
  weight: Weight;
  data: Buffer;
  font: fontkit.Font;
};

export type FontSet = Face[];

const BUCKET = "fonts";
const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

const fontsourceUrl = (id: string, version: string, file: string) =>
  `https://cdn.jsdelivr.net/fontsource/fonts/${id}@${version}/${file}`;

function parse(data: Buffer, label: string) {
  const font = fontkit.create(data);
  if (!("layout" in font)) throw new Error(`fonts: ${label} is a collection`);
  return font;
}

// Static instances only: the brand font's two weights are the whole range Satori can use. The fallback's latin-ext file carries the symbols latin lacks, such as the rupee sign.
function files(family: string, version: string) {
  const entry = FONT_FAMILIES.find((candidate) => candidate.family === family);
  if (!entry) throw new Error(`fonts: ${family} is not in the font list`);
  const subsets =
    family === FALLBACK_FAMILY
      ? (["latin", "latin-ext"] as const)
      : (["latin"] as const);
  return WEIGHTS.flatMap((weight) =>
    subsets.map((subset) => ({
      id: entry.fontsourceId,
      version,
      subset,
      weight,
      file: `${subset}-${weight}-normal.ttf`,
    })),
  );
}

async function fetchFace(
  source: { id: string; version: string; file: string },
  deps: { storage: Storage; http: Http },
) {
  const path = `${source.id}@${source.version}/${source.file}`;
  const cached = await deps.storage.get(BUCKET, path);
  if (cached) return cached;
  const url = fontsourceUrl(source.id, source.version, source.file);
  const result = await getFollowingRedirects(deps.http, url, {
    maxBytes: MAX_BYTES,
    timeoutMs: TIMEOUT_MS,
  });
  if (!result.ok || result.response.status !== 200) {
    throw new Error(`fonts: download failed: ${url}`);
  }
  if (result.response.truncated) {
    throw new Error(`fonts: download was truncated: ${url}`);
  }
  await deps.storage.put(BUCKET, path, result.response.body, "font/ttf");
  return result.response.body;
}

// The Fontsource versions the list pins today, for a new layout: the brand families and the fallback.
export function currentVersions(families: string[]) {
  const versions: Record<string, string> = {};
  for (const family of new Set([...families, FALLBACK_FAMILY])) {
    const entry = FONT_FAMILIES.find(
      (candidate) => candidate.family === family,
    );
    if (!entry) throw new Error(`fonts: ${family} is not in the font list`);
    versions[family] = entry.version;
  }
  return versions;
}

// What a layout was drawn with, read back from the faces.
export function fontVersions(faces: FontSet) {
  return Object.fromEntries(faces.map((face) => [face.family, face.version]));
}

// The faces for exactly the versions named (a layout's own, or the current pins): each family at 400 and 700, the fallback with its latin-ext file. Downloaded from Fontsource on first use and cached in the fonts bucket.
export async function loadFonts(
  versions: Record<string, string>,
  deps: { storage: Storage; http: Http },
): Promise<FontSet> {
  return Promise.all(
    Object.entries(versions).flatMap(([family, version]) =>
      files(family, version).map(async (source) => {
        const data = await fetchFace(source, deps);
        return {
          family,
          version,
          subset: source.subset,
          weight: source.weight,
          data,
          font: parse(data, `${family}@${version} ${source.file}`),
        };
      }),
    ),
  );
}

// Satori's own font list: the fallback's latin-ext faces sit under a second name, which fontFamily lists after the first.
export const EXT_NAME = `${FALLBACK_FAMILY} Extended`;

export function satoriFonts(faces: FontSet) {
  return faces.map((face) => ({
    name: face.subset === "latin-ext" ? EXT_NAME : face.family,
    data: face.data,
    weight: face.weight,
    style: "normal" as const,
  }));
}

export const fontStack = (family: string) =>
  [family, FALLBACK_FAMILY, EXT_NAME].join(", ");
