// A swallowed failure still leaves a trace, so a broken source doesn't pass for a store with no logo.
export function logSwallowed(label: string, what: string, error: unknown) {
  console.error(`brand: ${label}: ${what} failed`, error);
}
