import {
  CATEGORY_DEFAULTS,
  FONT_FAMILIES,
  type FontCategory,
} from "./families";

export type Typeface = {
  // The first family in the page's font stack, or null when the page names none.
  declared: string | null;
  family: string;
  // False when the family is the nearest of its category, not the brand's own.
  exact: boolean;
};

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

// Fontsource and Google renamed or split some families after themes were written.
const ALIASES: Record<string, string> = {
  sourcesanspro: "Source Sans 3",
  sourceserifpro: "Source Serif 4",
  cormorant: "Cormorant Garamond",
  playfair: "Playfair Display",
};

const SERIF_WORDS =
  /garamond|baskerville|didot|bodoni|caslon|georgia|times|palatino|cambria|merriweather|lora|serif/;

function categoryOf(declared: string, stack: string): FontCategory {
  const name = declared.toLowerCase();
  const generic = stack.toLowerCase();
  if (/script|handwrit|brush|signature|cursive/.test(name)) return "script";
  if (/mono|code|courier|typewriter/.test(name)) return "mono";
  if (/slab/.test(name)) return "slab";
  if (/sans/.test(name)) return "sans";
  if (SERIF_WORDS.test(name)) return "serif";
  if (/monospace/.test(generic)) return "mono";
  if (/cursive/.test(generic)) return "script";
  if (/(^|[\s,])serif/.test(generic) && !/sans-serif/.test(generic)) {
    return "serif";
  }
  return "sans";
}

export function firstFamily(stack: string): string | null {
  const first = /^\s*(?:"([^"]+)"|'([^']+)'|([^,]+))/.exec(stack);
  const name = (first?.[1] ?? first?.[2] ?? first?.[3] ?? "").trim();
  return name === "" ||
    /^(inherit|initial|unset|system-ui|-apple-system)$/i.test(name)
    ? null
    : name;
}

// Families that appear in stacks as system fallbacks, not as the brand's choice.
const SYSTEM_FALLBACKS = new Set([
  "blinkmacsystemfont",
  "segoeui",
  "roboto",
  "helveticaneue",
  "arial",
]);

// The named families of a stack, in order (generic keywords and system fonts are not Google families, so they never match).
function stackFamilies(stack: string) {
  return [...stack.matchAll(/"([^"]+)"|'([^']+)'|([^,]+)/g)]
    .map((m) => (m[1] ?? m[2] ?? m[3] ?? "").trim())
    .filter(Boolean);
}

function lookup(name: string, prefixed: boolean) {
  const wanted = key(name);
  const alias = ALIASES[wanted];
  if (alias) return { family: alias, exact: false };

  const exact = FONT_FAMILIES.find((f) => key(f.family) === wanted);
  if (exact) return { family: exact.family, exact: true };

  // "Montserrat Alternates" and "Inter Tight" belong to the longest family they start with. Only the stack's first name gets this; a fallback like "Interstate" must not.
  const longest = prefixed
    ? FONT_FAMILIES.filter((f) => wanted.startsWith(key(f.family))).sort(
        (a, b) => b.family.length - a.family.length,
      )[0]
    : undefined;
  return longest ? { family: longest.family, exact: false } : null;
}

export function mapTypeface(stack: string | null): Typeface {
  const declared = stack === null ? null : firstFamily(stack);
  if (declared === null) {
    return { declared: null, family: CATEGORY_DEFAULTS.sans, exact: false };
  }
  const own = lookup(declared, true);
  if (own) return { declared, ...own };

  // The brand's own font isn't one we have; if a named fallback after it is, that is what a browser without the brand font would draw.
  const fallback = stackFamilies(stack ?? "")
    .slice(1)
    .filter((name) => !SYSTEM_FALLBACKS.has(key(name)))
    .map((name) => lookup(name, false))
    .find((match) => match !== null);
  if (fallback) return { declared, ...fallback, exact: false };

  const category = categoryOf(declared, stack ?? "");
  return { declared, family: CATEGORY_DEFAULTS[category], exact: false };
}
