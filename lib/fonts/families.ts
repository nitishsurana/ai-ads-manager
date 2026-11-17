export type FontCategory = "sans" | "serif" | "slab" | "script" | "mono";

export type FontFamily = {
  family: string;
  // Fontsource id: static files are latin-400-normal.ttf and latin-700-normal.ttf under it.
  fontsourceId: string;
  // The Fontsource package version the files are fetched at, so a font never changes under a cached layout.
  version: string;
  category: FontCategory;
};

// Selection criteria (checked against api.fontsource.org on 2026-11-16):
// - a Google Font on Fontsource with both weights 400 and 700 as static latin TTFs (all 40 URLs answered 200); Satori can't use variable fonts
// - common in store branding, spread over five categories so the nearest-family fallback has a real neighbour
// - families with a single weight (Pacifico, Bebas Neue, Anton, Lobster) or no static TTF (DM Serif Display, Satisfy, Great Vibes) are left out
export const FONT_FAMILIES: readonly FontFamily[] = [
  {
    family: "Inter",
    fontsourceId: "inter",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Roboto",
    fontsourceId: "roboto",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Open Sans",
    fontsourceId: "open-sans",
    version: "5.3.0",
    category: "sans",
  },
  { family: "Lato", fontsourceId: "lato", version: "5.3.0", category: "sans" },
  {
    family: "Montserrat",
    fontsourceId: "montserrat",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Poppins",
    fontsourceId: "poppins",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Nunito",
    fontsourceId: "nunito",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Nunito Sans",
    fontsourceId: "nunito-sans",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Raleway",
    fontsourceId: "raleway",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Work Sans",
    fontsourceId: "work-sans",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "DM Sans",
    fontsourceId: "dm-sans",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Manrope",
    fontsourceId: "manrope",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Source Sans 3",
    fontsourceId: "source-sans-3",
    version: "5.3.1",
    category: "sans",
  },
  {
    family: "Noto Sans",
    fontsourceId: "noto-sans",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Figtree",
    fontsourceId: "figtree",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Rubik",
    fontsourceId: "rubik",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Karla",
    fontsourceId: "karla",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Barlow",
    fontsourceId: "barlow",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Josefin Sans",
    fontsourceId: "josefin-sans",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Archivo",
    fontsourceId: "archivo",
    version: "5.3.0",
    category: "sans",
  },
  { family: "Jost", fontsourceId: "jost", version: "5.3.0", category: "sans" },
  {
    family: "Oswald",
    fontsourceId: "oswald",
    version: "5.3.0",
    category: "sans",
  },
  {
    family: "Playfair Display",
    fontsourceId: "playfair-display",
    version: "5.3.0",
    category: "serif",
  },
  { family: "Lora", fontsourceId: "lora", version: "5.3.0", category: "serif" },
  {
    family: "Merriweather",
    fontsourceId: "merriweather",
    version: "5.3.0",
    category: "serif",
  },
  {
    family: "Cormorant Garamond",
    fontsourceId: "cormorant-garamond",
    version: "5.3.0",
    category: "serif",
  },
  {
    family: "EB Garamond",
    fontsourceId: "eb-garamond",
    version: "5.3.0",
    category: "serif",
  },
  {
    family: "Libre Baskerville",
    fontsourceId: "libre-baskerville",
    version: "5.3.0",
    category: "serif",
  },
  {
    family: "PT Serif",
    fontsourceId: "pt-serif",
    version: "5.3.0",
    category: "serif",
  },
  {
    family: "Crimson Text",
    fontsourceId: "crimson-text",
    version: "5.3.0",
    category: "serif",
  },
  {
    family: "Cardo",
    fontsourceId: "cardo",
    version: "5.3.0",
    category: "serif",
  },
  {
    family: "Source Serif 4",
    fontsourceId: "source-serif-4",
    version: "5.3.1",
    category: "serif",
  },
  {
    family: "Bitter",
    fontsourceId: "bitter",
    version: "5.3.0",
    category: "slab",
  },
  {
    family: "Zilla Slab",
    fontsourceId: "zilla-slab",
    version: "5.3.0",
    category: "slab",
  },
  {
    family: "Roboto Slab",
    fontsourceId: "roboto-slab",
    version: "5.3.0",
    category: "slab",
  },
  {
    family: "Dancing Script",
    fontsourceId: "dancing-script",
    version: "5.3.0",
    category: "script",
  },
  {
    family: "Caveat",
    fontsourceId: "caveat",
    version: "5.3.0",
    category: "script",
  },
  {
    family: "Roboto Mono",
    fontsourceId: "roboto-mono",
    version: "5.3.0",
    category: "mono",
  },
  {
    family: "IBM Plex Mono",
    fontsourceId: "ibm-plex-mono",
    version: "5.3.0",
    category: "mono",
  },
  {
    family: "Space Mono",
    fontsourceId: "space-mono",
    version: "5.3.0",
    category: "mono",
  },
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
