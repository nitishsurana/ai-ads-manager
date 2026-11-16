export function check(error: { message: string } | null, operation: string) {
  if (error) throw new Error(`db: ${operation}: ${error.message}`);
}
