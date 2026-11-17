const CURRENCIES = ["USD", "CAD", "INR", "EUR", "GBP"];

// The currencies the confirm screen offers: the fixed list plus the page's own.
export const currencyChoices = (pageCurrency: string) =>
  CURRENCIES.includes(pageCurrency)
    ? CURRENCIES
    : [...CURRENCIES, pageCurrency];
