const SLUG_MAX = 40;

function slug(text: string, fallback: string) {
  const cleaned = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
  return cleaned || fallback;
}

// `<store>-<product>-r<round>-c<n>[-<CURRENCY>].png`; the currency code only when the creative shows a price.
export function creativeFileName(input: {
  store: string | null;
  product: string;
  round: number;
  n: number;
  currency: string | null;
}) {
  const parts = [
    slug(input.store ?? "", "store"),
    slug(input.product, "product"),
    `r${input.round}`,
    `c${input.n}`,
    ...(input.currency ? [input.currency.toUpperCase()] : []),
  ];
  return `${parts.join("-")}.png`;
}
