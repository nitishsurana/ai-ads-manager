import type { Ai } from "@/lib/providers/ai";
import type { Http } from "@/lib/providers/http";
import type { Storage } from "@/lib/providers/storage";
import type { CostEntry } from "../photos";
import { cleanLogo, type CleanedLogo } from "./clean";
import { checkLogo, isAccepted, type LogoVerdict } from "./check";
import { headerBackgroundFor } from "./header-background";
import type { LogoRef } from "./header-logo";
import { loadLogo, type LoadedLogo } from "./load";
import { logSwallowed } from "./log";
import { namesALogo, looksLikeLogo } from "./og";
import { checkJpeg } from "./pixels";
import { logoUrls } from "./urls";
import type { Logo, LogoSource } from "./types";

const BUCKET = "logos";

export type LogoSources = {
  header: LogoRef | null;
  // Asked only when the header can't settle it, so a transparent header logo costs no extra request.
  storefront: () => Promise<string | null>;
  structuredData: string | null;
  ogImage: string | null;
};

export type LogoDeps = { http: Http; ai: Ai; storage: Storage };

type Accepted = {
  source: LogoSource;
  loaded: LoadedLogo;
  cleaned: CleanedLogo;
  verdict: LogoVerdict;
};

type Options = { requireTransparent?: boolean; logoNamed?: boolean };

// The chain: header logo, Storefront logo (replacing an opaque header logo when it is transparent), structured data, a logo-like og:image. Each candidate is loaded, cleaned and checked by the model; a rejected one falls through.
export async function chooseLogo(
  input: {
    label: string;
    pageUrl: string;
    storeName: string | null;
    productTitle: string;
    sources: LogoSources;
  },
  deps: LogoDeps,
  costs: CostEntry[],
): Promise<Accepted | null> {
  const { label, pageUrl, storeName, productTitle, sources } = input;
  const tried = new Set<string>();

  async function evaluate(
    source: LogoSource,
    ref: LogoRef,
    options: Options = {},
  ): Promise<Accepted | null> {
    const key =
      ref.kind === "svg"
        ? ref.markup
        : (logoUrls(ref.href, pageUrl)[0] ?? ref.href);
    if (tried.has(key)) return null;
    tried.add(key);

    const loaded = await loadLogo(ref, pageUrl, `${label} ${source}`, deps);
    if (!loaded) return null;
    if (options.requireTransparent && !loaded.transparentSource) return null;
    if (options.logoNamed && !looksLikeLogo(loaded.raster)) return null;
    const cleaned = await cleanLogo(loaded);
    if (!cleaned) {
      logSwallowed(
        `${label} ${source}`,
        "cleanup",
        "nothing visible in the image",
      );
      return null;
    }
    const verdict = await checkLogo(
      {
        sha256: loaded.sha256,
        image: await checkJpeg(cleaned.rgba),
        storeName,
        productTitle,
      },
      deps,
      costs,
    );
    return isAccepted(verdict) ? { source, loaded, cleaned, verdict } : null;
  }

  const header = sources.header
    ? await evaluate("header", sources.header)
    : null;
  if (header?.loaded.transparentSource) return header;

  const storefront = await sources.storefront();
  if (storefront) {
    const replacement = await evaluate(
      "storefront",
      { kind: "url", href: storefront, alt: null },
      { requireTransparent: header !== null },
    );
    if (replacement) return replacement;
  }
  if (header) return header;

  const candidates: [LogoSource, string | null, Options][] = [
    ["structured_data", sources.structuredData, {}],
    ["og_image", sources.ogImage, { logoNamed: true }],
  ];
  for (const [source, href, options] of candidates) {
    if (!href || (options.logoNamed && !namesALogo(href))) continue;
    const found = await evaluate(
      source,
      { kind: "url", href, alt: null },
      options,
    );
    if (found) return found;
  }
  return null;
}

export async function storeLogo(
  accepted: Accepted,
  input: { intakeId: string; headerBackground: string | null },
  deps: { storage: Storage },
): Promise<Logo> {
  const { cleaned, verdict, source, loaded } = accepted;
  const pngPath = `${input.intakeId}/logo.png`;
  await deps.storage.put(BUCKET, pngPath, cleaned.png, "image/png");
  return {
    source,
    pngPath,
    width: cleaned.rgba.width,
    height: cleaned.rgba.height,
    sourceUrl: loaded.sourceUrl,
    text: null,
    textRead: verdict.textRead.trim() || null,
    colourClass: cleaned.colourClass,
    colours: cleaned.colours,
    shares: cleaned.shares,
    transparent: cleaned.transparent,
    headerBackground: headerBackgroundFor(input.headerBackground, cleaned),
    iconOnly: verdict.iconOnly,
    storeBrand: verdict.storeBrand,
    badge: cleaned.badge,
  };
}
