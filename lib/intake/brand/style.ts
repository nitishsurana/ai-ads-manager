import type { CheerioAPI } from "cheerio";
import type { PageStyles } from "@/lib/providers/firecrawl";
import { mapTypeface } from "@/lib/fonts";
import { parseColour, toHex } from "./colour";
import { declarations, parseRules, stripComments } from "./css";
import type { BrandFonts, Palette } from "./types";

// Theme variable names by role, most specific first. Themes differ (Dawn, Impulse, Horizon and custom ones), so each role lists the names the golden stores use.
const COLOUR_VARS = {
  background: [
    "color-background",
    "color-base-background-1",
    "color-body-bg",
    "hh-color-background",
    "color-bg",
    "background-color",
    "bg-color",
  ],
  text: [
    "color-foreground",
    "color-base-text",
    "color-body-text",
    "hh-color-text",
    "color-text",
    "text-color",
    "color-body",
  ],
  primary: [
    "color-button",
    "color-base-accent-1",
    "hh-color-brand-primary",
    "color-primary",
    "color-accent-1",
    "color-brand",
    "primary-color",
    "color-accent",
  ],
  secondary: [
    "color-secondary",
    "hh-color-brand-secondary",
    "color-base-accent-2",
    "color-accent-2",
    "secondary-color",
  ],
} as const;

const FONT_VARS = {
  heading: [
    "font-heading-family",
    "heading-font-family",
    "font-family-heading",
    "element-text-font-family--heading",
    "font-heading",
  ],
  body: [
    "font-body-family",
    "base-font-family",
    "body-font-family",
    "font-family-body",
    "element-text-font-family--body",
    "font-body",
    "font-face-sans",
    "font-web-sans",
  ],
} as const;

const ICON_FONT = /icon|awesome|symbol|glyph|oke-|jdgm|judgeme|cartx|star/i;
const ROOT_SELECTOR = /^(:root|html|body)$/;
const MAX_VAR_DEPTH = 4;

function themeCss($: CheerioAPI) {
  return $("style")
    .toArray()
    .map((el) => $(el).text())
    .join("\n");
}

// The first declaration wins: theme settings come before app overrides in the document head.
function rootVariables(css: string) {
  const variables = new Map<string, string>();
  for (const rule of parseRules(css)) {
    if (!rule.selectors.some((s) => ROOT_SELECTOR.test(s))) continue;
    for (const [name, value] of declarations(rule.body)) {
      if (name.startsWith("--") && !variables.has(name.slice(2))) {
        variables.set(name.slice(2), value);
      }
    }
  }
  return variables;
}

function resolve(
  value: string,
  variables: Map<string, string>,
  depth = 0,
): string {
  return value.replace(
    /var\(\s*--([\w-]+)\s*(?:,\s*([^)]*))?\)/g,
    (whole, name: string, fallback?: string) => {
      const next = variables.get(name) ?? fallback;
      return next === undefined || depth >= MAX_VAR_DEPTH
        ? whole
        : resolve(next, variables, depth + 1);
    },
  );
}

function firstColour(names: readonly string[], variables: Map<string, string>) {
  for (const name of names) {
    const value = variables.get(name);
    const rgb =
      value === undefined ? null : parseColour(resolve(value, variables));
    if (rgb) return toHex(rgb);
  }
  return null;
}

function firstStack(names: readonly string[], variables: Map<string, string>) {
  for (const name of names) {
    const value = variables.get(name);
    if (value === undefined) continue;
    const stack = resolve(value, variables);
    if (!stack.includes("var(")) return stack;
  }
  return null;
}

function ruleFontStack(
  css: string,
  variables: Map<string, string>,
  tags: RegExp,
) {
  for (const rule of parseRules(css)) {
    if (!rule.selectors.some((s) => tags.test(s))) continue;
    const family = declarations(rule.body).find(([n]) => n === "font-family");
    if (!family) continue;
    const stack = resolve(family[1], variables);
    if (!stack.includes("var(")) return stack;
  }
  return null;
}

function fontFaceFamily(css: string) {
  for (const match of stripComments(css).matchAll(
    /@font-face\s*\{([^}]*)\}/gi,
  )) {
    const family = declarations(match[1] ?? "").find(
      ([n]) => n === "font-family",
    );
    if (family && !ICON_FONT.test(family[1])) return family[1];
  }
  return null;
}

// The browser chrome colour many themes declare: usually the brand's header or accent colour, so it is kept apart from the page background.
function themeColour($: CheerioAPI) {
  const rgb = parseColour($('meta[name="theme-color"]').attr("content") ?? "");
  return rgb ? toHex(rgb) : null;
}

// Chrome's font for an element no stylesheet has touched. A body in it means the theme CSS never applied in the capture (seen on G13 and G24 even after 8 s), so nothing in that capture is brand.
const DEFAULT_FONT = '"Times New Roman"';
const DEFAULT_BUTTON = "#efefef";

export function usableStyles(styles: PageStyles | null): PageStyles | null {
  if (!styles || styles.body.fontFamily === DEFAULT_FONT) return null;
  const { title, button } = styles;
  // An unstyled button is Chrome's #efefef (or a translucent version of it), not the brand's.
  const buttonColour = capturedColour(button?.background);
  return {
    ...styles,
    button:
      button && buttonColour && buttonColour !== DEFAULT_BUTTON ? button : null,
    title:
      title && title.fontFamily === DEFAULT_FONT
        ? { ...title, fontFamily: null }
        : title,
  };
}

export function capturedColour(value: string | null | undefined) {
  const rgb = value ? parseColour(value) : null;
  return rgb ? toHex(rgb) : null;
}

// The captured look of the rendered page wins field by field; what it lacks comes from the inline CSS.
export function readStyle(
  $: CheerioAPI,
  styles: PageStyles | null,
): { palette: Palette; fonts: BrandFonts } {
  const css = themeCss($);
  const variables = rootVariables(css);

  const palette: Palette = {
    primary:
      capturedColour(styles?.button?.background) ??
      firstColour(COLOUR_VARS.primary, variables),
    secondary:
      capturedColour(styles?.link?.color) ??
      firstColour(COLOUR_VARS.secondary, variables),
    // A usable capture with no solid background behind the product means the canvas itself: white.
    background: styles
      ? (capturedColour(styles.body.background) ?? "#ffffff")
      : firstColour(COLOUR_VARS.background, variables),
    text:
      capturedColour(styles?.body.color) ??
      firstColour(COLOUR_VARS.text, variables),
    themeColour: themeColour($),
  };

  const body =
    styles?.body.fontFamily ??
    firstStack(FONT_VARS.body, variables) ??
    ruleFontStack(css, variables, /^(html|body)$/) ??
    fontFaceFamily(css);
  const heading =
    styles?.title?.fontFamily ??
    firstStack(FONT_VARS.heading, variables) ??
    ruleFontStack(css, variables, /^h[1-3]$/) ??
    body;
  return {
    palette,
    fonts: { heading: mapTypeface(heading), body: mapTypeface(body) },
  };
}
