const SCHEME_URL = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;
const BARE_URL =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?\/\S*$/i;
const LEADING_PUNCTUATION = /^[("'<[]+/;
const TRAILING_PUNCTUATION = /[)"'>\].,;:!?]+$/;

// The exact string is returned (surrounding punctuation aside): the model never rewrites links, and validation owns the verdict.
export function findUrls(text: string) {
  return text.split(/\s+/).flatMap((token) => {
    const candidate = token
      .replace(LEADING_PUNCTUATION, "")
      .replace(TRAILING_PUNCTUATION, "");
    return SCHEME_URL.test(candidate) || BARE_URL.test(candidate)
      ? [candidate]
      : [];
  });
}

export function findUrl(text: string) {
  return findUrls(text)[0] ?? null;
}

export function splitMessage(text: string) {
  const link = findUrl(text);
  const rest = link ? text.replace(link, "") : text;
  return {
    link: link ?? "",
    text: rest
      .replace(/\s+/g, " ")
      .replace(/[\s:;,\u2013-]+$/, "")
      .trim(),
  };
}
