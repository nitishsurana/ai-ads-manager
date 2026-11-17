// A different seed for every attempt and every regeneration of the same candidate, so a redo is a different image.
export const briaSeed = (index: number, attempt = 1, regeneration = 0) =>
  100 + index + 1000 * (attempt - 1) + 100_000 * regeneration;
