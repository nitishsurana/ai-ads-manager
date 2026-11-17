import type { z } from "zod";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Ai } from "@/lib/providers/ai";
import type { Dns } from "@/lib/providers/dns";
import type { MaskFal } from "@/lib/intake";
import type { Firecrawl } from "@/lib/providers/firecrawl";
import type { Http, HttpResponse } from "@/lib/providers/http";
import { aiSnapshotKey } from "@/lib/providers/ai";
import {
  aiSnapshotSchema,
  dnsSnapshotSchema,
  falSnapshotSchema,
  firecrawlSnapshotSchema,
  httpSnapshotSchema,
  readSnapshotBody,
  recordedErrorSchema,
  readSnapshotJson,
  sha256,
  SnapshotError,
  type CaseSnapshot,
} from "@/lib/providers/snapshot";

const SECRET_HEADERS = new Set([
  "set-cookie",
  "cookie",
  "authorization",
  "proxy-authorization",
]);

type HttpLog = z.infer<typeof httpSnapshotSchema>;

export function createRecorder(dir: string) {
  const dnsLog: z.infer<typeof dnsSnapshotSchema> = {};
  const httpLog: HttpLog = {};
  const firecrawlLog: z.infer<typeof firecrawlSnapshotSchema> = {};
  const aiLog: z.infer<typeof aiSnapshotSchema> = {};
  const falLog: z.infer<typeof falSnapshotSchema> = {};
  const bodies = new Map<string, Buffer>();

  // Pages cost credits and model calls cost money, so a re-record keeps what a row already has. Delete ai.json or fal.json to refresh model answers; deleting the folder would throw away paid Firecrawl pages.
  function keep<T>(
    file: string,
    schema: z.ZodType<Record<string, T>>,
    into: Record<string, T>,
    bodyRefOf: (entry: T) => string | null = () => null,
  ) {
    if (!existsSync(join(dir, file))) return;
    for (const [key, entry] of Object.entries(
      readSnapshotJson(dir, file, schema),
    )) {
      into[key] = entry;
      const ref = bodyRefOf(entry);
      if (ref) bodies.set(ref, readSnapshotBody(dir, ref));
    }
  }
  keep("dns.json", dnsSnapshotSchema, dnsLog);
  keep("http.json", httpSnapshotSchema, httpLog, (entry) =>
    "body" in entry ? entry.body : null,
  );
  keep(
    "firecrawl.json",
    firecrawlSnapshotSchema,
    firecrawlLog,
    (entry) => entry.html,
  );
  keep("ai.json", aiSnapshotSchema, aiLog);
  keep("fal.json", falSnapshotSchema, falLog, (entry) =>
    typeof entry === "string" ? entry : null,
  );

  function storeBody(body: Buffer) {
    if (body.length === 0) return null;
    const ref = `bodies/${sha256(body)}`;
    bodies.set(ref, body);
    return ref;
  }

  function readBody(ref: string) {
    const body = bodies.get(ref);
    if (!body) throw new Error(`recorder: missing body ${ref}`);
    return body;
  }

  function entryOf(response: HttpResponse): HttpLog[string] {
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
          const kept = dnsLog[host];
          if (kept) {
            return kept === "ENOTFOUND"
              ? { found: false }
              : { found: true, addresses: kept };
          }
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
          const kept = httpLog[`GET ${url}`];
          if (kept) {
            if ("failure" in kept) return { ok: false, reason: kept.failure };
            return {
              ok: true,
              response: {
                status: kept.status,
                headers: kept.headers,
                location: kept.location,
                truncated: kept.truncated,
                body: kept.body ? readBody(kept.body) : Buffer.alloc(0),
              },
            };
          }
          const result = await real.get(url, options);
          if (result.ok) httpLog[`GET ${url}`] = entryOf(result.response);
          else if (result.reason === "timeout" || result.reason === "network") {
            httpLog[`GET ${url}`] = { failure: result.reason };
          }
          return result;
        },
      };
    },

    firecrawl(real: Firecrawl): Firecrawl {
      return {
        async scrapePage(url, options) {
          const kept = firecrawlLog[url];
          if (kept) {
            return {
              ...kept,
              html: readBody(kept.html).toString("utf8"),
              styles: kept.styles ?? null,
            };
          }
          const page = await real.scrapePage(url, options);
          const html = storeBody(Buffer.from(page.html, "utf8"));
          if (!html) throw new Error(`firecrawl: empty page for ${url}`);
          firecrawlLog[url] = {
            status: page.status,
            html,
            location: page.location,
            ...(page.styles && { styles: page.styles }),
          };
          return page;
        },
      };
    },

    ai(real: Ai): Ai {
      return {
        async generate(request) {
          const key = aiSnapshotKey(request);
          const kept = aiLog[key];
          if (kept !== undefined) {
            const failure = recordedErrorSchema.safeParse(kept);
            if (failure.success) throw new Error(failure.data.error);
            const parsed = request.schema.safeParse(kept);
            if (!parsed.success) {
              throw new SnapshotError(`ai: ${key} fails the schema`);
            }
            return { object: parsed.data, costUsd: null };
          }
          try {
            const result = await real.generate(request);
            aiLog[key] = result.object;
            return result;
          } catch (error) {
            throw new SnapshotError(`recording ${key} failed: ${error}`, {
              cause: error,
            });
          }
        },
      };
    },

    fal(real: MaskFal): MaskFal {
      return {
        async backgroundMask(request) {
          const kept = falLog[request.inputSha256];
          if (typeof kept === "string") return readBody(kept);
          if (kept) throw new Error(kept.error);
          try {
            const mask = await real.backgroundMask(request);
            const ref = storeBody(mask);
            if (!ref) throw new Error("fal: empty mask");
            falLog[request.inputSha256] = ref;
            return mask;
          } catch (error) {
            throw new SnapshotError(
              `recording the mask for ${request.inputSha256} failed: ${error}`,
              { cause: error },
            );
          }
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
      if (Object.keys(firecrawlLog).length > 0) {
        write("firecrawl.json", firecrawlLog);
      }
      if (Object.keys(aiLog).length > 0) write("ai.json", aiLog);
      if (Object.keys(falLog).length > 0) write("fal.json", falLog);
      for (const [ref, body] of bodies) writeFileSync(join(dir, ref), body);
    },
  };
}
