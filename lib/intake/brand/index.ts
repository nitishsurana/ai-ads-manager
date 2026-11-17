import * as cheerio from "cheerio";
import type { CostEntry } from "../photos";
import { writeBrandCopy } from "./copy";
import { readHeaderBackground } from "./header-background";
import { findHeaderLogo } from "./header-logo";
import { chooseLogo, storeLogo, wordmark } from "./logo";
import { ogImageHref } from "./og";
import { renderBrandPages } from "./pages";
import { storefrontLogo } from "./storefront";
import { nameFromAlt, readStoreName } from "./store-name";
import { readLinkedCss } from "./stylesheets";
import { readOrganisation } from "./structured-data";
import { capturedColour, readStyle, usableStyles } from "./style";
import {
  type BrandDeps,
  type BrandInput,
  type BrandKit,
  type BrandPage,
  type BrandResult,
} from "./types";
import { absolute } from "./urls";

export { BrandStageError } from "./types";
export { contrast, fromHex, parseColour, toHex, type Rgb } from "./colour";
export type {
  BrandKit,
  BrandPage,
  BrandResult,
  Logo,
  LogoColourClass,
  LogoSource,
  Palette,
} from "./types";

// Logo, store name and brand kit. The no-logo warning isn't decided here: it depends on the tester's answer to the brand-name prompt. The caller owns `costs` so spend survives a throw.
export async function runBrand(
  input: BrandInput,
  deps: BrandDeps,
  costs: CostEntry[],
): Promise<BrandResult> {
  const { productUrl, productHtml, intakeId } = input;
  const label = `intake ${intakeId}`;
  const url = new URL(productUrl);

  const rendered = await renderBrandPages(
    { productUrl, market: input.market, label },
    deps,
  );
  const { homepage, about } = rendered;
  const product = { $: cheerio.load(productHtml), url: productUrl };
  const pages: BrandPage[] = about ? ["homepage", "about"] : ["homepage"];

  const styles = usableStyles(input.styles);
  // The sheets only supply colours, so they're skipped when the capture already gave a primary and a background.
  const capturedBoth =
    capturedColour(styles?.button?.background) &&
    capturedColour(styles?.body.background);
  const linkedCss = capturedBoth
    ? ""
    : await readLinkedCss(product.$, productUrl, label, deps);
  const { palette, fonts } = readStyle(product.$, styles, linkedCss);
  const headerBackground =
    capturedColour(styles?.header?.background) ??
    readHeaderBackground(product.$, palette.background);
  const sourceName = readStoreName([product, homepage], url.hostname);

  const organisationLogo =
    readOrganisation(product.$)?.logo ?? readOrganisation(homepage.$)?.logo;
  const ogImage = ogImageHref(homepage.$);
  const accepted = await chooseLogo(
    {
      label,
      pageUrl: productUrl,
      storeName: sourceName,
      productTitle: input.productTitle,
      sources: {
        header: findHeaderLogo(product.$, productUrl),
        storefront: () => storefrontLogo(url.origin, label, deps),
        structuredData: organisationLogo
          ? absolute(organisationLogo, productUrl)
          : null,
        ogImage: ogImage ? absolute(ogImage, homepage.url) : null,
      },
    },
    deps,
    costs,
  );

  const storeName =
    sourceName ??
    (accepted ? nameFromAlt(accepted.loaded.alt, url.hostname) : null);
  const logo = accepted
    ? await storeLogo(accepted, { intakeId, headerBackground }, deps)
    : storeName
      ? wordmark(storeName, headerBackground)
      : null;

  const copy = await writeBrandCopy(
    {
      storeName,
      pages: {
        product: productHtml,
        homepage: homepage.html,
        about: about?.html ?? null,
      },
    },
    deps,
    costs,
  );
  const brandKit: BrandKit = { palette, fonts, ...copy };

  return {
    storeName,
    needsBrandName: storeName === null,
    logo,
    brandKitScraped: brandKit,
    brandKit: structuredClone(brandKit),
    pages,
    costs,
  };
}
