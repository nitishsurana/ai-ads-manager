import { lookup } from "node:dns/promises";
import type { Dns } from "./types";

const TIMEOUT_MS = 5_000;

function timeout() {
  let timer: NodeJS.Timeout | undefined;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("DNS lookup timed out")),
      TIMEOUT_MS,
    );
  });
  return { promise, clear: () => clearTimeout(timer) };
}

export function createRealDns(): Dns {
  return {
    async lookup(host) {
      const timer = timeout();
      try {
        const records = await Promise.race([
          lookup(host, { all: true, verbatim: true }),
          timer.promise,
        ]);
        return records.length > 0
          ? { found: true, addresses: records.map((r) => r.address) }
          : { found: false };
      } catch {
        // Any resolver failure means the shopper-facing answer is the same: the host doesn't resolve.
        return { found: false };
      } finally {
        timer.clear();
      }
    },
  };
}
