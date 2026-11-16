import type { CheerioAPI } from "cheerio";
import { z } from "zod";

const logoSchema = z.union([
  z.string(),
  z.object({ url: z.string().optional() }),
]);

const organisationSchema = z.object({
  "@type": z.union([z.string(), z.array(z.string())]),
  name: z.string().optional(),
  logo: z.union([logoSchema, z.array(logoSchema)]).optional(),
});

export type Organisation = { name: string | null; logo: string | null };

function nodesOf(json: unknown): unknown[] {
  if (Array.isArray(json)) return json.flatMap(nodesOf);
  if (typeof json !== "object" || json === null) return [];
  const graph = "@graph" in json ? nodesOf(json["@graph"]) : [];
  return [json, ...graph];
}

const isOrganisation = (type: string | string[]) =>
  [type].flat().some((t) => /Organization$|^(OnlineStore|Store)$/.test(t));

// The first Organization node in the page's JSON-LD; unparseable blocks are skipped, as on a page with a Liquid error.
export function readOrganisation($: CheerioAPI): Organisation | null {
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    let json: unknown;
    try {
      json = JSON.parse($(script).text());
    } catch {
      continue;
    }
    for (const raw of nodesOf(json)) {
      const node = organisationSchema.safeParse(raw);
      if (!node.success || !isOrganisation(node.data["@type"])) continue;
      const first = [node.data.logo ?? []].flat()[0];
      const logo = typeof first === "string" ? first : (first?.url ?? null);
      return { name: node.data.name?.trim() || null, logo: logo || null };
    }
  }
  return null;
}
