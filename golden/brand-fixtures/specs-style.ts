import { homeLink } from "./html";
import { IMAGES, type Spec } from "./spec";

const body = (fontFamily: string, background: string | null) => ({
  color: "rgb(255, 255, 255)",
  fontFamily,
  background,
});

// How the computed-style capture and the theme's inline CSS combine.
export function styleSpecs(): Spec[] {
  return [
    {
      // A custom web font ahead of a Google fallback: the stack's second family is the one the browser would draw.
      name: "brand-style-font-fallback",
      header: `<header>${homeLink("Style Goods")}</header>`,
      storefront: null,
      verdicts: [],
      styles: {
        button: null,
        header: null,
        title: {
          color: "rgb(255, 255, 255)",
          fontFamily: '"Fenomen Sans", "DM Sans"',
        },
        body: body('"Fenomen Sans", "DM Sans"', "rgb(0, 0, 0)"),
        link: null,
      },
    },
    {
      // A dark page whose backdrop isn't an ancestor of the product title: the capture finds no solid background, so the theme's own colour decides, not white.
      name: "brand-style-no-solid-background",
      head: "<title>Blue Mug</title><style>:root{--color-background:#101010}</style>",
      header: `<header>${homeLink("Style Goods")}</header>`,
      storefront: null,
      verdicts: [],
      styles: {
        button: null,
        header: null,
        title: { color: "rgb(255, 255, 255)", fontFamily: "Inter, sans-serif" },
        body: body("Inter, sans-serif", null),
        link: null,
      },
    },
    {
      // No inline theme CSS and no capture: the custom properties live in the linked theme sheet on the CDN.
      name: "brand-style-linked-sheet",
      head: `<title>Blue Mug</title><link rel="stylesheet" href="${IMAGES}/theme.css">`,
      header: `<header>${homeLink("Style Goods")}</header>`,
      files: {
        "theme.css": Buffer.from(
          ":root{--color-base-solid-button:170,142,114;--body-bg-color:12 34 56}",
        ),
      },
      storefront: null,
      verdicts: [],
    },
    {
      // Browser-default fonts mean the theme CSS never applied, but a solid button colour is still the brand's.
      name: "brand-style-default-fonts-button",
      header: `<header>${homeLink("Style Goods")}</header>`,
      storefront: null,
      verdicts: [],
      styles: {
        button: {
          background: "rgb(120, 40, 60)",
          color: "rgb(255, 255, 255)",
          fontFamily: '"Times New Roman"',
        },
        header: null,
        title: { color: "rgb(0, 0, 0)", fontFamily: '"Times New Roman"' },
        body: body('"Times New Roman"', null),
        link: { color: "rgb(0, 0, 238)" },
      },
    },
  ];
}
