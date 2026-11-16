// A swallowed failure still leaves a trace, so an outage doesn't look like a product with no usable photos.
export function logSwallowed(label: string, what: string, error: unknown) {
  console.error(`photos: ${label}: ${what} failed`, error);
}
