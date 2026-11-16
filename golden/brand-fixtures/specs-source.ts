import {
  bannerPhoto,
  classStyledSvg,
  hostileSvg,
  ink,
  lookalikeColoursSvg,
  paymentBadge,
  tinySvg,
} from "./images";
import { homeLink, og, ogHead, org, site } from "./html";
import { accepted, IMAGES, otherBrand, type Spec } from "./spec";

const title = (extra: string) => `<title>Blue Mug</title>${extra}`;

// Logo sources after the header: structured data, og:image, the wordmark, and hostile files.
export async function sourceSpecs(): Promise<Spec[]> {
  const ink1 = await ink();
  const badge = await paymentBadge();
  const banner = await bannerPhoto();

  return [
    {
      // No header logo: structured data supplies it, and its organisation name beats og:site_name.
      name: "brand-structured-data-logo",
      head: title(
        `${site("OG Name")}${org({ name: "Org Goods", logo: `${IMAGES}/org.png` })}`,
      ),
      header: `<header>${homeLink("Org Goods")}</header>`,
      files: { "org.png": ink1 },
      storefront: null,
      verdicts: [accepted("Org Goods")],
    },
    {
      // The structured-data file is gone; the homepage og:image is named "logo" and flat, so it is tried.
      name: "brand-og-image-logo",
      head: title(
        `${site("Share Goods")}${org({ name: "Share Goods", logo: `${IMAGES}/gone.png` })}`,
      ),
      header: "<header></header>",
      homeHead: ogHead(og("share-logo.png")),
      files: { "gone.png": 404, "share-logo.png": ink1 },
      storefront: 404,
      verdicts: [accepted("Share Goods")],
    },
    {
      // A photo-like og:image named "logo" fails the colour and background gate with no model call; the wordmark follows.
      name: "brand-og-photo-wordmark",
      head: title(site("Photo Goods")),
      header: "<header></header>",
      homeHead: ogHead(og("hero-logo-banner.png")),
      files: { "hero-logo-banner.png": banner },
      storefront: null,
      verdicts: [],
    },
    {
      // A payment badge named "logo" passes the gate but is another brand: rejected, then the wordmark.
      name: "brand-payment-badge",
      head: title(site("Badge Goods")),
      header: "<header></header>",
      homeHead: ogHead(og("paypal-logo.png")),
      files: { "paypal-logo.png": badge },
      storefront: null,
      verdicts: [otherBrand("PayPal")],
    },
    {
      // Hostile markup, plain and namespace-prefixed: the picture still renders, and only a PNG is stored.
      name: "brand-svg-hostile",
      head: title(site("Hostile Goods")),
      header: `<header>${homeLink(`<img src="${IMAGES}/logo.svg">`)}</header>`,
      files: { "logo.svg": hostileSvg() },
      storefront: null,
      verdicts: [accepted("Hostile Goods")],
    },
    {
      // Paint values named like object properties are unknown colours, not a crash.
      name: "brand-svg-colour-lookalikes",
      head: title(site("Lookalike Goods")),
      header: `<header>${homeLink(`<img src="${IMAGES}/logo.svg">`)}</header>`,
      files: { "logo.svg": lookalikeColoursSvg() },
      storefront: null,
      verdicts: [accepted("Lookalike Goods")],
    },
    {
      // Colours that live in classes next to an @import survive the strip and render in colour.
      name: "brand-svg-class-colours",
      head: title(site("Class Goods")),
      header: `<header>${homeLink(`<img src="${IMAGES}/logo.svg">`)}</header>`,
      files: { "logo.svg": classStyledSvg() },
      storefront: null,
      verdicts: [accepted("Class Goods")],
    },
    {
      // A tiny viewBox renders at full size.
      name: "brand-svg-tiny-viewbox",
      head: title(site("Tiny Goods")),
      header: `<header>${homeLink(`<img src="${IMAGES}/logo.svg">`)}</header>`,
      files: { "logo.svg": tinySvg() },
      storefront: null,
      verdicts: [accepted("Tiny Goods")],
    },
  ];
}
