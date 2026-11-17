import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { Outcome } from "./observe";

// What was stored for the logo: only a PNG, never an svg.
export function storedLogoFiles(name: string, storageDir: string) {
  const dir = join(storageDir, "logos", name);
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

export async function probeLogo(
  outcome: Outcome,
  storageDir: string,
  withCentre: boolean,
) {
  const logo =
    outcome.ok && "result" in outcome
      ? "brand" in outcome.result
        ? outcome.result.brand.logo
        : null
      : null;
  if (!logo?.pngPath) return null;
  const { data, info } = await sharp(
    readFileSync(join(storageDir, "logos", logo.pngPath)),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => {
    const i =
      (Math.floor(y * info.height) * info.width + Math.floor(x * info.width)) *
      4;
    return {
      alpha: data[i + 3] ?? 0,
      min: Math.min(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0),
      red: (data[i] ?? 0) > 200 && (data[i + 1] ?? 255) < 60,
    };
  };
  const corner = at(0, 0);
  const inside = at(0.25, 0.5);
  const middle = at(0.5, 0.5);
  return {
    corner: corner.alpha < 10 ? "clear" : "opaque",
    interior:
      inside.alpha < 10 ? "clear" : inside.min >= 240 ? "white" : "dark",
    ...(withCentre && {
      centre: middle.alpha >= 250 && middle.red ? "red" : "other",
    }),
  };
}
