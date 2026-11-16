import { dnsSnapshotSchema, readSnapshotJson } from "@/lib/providers/snapshot";
import type { Dns } from "../types";

export function createReplayDns(snapshotDir: string): Dns {
  const snapshot = readSnapshotJson(snapshotDir, "dns.json", dnsSnapshotSchema);

  return {
    async lookup(host) {
      const entry = snapshot[host];
      if (entry === undefined) throw new Error(`dns: ${host} was not recorded`);
      return entry === "ENOTFOUND"
        ? { found: false }
        : { found: true, addresses: entry };
    },
  };
}
