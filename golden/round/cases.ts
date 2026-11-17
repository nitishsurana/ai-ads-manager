export type Case = {
  name: string;
  run: () => string | null | Promise<string | null>;
};

export const same = (actual: unknown, expected: unknown) =>
  JSON.stringify(actual) === JSON.stringify(expected)
    ? null
    : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
