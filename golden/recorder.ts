import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Dns } from "@/lib/providers/dns";
import type { Http, HttpResponse } from "@/lib/providers/http";
import { sha256, type CaseSnapshot } from "@/lib/providers/snapshot";

const SECRET_HEADERS = new Set([
  "set-cookie",
  "cookie",
  "authorization",
  "proxy-authorization",
]);

type HttpEntry = Record<string, unknown>;

export function createRecorder(dir: string) {
  const dnsLog: Record<string, string[] | "ENOTFOUND"> = {};
  const httpLog: Record<string, HttpEntry> = {};
  const bodies = new Map<string, Buffer>();

  function storeBody(body: Buffer) {
    if (body.length === 0) return null;
    const ref = `bodies/${sha256(body)}`;
    bodies.set(ref, body);
    return ref;
  }

  function entryOf(response: HttpResponse): HttpEntry {
    const headers = Object.fromEntries(
      Object.entries(response.headers).filter(([k]) => !SECRET_HEADERS.has(k)),
    );
    return {
      status: response.status,
      headers,
      location: response.location,
      body: storeBody(response.body),
      truncated: response.truncated,
    };
  }

  return {
    dns(real: Dns): Dns {
      return {
        async lookup(host) {
          const result = await real.lookup(host);
          dnsLog[host] = result.found ? result.addresses : "ENOTFOUND";
          return result;
        },
      };
    },

    // Guard rejections ("dns", "blocked") are not stored: replay re-runs the guard against the recorded DNS.
    http(real: Http): Http {
      return {
        async get(url, options) {
          const result = await real.get(url, options);
          if (result.ok) httpLog[`GET ${url}`] = entryOf(result.response);
          else if (result.reason === "timeout" || result.reason === "network") {
            httpLog[`GET ${url}`] = { failure: result.reason };
          }
          return result;
        },
      };
    },

    save(caseData: CaseSnapshot) {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(join(dir, "bodies"), { recursive: true });
      const write = (file: string, data: unknown) =>
        writeFileSync(join(dir, file), `${JSON.stringify(data, null, 2)}\n`);

      write("case.json", caseData);
      write("dns.json", dnsLog);
      write("http.json", httpLog);
      for (const [ref, body] of bodies) writeFileSync(join(dir, ref), body);
    },
  };
}
