export type CssRule = { selectors: string[]; body: string };

const MAX_CSS_CHARS = 2_000_000;
// @charset and @import end in ";" and would otherwise glue onto the next rule's selector.
const AT_STATEMENTS = /^(?:\s*@[\w-]+[^;{}]*;)+/;

export function stripComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Rules inside @media and @supports are read too, except dark-scheme overrides; other at-rules (font-face, keyframes) are skipped.
export function parseRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const walk = (text: string) => {
    let depth = 0;
    let start = 0;
    let prelude = "";
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === "{") {
        if (depth === 0) {
          prelude = text.slice(start, i).replace(AT_STATEMENTS, "").trim();
          start = i + 1;
        }
        depth++;
      } else if (char === "}" && depth > 0) {
        depth--;
        if (depth === 0) {
          const body = text.slice(start, i);
          if (/^@(media|supports)/i.test(prelude)) {
            if (!/prefers-color-scheme\s*:\s*dark/i.test(prelude)) walk(body);
          } else if (!prelude.startsWith("@")) {
            rules.push({
              selectors: prelude.split(",").map((s) => s.trim()),
              body,
            });
          }
          start = i + 1;
        }
      }
    }
  };
  walk(stripComments(css).slice(0, MAX_CSS_CHARS));
  return rules;
}

export function declarations(body: string): [string, string][] {
  return body
    .split(";")
    .flatMap((part) => {
      const colon = part.indexOf(":");
      if (colon < 0) return [];
      return [[part.slice(0, colon).trim(), part.slice(colon + 1).trim()]] as [
        string,
        string,
      ][];
    })
    .filter(([name]) => name !== "");
}
