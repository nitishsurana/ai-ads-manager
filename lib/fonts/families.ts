export type FontCategory = "sans" | "serif" | "slab" | "script" | "mono";

export type FontFamily = {
  family: string;
  // Fontsource id: static files are latin-400-normal.ttf and latin-700-normal.ttf under it.
  fontsourceId: string;
  category: FontCategory;
};

// Selection criteria (checked against api.fontsource.org on 2026-11-16):
// - a Google Font on Fontsource with both weights 400 and 700 as static latin TTFs (all 40 URLs answered 200); Satori can't use variable fonts
// - common in store branding, spread over five categories so the nearest-family fallback has a real neighbour
// - families with a single weight (Pacifico, Bebas Neue, Anton, Lobster) or no static TTF (DM Serif Display, Satisfy, Great Vibes) are left out
export const FONT_FAMILIES: readonly FontFamily[] = [
  { family: "Inter", fontsourceId: "inter", category: "sans" },
  { family: "Roboto", fontsourceId: "roboto", category: "sans" },
  { family: "Open Sans", fontsourceId: "open-sans", category: "sans" },
  { family: "Lato", fontsourceId: "lato", category: "sans" },
  { family: "Montserrat", fontsourceId: "montserrat", category: "sans" },
  { family: "Poppins", fontsourceId: "poppins", category: "sans" },
  { family: "Nunito", fontsourceId: "nunito", category: "sans" },
  { family: "Nunito Sans", fontsourceId: "nunito-sans", category: "sans" },
  { family: "Raleway", fontsourceId: "raleway", category: "sans" },
  { family: "Work Sans", fontsourceId: "work-sans", category: "sans" },
  { family: "DM Sans", fontsourceId: "dm-sans", category: "sans" },
  { family: "Manrope", fontsourceId: "manrope", category: "sans" },
  { family: "Source Sans 3", fontsourceId: "source-sans-3", category: "sans" },
  { family: "Noto Sans", fontsourceId: "noto-sans", category: "sans" },
  { family: "Figtree", fontsourceId: "figtree", category: "sans" },
  { family: "Rubik", fontsourceId: "rubik", category: "sans" },
  { family: "Karla", fontsourceId: "karla", category: "sans" },
  { family: "Barlow", fontsourceId: "barlow", category: "sans" },
  { family: "Josefin Sans", fontsourceId: "josefin-sans", category: "sans" },
  { family: "Archivo", fontsourceId: "archivo", category: "sans" },
  { family: "Jost", fontsourceId: "jost", category: "sans" },
  { family: "Oswald", fontsourceId: "oswald", category: "sans" },
  {
    family: "Playfair Display",
    fontsourceId: "playfair-display",
    category: "serif",
  },
  { family: "Lora", fontsourceId: "lora", category: "serif" },
  { family: "Merriweather", fontsourceId: "merriweather", category: "serif" },
  {
    family: "Cormorant Garamond",
    fontsourceId: "cormorant-garamond",
    category: "serif",
  },
  { family: "EB Garamond", fontsourceId: "eb-garamond", category: "serif" },
  {
    family: "Libre Baskerville",
    fontsourceId: "libre-baskerville",
    category: "serif",
  },
  { family: "PT Serif", fontsourceId: "pt-serif", category: "serif" },
  { family: "Crimson Text", fontsourceId: "crimson-text", category: "serif" },
  { family: "Cardo", fontsourceId: "cardo", category: "serif" },
  {
    family: "Source Serif 4",
    fontsourceId: "source-serif-4",
    category: "serif",
  },
  { family: "Bitter", fontsourceId: "bitter", category: "slab" },
  { family: "Zilla Slab", fontsourceId: "zilla-slab", category: "slab" },
  { family: "Roboto Slab", fontsourceId: "roboto-slab", category: "slab" },
  {
    family: "Dancing Script",
    fontsourceId: "dancing-script",
    category: "script",
  },
  { family: "Caveat", fontsourceId: "caveat", category: "script" },
  { family: "Roboto Mono", fontsourceId: "roboto-mono", category: "mono" },
  {
    family: "IBM Plex Mono",
    fontsourceId: "ibm-plex-mono",
    category: "mono",
  },
  { family: "Space Mono", fontsourceId: "space-mono", category: "mono" },
];

// Covers glyphs the brand font lacks, such as the rupee sign in a price badge.
export const FALLBACK_FAMILY = "Noto Sans";

// Used when a typeface is unknown and nothing in its name or stack says otherwise.
export const CATEGORY_DEFAULTS: Record<FontCategory, string> = {
  sans: "Inter",
  serif: "Lora",
  slab: "Roboto Slab",
  script: "Dancing Script",
  mono: "Roboto Mono",
};
