import {
  request as httpRequest,
  type IncomingMessage,
  type RequestOptions,
} from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Dns } from "@/lib/providers/dns";
import { resolvePublic } from "./guard";
import type { Http, HttpResponse } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

// The connection can only go to addresses the guard has already validated, so a second DNS answer can't redirect it.
function pinnedLookup(addresses: string[]): LookupFunction {
  const records = addresses.map((address) => ({
    address,
    family: isIP(address),
  }));
  return (_host, options, callback) => {
    const first = records[0];
    if (!first) return callback(new Error("No pinned address"), "", 4);
    if (options.all) return callback(null, records);
    callback(null, first.address, first.family);
  };
}

function decoder(header: string | undefined) {
  const encoding = header?.trim().toLowerCase();
  if (encoding === "gzip") return createGunzip();
  if (encoding === "deflate") return createInflate();
  if (encoding === "br") return createBrotliDecompress();
  return null;
}

// A body over the cap is cut off rather than failed: callers only need the start of oversized pages.
async function readBody(res: IncomingMessage, maxBytes: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  let capped = false;
  const decode = decoder(res.headers["content-encoding"]) ?? new PassThrough();
  try {
    await pipeline(res, decode, async (source: AsyncIterable<Buffer>) => {
      for await (const chunk of source) {
        chunks.push(chunk);
        size += chunk.length;
        if (size > maxBytes) {
          capped = true;
          break;
        }
      }
    });
  } catch (error) {
    // Stopping early tears the streams down, which pipeline reports as a premature close.
    if (!capped) throw error;
  }
  return {
    body: Buffer.concat(chunks).subarray(0, maxBytes),
    truncated: capped,
  };
}

function toHeaders(raw: IncomingMessage["headers"]) {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (value === undefined || name === "set-cookie") continue;
    headers[name] = Array.isArray(value) ? value.join(", ") : value;
  }
  return headers;
}

function resolveLocation(raw: string | undefined, base: URL) {
  if (!raw) return null;
  return URL.parse(raw, base)?.href ?? null;
}

function requestOnce(
  url: URL,
  addresses: string[],
  signal: AbortSignal,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<HttpResponse> {
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;
  const requestOptions: RequestOptions = {
    method: "GET",
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "accept-encoding": "gzip, deflate, br",
    },
    signal,
    lookup: pinnedLookup(addresses),
  };

  return new Promise((resolve, reject) => {
    const req = send(url, requestOptions, (res) => {
      readBody(res, maxBytes).then(({ body, truncated }) => {
        resolve({
          status: res.statusCode ?? 0,
          headers: toHeaders(res.headers),
          location: resolveLocation(res.headers.location, url),
          body,
          truncated,
        });
      }, reject);
    });
    req.on("error", reject);
    req.end();
  });
}

export function createRealHttp({ dns }: { dns: Dns }): Http {
  return {
    async get(rawUrl, options = {}) {
      const url = URL.parse(rawUrl);
      if (!url) return { ok: false, reason: "blocked" };

      const resolved = await resolvePublic(url, dns);
      if (!resolved.ok) return resolved;

      const signal = AbortSignal.timeout(TIMEOUT_MS);
      try {
        const response = await requestOnce(
          url,
          resolved.addresses,
          signal,
          options.maxBytes,
        );
        return { ok: true, response };
      } catch {
        return { ok: false, reason: signal.aborted ? "timeout" : "network" };
      }
    },
  };
}
