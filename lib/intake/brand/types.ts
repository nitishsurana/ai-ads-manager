import type { Typeface } from "@/lib/fonts";
import type { Ai } from "@/lib/providers/ai";
import type { Firecrawl, PageStyles } from "@/lib/providers/firecrawl";
import type { Http } from "@/lib/providers/http";
import type { Storage } from "@/lib/providers/storage";
import type { CostEntry } from "../photos";
import type { Market } from "../types";

export type Palette = {
  primary: string | null;
  secondary: string | null;
  background: string | null;
  text: string | null;
  themeColour: string | null;
};

export type BrandFonts = { heading: Typeface; body: Typeface };

export type BrandKit = {
  palette: Palette;
  fonts: BrandFonts;
  tone: string[];
  audience: string;
  valuePropositions: string[];
  proofPoints: string[];
};

export type LogoSource =
  "header" | "storefront" | "structured_data" | "og_image" | "wordmark";

export type LogoColourClass = "one_colour" | "current_colour" | "multi_colour";

export type Logo = {
  source: LogoSource;
  // Null for a wordmark: it is drawn per creative from `text` in the brand font. Only the PNG is stored; an SVG logo is rendered to it (currentColor as black) and discarded.
  pngPath: string | null;
  width: number | null;
  height: number | null;
  sourceUrl: string | null;
  text: string | null;
  // The brand text the logo check read in the image, in the image's own casing; null for a wordmark or an older logo.
  textRead: string | null;
  colourClass: LogoColourClass | null;
  // Solid ink colours only: the currentColor part of an svg is not listed, so the renderer recolours it per creative.
  colours: string[];
  // False when a flat box that isn't near-white stays behind the artwork.
  transparent: boolean;
  headerBackground: string | null;
  iconOnly: boolean;
  storeBrand: boolean;
  // A disc or sticker with its own field, drawn as it is; false for a logo stored before.
  badge: boolean;
};

export type BrandPage = "homepage" | "about";

export type BrandResult = {
  storeName: string | null;
  needsBrandName: boolean;
  logo: Logo | null;
  brandKitScraped: BrandKit;
  brandKit: BrandKit;
  pages: BrandPage[];
  costs: CostEntry[];
};

export type BrandInput = {
  intakeId: string;
  // The product page as rendered, and the URL it was rendered from.
  productUrl: string;
  productHtml: string;
  productTitle: string;
  // Computed styles captured with the render; null on old snapshots or a failed capture.
  styles: PageStyles | null;
  market: Market;
};

export type BrandDeps = {
  http: Http;
  firecrawl: Firecrawl;
  ai: Ai;
  storage: Storage;
};

// Carries the spend so far, so a failed stage can still be costed.
export class BrandStageError extends Error {
  constructor(
    message: string,
    readonly costs: CostEntry[],
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
