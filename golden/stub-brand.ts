import type { BrandKit, BrandResult } from "@/lib/intake";

const typeface = { declared: null, family: "Inter", exact: false };

const kit: BrandKit = {
  palette: {
    primary: null,
    secondary: null,
    background: null,
    text: null,
    themeColour: null,
  },
  fonts: { heading: typeface, body: typeface },
  tone: [],
  audience: "",
  valuePropositions: [],
  proofPoints: [],
};

// For fixtures recorded before the brand stage: a named store with a wordmark, so confirm scenarios can run on them without a homepage.
export const stubBrand: BrandResult = {
  storeName: "Stub Store",
  needsBrandName: false,
  logo: {
    source: "wordmark",
    textRead: null,
    pngPath: null,
    width: null,
    height: null,
    sourceUrl: null,
    text: "Stub Store",
    colourClass: null,
    colours: [],
    transparent: true,
    headerBackground: null,
    iconOnly: false,
    storeBrand: true,
  },
  brandKit: kit,
  brandKitScraped: kit,
  pages: [],
  costs: [],
};
