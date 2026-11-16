import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function passwordMatches(input: string, expected: string) {
  return timingSafeEqual(digest(input), digest(expected));
}
