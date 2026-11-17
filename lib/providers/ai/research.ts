import { anthropic } from "@ai-sdk/anthropic";
import { generateText, isStepCount } from "ai";
import { FIRECRAWL_USD_PER_CREDIT } from "@/lib/config";
import { searchWeb } from "@/lib/providers/firecrawl/search";
import { CHAT_MODEL } from "./chat-model";
import { gatewayCostUsd } from "./cost";
import { gatewayClient } from "./real";
import type { Researcher, ResearchResult } from "./types";

const MAX_SEARCHES = 2;
const MAX_NOTES = 4;
const MAX_SOURCES = 5;
const TIMEOUT_MS = 90_000;
// Firecrawl bills search at 2 credits per 10 results.
const SEARCH_CREDITS = 2;

const SYSTEM =
  "You research context for ad creative direction: themes, imagery, tone and what the audience cares about. Never state facts about a specific product or store. Reply with 3 or 4 notes, one per line, each starting with '- ', in plain text without markdown and under 25 words.";

function notesOf(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_NOTES);
}

function sourcesOf(urls: { url: string }[]) {
  const seen = new Set<string>();
  return urls.flatMap(({ url }) => {
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol) || seen.has(url)) return [];
      seen.add(url);
      return [{ label: parsed.hostname.replace(/^www\./, ""), href: url }];
    } catch {
      return [];
    }
  });
}

async function viaWebSearch(topic: string): Promise<ResearchResult> {
  const result = await generateText({
    model: gatewayClient()(CHAT_MODEL),
    system: SYSTEM,
    prompt: `Research "${topic}" for ad creative direction.`,
    tools: {
      web_search: anthropic.tools.webSearch_20260318({
        maxUses: MAX_SEARCHES,
      }),
    },
    stopWhen: isStepCount(3),
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const urls = result.sources.flatMap((source) =>
    source.sourceType === "url" ? [{ url: source.url }] : [],
  );
  return {
    notes: notesOf(result.text),
    sources: sourcesOf(urls).slice(0, MAX_SOURCES),
    costs: [
      {
        provider: "ai",
        model: CHAT_MODEL,
        usd: gatewayCostUsd(result.providerMetadata),
      },
    ],
  };
}

async function viaFirecrawl(topic: string): Promise<ResearchResult> {
  const found = await searchWeb(topic, MAX_SOURCES);
  const context = found
    .map((item) => `${item.title ?? item.url}: ${item.description ?? ""}`)
    .join("\n");
  const result = await generateText({
    model: gatewayClient()(CHAT_MODEL),
    system: SYSTEM,
    prompt: `Research "${topic}" for ad creative direction, using only these search results:\n${context}`,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return {
    notes: notesOf(result.text),
    sources: sourcesOf(found),
    costs: [
      {
        provider: "firecrawl",
        model: null,
        usd: SEARCH_CREDITS * FIRECRAWL_USD_PER_CREDIT,
      },
      {
        provider: "ai",
        model: CHAT_MODEL,
        usd: gatewayCostUsd(result.providerMetadata),
      },
    ],
  };
}

export function createRealResearcher(): Researcher {
  return {
    async research(topic) {
      try {
        return await viaWebSearch(topic);
      } catch (error) {
        console.error("research: web search failed, using Firecrawl", error);
        return viaFirecrawl(topic);
      }
    },
  };
}
