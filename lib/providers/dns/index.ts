import { createReplayDns } from "./fake";
import { createRealDns } from "./real";
import type { Dns } from "./types";

export type { Dns, DnsResult } from "./types";
export { createRealDns };

export function createDns(options: { snapshotDir?: string } = {}): Dns {
  if (process.env.PROVIDERS !== "fake") return createRealDns();
  if (!options.snapshotDir) throw new Error("dns: replay needs a snapshotDir");
  return createReplayDns(options.snapshotDir);
}
