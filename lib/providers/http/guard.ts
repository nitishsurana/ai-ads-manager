import { BlockList, isIP } from "node:net";
import type { Dns } from "@/lib/providers/dns";
import type { HttpFailure } from "./types";

const blocked = new BlockList();

const ipv4Ranges: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

// ::/96 also covers ::1 and the deprecated IPv4-compatible form; 64:ff9b::/96 and 2002::/16 embed an IPv4 address.
const ipv6Ranges: [string, number][] = [
  ["::", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
];

ipv4Ranges.forEach(([net, prefix]) => blocked.addSubnet(net, prefix, "ipv4"));
ipv6Ranges.forEach(([net, prefix]) => blocked.addSubnet(net, prefix, "ipv6"));

// Kept apart because BlockList also tests IPv4 addresses against IPv6 rules as mapped ones, so this range would block every IPv4 host.
const mappedIpv6 = new BlockList();
mappedIpv6.addSubnet("::ffff:0:0", 96, "ipv6");

export function isBlockedAddress(address: string) {
  const bare = address.split("%")[0] ?? address;
  const family = isIP(bare);
  if (family === 0) return true;
  if (family === 6 && mappedIpv6.check(bare, "ipv6")) return true;
  return blocked.check(bare, family === 4 ? "ipv4" : "ipv6");
}

export type GuardResult =
  | { ok: true; addresses: string[] }
  | { ok: false; reason: Extract<HttpFailure, "dns" | "blocked"> };

export async function resolvePublic(url: URL, dns: Dns): Promise<GuardResult> {
  const schemeAllowed = url.protocol === "http:" || url.protocol === "https:";
  // URL drops a scheme's default port, so any port left is a non-standard one.
  if (!schemeAllowed || url.username || url.password || url.port) {
    return { ok: false, reason: "blocked" };
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses = [host];
  if (isIP(host) === 0) {
    const result = await dns.lookup(host);
    if (!result.found) return { ok: false, reason: "dns" };
    addresses = result.addresses;
  }

  if (addresses.some(isBlockedAddress)) return { ok: false, reason: "blocked" };
  return { ok: true, addresses };
}
