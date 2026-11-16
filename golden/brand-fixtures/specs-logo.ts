import {
  boxedEmblem,
  counterRings,
  ringsWithDot,
  ink,
  roundedBox,
  svgText,
  svgWithBackground,
  twoColour,
} from "./images";
import { homeLink, site } from "./html";
import { accepted, IMAGES, iconOnly, type Spec } from "./spec";

const title = (extra: string) => `<title>Blue Mug</title>${extra}`;

// The header logo and the Storefront logo: how each is found, cleaned, checked and replaced.
export async function logoSpecs(): Promise<Spec[]> {
  const ink1 = await ink();
  const ink2 = await ink("#445566");
  const two = await twoColour();
  const boxed = await boxedEmblem();
  const rings = await counterRings();
  const dotted = await ringsWithDot();
  const rounded = await roundedBox();
  const encoded = Buffer.from(two).toString("base64");
  const boxedHeader = `<header>${homeLink(`<img src="${IMAGES}/boxed.png">`)}</header>`;

  return [
    {
      // Not the first header link, data-src, a Shopify size suffix, about page from the footer.
      name: "brand-header-lazy-suffix",
      head: title(site("Lazy Goods")),
      header: `<header><a href="/cart"><img src="${IMAGES}/cart_small.png"></a>${homeLink(`<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-src="${IMAGES}/logo_300x.png?v=1" alt="Lazy Goods">`)}</header>`,
      about: "<html><body><main>We make mugs.</main></body></html>",
      files: { "logo.png": two },
      verdicts: [accepted("Lazy Goods")],
    },
    {
      // data-src holds a {width} placeholder that the page's script would fill in.
      name: "brand-header-width-placeholder",
      head: title(site("Width Goods")),
      header: `<header>${homeLink(`<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-src="${IMAGES}/logo_{width}x.png">`)}</header>`,
      files: { "logo.png": two },
      verdicts: [accepted("Width Goods")],
    },
    {
      // <use> to a <symbol>, painted with currentColor.
      name: "brand-header-use-symbol",
      head: title(site("Symbol Goods")),
      header: `<svg style="display:none"><symbol id="icon-logo" viewBox="0 0 140 40"><rect x="10" y="5" width="120" height="30" fill="currentColor"/></symbol></svg><header>${homeLink('<svg class="icon" role="img" aria-label="Symbol Goods"><use href="#icon-logo"></use></svg>')}</header>`,
      verdicts: [accepted("Symbol Goods")],
    },
    {
      // The header markup exists only as an escaped string inside a script.
      name: "brand-header-script-held",
      head: title(site("Script Goods")),
      header: `<header><script>window.__header = "\\u003ca href=\\"\\/\\" class=\\"logo\\"\\u003e\\u003cimg src=\\"${IMAGES}/logo.png\\" alt=\\"Script Goods\\"\\u003e\\u003c\\/a\\u003e";</script></header>`,
      files: { "logo.png": ink1 },
      verdicts: [accepted("Script Goods")],
    },
    {
      // An "SVG" that only wraps a PNG: the PNG is read, and its two colours show.
      name: "brand-header-svg-raster",
      head: title(site("Wrapped Goods")),
      header: `<header>${homeLink(`<img src="${IMAGES}/logo.svg" alt="Wrapped Goods">`)}</header>`,
      files: {
        "logo.svg": svgText(
          `<image width="200" height="100" href="data:image/png;base64,${encoded}"/>`,
        ),
      },
      verdicts: [accepted("Wrapped Goods")],
    },
    {
      // The same wrapper pointing at the picture by URL (Thrive): the picture is fetched and no svg is kept.
      name: "brand-header-svg-raster-url",
      head: title(site("Framed Goods")),
      header: `<header>${homeLink(`<img src="${IMAGES}/frame.svg" alt="Framed Goods">`)}</header>`,
      files: {
        "frame.svg": svgText(
          `<image width="200" height="100" href="${IMAGES}/inner.png"/>`,
        ),
        "inner.png": two,
      },
      verdicts: [accepted("Framed Goods")],
    },
    {
      // An icon-only header logo is rejected; the transparent Storefront logo takes over.
      name: "brand-icon-only-to-storefront",
      head: title(site("Icon Goods")),
      header: `<header>${homeLink(`<img src="${IMAGES}/icon.png">`)}</header>`,
      files: { "icon.png": ink2, "store.png": ink1 },
      storefront: `${IMAGES}/store.png`,
      verdicts: [iconOnly, accepted("Icon Goods")],
    },
    {
      // A transparent Storefront logo replaces an opaque header logo.
      name: "brand-storefront-replaces-opaque",
      head: title(site("Boxed Goods")),
      header: boxedHeader,
      files: { "boxed.png": boxed, "store.png": ink1 },
      storefront: `${IMAGES}/store.png`,
      verdicts: [accepted("Boxed Goods"), accepted("Boxed Goods")],
    },
    {
      // An svg with a full-bleed white background is opaque, so the transparent Storefront logo replaces it.
      name: "brand-svg-background-replaced",
      head: title(site("Backed Goods")),
      header: `<header>${homeLink(`<img src="${IMAGES}/logo.svg">`)}</header>`,
      files: { "logo.svg": svgWithBackground(), "store.png": ink1 },
      storefront: `${IMAGES}/store.png`,
      verdicts: [accepted("Backed Goods"), accepted("Backed Goods")],
    },
    {
      // Both logos are opaque: the Storefront one is skipped without a model call, the header one keeps its white inside after the box goes.
      name: "brand-white-box-keeps-interior",
      head: title(site("Boxed Goods")),
      header: boxedHeader,
      files: { "boxed.png": boxed, "store.png": boxed },
      storefront: `${IMAGES}/store.png`,
      verdicts: [accepted("Boxed Goods")],
    },
    {
      // One ink on a white box: the counters of the letters come out transparent.
      name: "brand-one-ink-counters",
      head: title(site("Ring Goods")),
      header: `<header>${homeLink(`<img src="${IMAGES}/rings.png">`)}</header>`,
      files: { "rings.png": rings },
      storefront: null,
      verdicts: [accepted("Ring Goods")],
    },
    {
      // A small accent on a one-ink logo keeps its own colour and stays opaque while the counters still clear.
      name: "brand-one-ink-accent",
      head: title(site("Dot Goods")),
      header: `<header>${homeLink(`<img src="${IMAGES}/dotted.png">`)}</header>`,
      files: { "dotted.png": dotted },
      storefront: null,
      verdicts: [accepted("Dot Goods")],
    },
    {
      // A white box with rounded (transparent) corners is still a box: it goes, and the ink mark is what remains.
      name: "brand-rounded-white-box",
      head: title(site("Round Goods")),
      header: `<header>${homeLink(`<img src="${IMAGES}/rounded.png">`)}</header>`,
      files: { "rounded.png": rounded },
      storefront: null,
      verdicts: [accepted("Round Goods")],
    },
    {
      // The Storefront logo is transparent but icon-only: the opaque header logo stays.
      name: "brand-storefront-icon-only-skipped",
      head: title(site("Boxed Goods")),
      header: boxedHeader,
      files: { "boxed.png": boxed, "store.png": ink2 },
      storefront: `${IMAGES}/store.png`,
      verdicts: [accepted("Boxed Goods"), iconOnly],
    },
  ];
}
