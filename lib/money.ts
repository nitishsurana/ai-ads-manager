// The amount in a price as the page prints it ("$1,299.00", "CA$59.99", "1.299,00 €"): the last separator is the decimal point only when one or two digits follow it.
export function parseAmount(token: string) {
  const digits = token.replace(/[^\d.,]/g, "");
  const lastSeparator = Math.max(
    digits.lastIndexOf("."),
    digits.lastIndexOf(","),
  );
  const hasDecimals =
    lastSeparator >= 0 && digits.length - lastSeparator - 1 <= 2;
  const whole = (hasDecimals ? digits.slice(0, lastSeparator) : digits).replace(
    /[.,]/g,
    "",
  );
  const fraction = hasDecimals ? digits.slice(lastSeparator + 1) : "0";
  return Number(`${whole || "0"}.${fraction || "0"}`);
}

const MAX_TYPED_AMOUNT = 1_000_000;
// US style: commas group thousands, a dot starts one or two decimals; "60,50" is also read as a decimal comma.
const TYPED_AMOUNT =
  /^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?|\d+,\d{1,2})$/;

// What a tester typed as a price, symbol or code around it allowed: one well-formed positive amount up to a million, or null (blank, no digit, negative, exponent, several numbers, more than two decimals).
export function typedAmount(text: string) {
  if (/[-\u2212(]\s*[^\d\s]*\d/.test(text)) return null;
  const tokens = text.match(/[\d.,]*\d[\d.,]*/g);
  const token = tokens?.length === 1 ? tokens[0] : undefined;
  if (!token || !TYPED_AMOUNT.test(token)) return null;
  const amount = Number(
    /^\d+,\d{1,2}$/.test(token)
      ? token.replace(",", ".")
      : token.replace(/,/g, ""),
  );
  return amount > 0 && amount <= MAX_TYPED_AMOUNT ? amount : null;
}

export function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}
