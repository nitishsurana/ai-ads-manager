import { z } from "zod";

const ENDPOINT = "https://api.firecrawl.dev/v2/search";
const TIMEOUT_MS = 30_000;

const resultSchema = z.object({
  url: z.string(),
  title: z.string().nullish(),
  description: z.string().nullish(),
});

const responseSchema = z.object({
  success: z.literal(true),
  data: z.union([
    z.object({ web: z.array(resultSchema) }),
    z.array(resultSchema),
  ]),
});

export type SearchResult = z.infer<typeof resultSchema>;

export async function searchWeb(query: string, limit: number) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("firecrawl: FIRECRAWL_API_KEY is not set");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, limit }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`firecrawl: search returned ${response.status}`);
  }
  const { data } = responseSchema.parse(await response.json());
  return Array.isArray(data) ? data : data.web;
}
