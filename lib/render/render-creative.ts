import sharp from "sharp";
import type { FontSet } from "./fonts";
import type { Layout } from "./layout";
import { logoImage } from "./logo-image";
import { scrimSvg } from "./scrim";
import { nodeProblems, renderTextLayer } from "./text-layer";

const PREVIEW_QUALITY = 78;

// The 1080x1920 creative as PNG, drawn from its stored layout, the stored background and logo file, and fonts loaded at the versions the layout names: the scrim over the background, then the text layer. Planning is not repeated, so an edit or an on-demand download renders what was stored. Problems are Satori's node boxes disagreeing with the plan.
export async function renderCreative(input: {
  background: Buffer;
  layout: Layout;
  fonts: FontSet;
  logo: Buffer | null;
}) {
  const { background, layout, fonts } = input;
  for (const [family, version] of Object.entries(layout.fonts)) {
    if (
      !fonts.some((face) => face.family === family && face.version === version)
    ) {
      throw new Error(`render: ${family}@${version} is not loaded`);
    }
  }
  if (layout.logo?.kind === "image" && !input.logo) {
    throw new Error("render: the layout has an image logo but no logo file");
  }
  const base = layout.scrim
    ? await sharp(background)
        .composite([
          { input: scrimSvg(layout.scrim), left: 0, top: layout.scrim.box.y },
        ])
        .png()
        .toBuffer()
    : background;
  const logo =
    input.logo && layout.logo?.kind === "image"
      ? `data:image/png;base64,${(await logoImage(input.logo, layout.logo)).toString("base64")}`
      : null;
  const text = await renderTextLayer(layout, { fonts, logo });
  const png = await sharp(base)
    .composite([{ input: text.png }])
    .png()
    .toBuffer();
  return { png, problems: nodeProblems(layout, text.nodes) };
}

export const previewOf = (png: Buffer) =>
  sharp(png).jpeg({ quality: PREVIEW_QUALITY, mozjpeg: true }).toBuffer();
