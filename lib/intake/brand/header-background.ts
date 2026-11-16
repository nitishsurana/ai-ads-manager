import type { CheerioAPI } from "cheerio";
import { contrast, fromHex, parseColour, toHex } from "./colour";
import { declarations, parseRules } from "./css";
import type { LogoColourClass } from "./types";

const MAX_ANCESTORS = 6;
const MIN_LEGIBLE_CONTRAST = 3;

// Dawn-style themes colour a section with a class such as "color-scheme-2"; the class's rule declares --color-background.
function schemeBackgrounds($: CheerioAPI) {
  const css = $("style")
    .toArray()
    .map((el) => $(el).text())
    .join("\n");
  const schemes = new Map<string, string>();
  for (const rule of parseRules(css)) {
    const value = declarations(rule.body).find(
      ([name]) => name === "--color-background",
    )?.[1];
    const rgb = value === undefined ? null : parseColour(value);
    if (!rgb) continue;
    for (const selector of rule.selectors) {
      const name = /^\.(color-scheme-[\w-]+)$/.exec(selector)?.[1];
      if (name && !schemes.has(name)) schemes.set(name, toHex(rgb));
    }
  }
  return schemes;
}

function inlineBackground(style: string | undefined) {
  const value = /background(?:-color)?\s*:\s*([^;]+)/i.exec(style ?? "")?.[1];
  const rgb = value === undefined ? null : parseColour(value);
  return rgb ? toHex(rgb) : null;
}

// Read from the markup alone: an inline background or a colour-scheme class on the header or its ancestors, else the page background.
export function readHeaderBackground(
  $: CheerioAPI,
  pageBackground: string | null,
): string | null {
  const header = $("header").first();
  const start =
    header.length > 0
      ? header
      : $('[class*="section-header"], [id*="header"]').first();
  if (start.length === 0) return pageBackground;
  const schemes = schemeBackgrounds($);
  const chain = [
    start,
    ...start
      .parents()
      .slice(0, MAX_ANCESTORS)
      .toArray()
      .map((el) => $(el)),
  ];
  for (const el of chain) {
    const inline = inlineBackground(el.attr("style"));
    if (inline) return inline;
    for (const name of (el.attr("class") ?? "").split(/\s+/)) {
      const scheme = schemes.get(name);
      if (scheme) return scheme;
    }
  }
  return pageBackground;
}

// A logo is legible on the header it was read on. A one-colour logo that isn't legible on the guessed background means the guess missed (a white logo on a dark bar), so the header is taken to be the opposite shade.
export function headerBackgroundFor(
  guess: string | null,
  logo: { colourClass: LogoColourClass; colours: string[] },
): string | null {
  const colour = logo.colours[0];
  if (logo.colourClass !== "one_colour" || !colour) return guess;
  const ink = fromHex(colour);
  if (guess && contrast(fromHex(guess), ink) >= MIN_LEGIBLE_CONTRAST)
    return guess;
  return contrast(ink, [0, 0, 0]) >= contrast(ink, [255, 255, 255])
    ? "#000000"
    : "#ffffff";
}
