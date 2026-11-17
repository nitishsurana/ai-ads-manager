import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runIntake } from "@/lib/intake";
import type { Ai } from "@/lib/providers/ai";
import { createDns } from "@/lib/providers/dns";
import { createFirecrawl } from "@/lib/providers/firecrawl";
import { createHttp } from "@/lib/providers/http";
import { sha256 } from "@/lib/providers/snapshot";
import { createLocalStorage } from "@/lib/providers/storage";
import { createRecorder } from "../recorder";
import { photo } from "./images";
import { CLEAN_CHECK, COPY, IMAGES, STOREFRONT_QUERY, type Spec } from "./spec";

function page(head: string, body: string) {
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

const FORM =
  '<main><div id="shopify-section-template--1__main" class="shopify-section"><h1>Blue Mug</h1><div class="price"><span class="price-item">$18.00</span></div><form action="/cart/add" method="post"><input type="hidden" name="id" value="4455"><button type="submit" name="add">Add to cart</button></form></div></main>';

function writeFixture(spec: Spec) {
  const host = spec.host ?? "shop.example";
  const productUrl = `https://${host}/products/blue-mug`;
  const dir = join("golden", "fixtures", spec.name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "bodies"), { recursive: true });

  const body = (data: Buffer | string) => {
    const bytes = Buffer.from(data);
    const ref = `bodies/${sha256(bytes)}`;
    writeFileSync(join(dir, ref), bytes);
    return ref;
  };
  const json = (file: string, data: unknown) =>
    writeFileSync(join(dir, file), `${JSON.stringify(data, null, 2)}\n`);

  const productPage = page(
    spec.head ?? "<title>Blue Mug</title>",
    `${spec.header}${FORM}${spec.footer ?? ""}`,
  );
  const aboutHref = spec.about === undefined ? "" : "/pages/our-story";
  const homepage = page(
    spec.homeHead ?? "<title>Home</title>",
    `<footer>${aboutHref ? `<a href="${aboutHref}">Our story</a>` : ""}</footer>`,
  );

  const productJson = {
    product: {
      id: 1,
      title: "Blue Mug",
      handle: "blue-mug",
      images: [
        {
          id: 1,
          position: 1,
          src: `${IMAGES}/photo.png`,
          width: 800,
          height: 800,
        },
      ],
      variants: [
        {
          id: 4455,
          title: "Small",
          price: "18.00",
          compare_at_price: null,
          option1: "Small",
          option2: null,
          option3: null,
        },
      ],
      options: [{ id: 1, name: "Size", position: 1, values: ["Small"] }],
    },
  };
  const response = (
    type: string,
    data: Buffer | string | null,
    status = 200,
  ) => ({
    status,
    headers: { "content-type": type, "powered-by": "Shopify" },
    location: null,
    body: data === null ? null : body(data),
  });
  const http: Record<string, unknown> = {
    [`GET ${productUrl}`]: response(
      "text/html",
      "<html><title>Blue Mug</title></html>",
    ),
    [`GET ${productUrl}.json`]: response(
      "application/json",
      JSON.stringify(productJson),
    ),
  };
  return {
    spec,
    host,
    productUrl,
    dir,
    body,
    json,
    productPage,
    homepage,
    http,
    response,
  };
}

export async function writeAll(specs: Spec[]) {
  const photoBytes = await photo();
  for (const spec of specs) {
    const f = writeFixture(spec);
    const { dir, body, json, http, response } = f;
    http[`GET ${IMAGES}/photo.png`] = response("image/png", photoBytes);
    for (const [name, file] of Object.entries(spec.files ?? {})) {
      const type = name.endsWith(".svg")
        ? "image/svg+xml"
        : name.endsWith(".css")
          ? "text/css"
          : "image/png";
      http[`GET ${IMAGES}/${name}`] =
        typeof file === "number"
          ? { status: file, headers: {}, location: null, body: null }
          : response(type, file);
    }
    if (spec.storefront !== undefined) {
      const url = `https://${f.host}/api/2026-07/graphql.json?query=${STOREFRONT_QUERY}`;
      http[`GET ${url}`] =
        typeof spec.storefront === "number"
          ? { status: spec.storefront, headers: {}, location: null, body: null }
          : response(
              "application/json",
              JSON.stringify({
                data: {
                  shop: {
                    brand: spec.storefront
                      ? { logo: { image: { url: spec.storefront } } }
                      : null,
                  },
                },
              }),
            );
    }

    const origin = `https://${f.host}`;
    json("case.json", { url: f.productUrl, location: "US" });
    json("dns.json", {
      [f.host]: ["93.184.216.34"],
      "cdn.shopify.com": ["23.227.38.65"],
    });
    json("http.json", http);
    const pages: Record<string, unknown> = {
      [f.productUrl]: {
        status: 200,
        html: body(f.productPage),
        location: "US",
        ...(spec.styles && { styles: spec.styles }),
      },
      [`${origin}/`]: { status: 200, html: body(f.homepage), location: "US" },
    };
    if (spec.about !== undefined) {
      pages[`${origin}/pages/our-story`] = {
        status: 200,
        html: body(spec.about),
        location: "US",
      };
    }
    json("firecrawl.json", pages);

    await record(spec, dir);
    console.log(`wrote ${spec.name}`);
  }
}

// Replays the universe once with a scripted model and keeps what was used plus the answers.
async function record(spec: Spec, dir: string) {
  const recorder = createRecorder(dir);
  const dns = createDns({ snapshotDir: dir });
  const http = createHttp({ dns, snapshotDir: dir });
  const queue = [...(spec.verdicts ?? [])];
  const ai: Ai = {
    async generate(request) {
      if (request.task.startsWith("photo_check")) {
        return { object: request.schema.parse(CLEAN_CHECK), costUsd: null };
      }
      if (request.task === "brand_copy") {
        return { object: request.schema.parse(COPY), costUsd: null };
      }
      const verdict = queue.shift();
      if (request.task !== "logo_check" || !verdict) {
        throw new Error(`${spec.name}: no scripted answer for ${request.task}`);
      }
      return { object: request.schema.parse(verdict), costUsd: null };
    },
  };
  const outcome = await runIntake(
    {
      url: `https://${spec.host ?? "shop.example"}/products/blue-mug`,
      intakeId: spec.name,
    },
    {
      http: recorder.http(http),
      firecrawl: recorder.firecrawl(createFirecrawl({ snapshotDir: dir })),
      ai: recorder.ai(ai),
      fal: {
        async backgroundMask() {
          throw new Error(`${spec.name}: no mask expected`);
        },
      },
      storage: createLocalStorage(
        mkdtempSync(join(tmpdir(), "brand-fixture-")),
      ),
      progress: () => {},
      findWorkspace: async () => null,
    },
  );
  if (!outcome.ok || !("result" in outcome)) {
    throw new Error(`${spec.name}: ${JSON.stringify(outcome)}`);
  }
  if (queue.length > 0) {
    throw new Error(`${spec.name}: ${queue.length} scripted verdicts unused`);
  }
  const { logo, storeName } = outcome.result.brand;
  console.log(
    `  ${spec.name}: ${logo?.source ?? "no logo"} / ${storeName ?? "no name"}`,
  );
  recorder.save({ url: outcome.result.url, location: "US" });
}
