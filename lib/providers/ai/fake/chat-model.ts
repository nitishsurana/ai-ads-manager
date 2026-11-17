import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

// The script is a pure function of the last user message: an occasion becomes set_campaign, "N% off ..." or "free ..." becomes add_fact, and the word "research" calls research.
const OCCASION = /\b(diwali|mother's day|christmas|black friday)\b/i;
const AUDIENCE = /\bfor ([a-z ]+?)(?:[.,!]|$)/i;
const FACT = /\b(\d+% off[^.!]*|free [a-z ]+)/i;
const RESEARCH = /\bresearch\b/i;

const usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

const toolOutputSchema = z.object({
  type: z.literal("json"),
  value: z.object({
    changed: z
      .array(z.object({ label: z.string(), text: z.string() }))
      .optional(),
    topic: z.string().optional(),
  }),
});

type Call = { toolName: string; input: Record<string, string> };

function capitalise(text: string) {
  const trimmed = text.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function plan(text: string): Call[] {
  const occasion = OCCASION.exec(text)?.[1];
  const audience = AUDIENCE.exec(text)?.[1];
  const fact = FACT.exec(text)?.[1];
  return [
    ...(occasion
      ? [
          {
            toolName: "set_campaign",
            input: {
              occasion: capitalise(occasion),
              ...(audience && { audience: capitalise(audience) }),
            },
          },
        ]
      : []),
    ...(fact
      ? [
          {
            toolName: "add_fact",
            input: { text: capitalise(fact), kind: "offer" },
          },
        ]
      : []),
    ...(RESEARCH.test(text)
      ? [
          {
            toolName: "research",
            input: { topic: occasion ? capitalise(occasion) : "the occasion" },
          },
        ]
      : []),
  ];
}

function textChunks(text: string) {
  return [
    { type: "stream-start" as const, warnings: [] },
    { type: "text-start" as const, id: "text-1" },
    { type: "text-delta" as const, id: "text-1", delta: text },
    { type: "text-end" as const, id: "text-1" },
    {
      type: "finish" as const,
      finishReason: { unified: "stop" as const, raw: undefined },
      usage,
    },
  ];
}

function reply(toolResults: unknown[]) {
  const outputs = toolResults.flatMap((part) => {
    const parsed = z.object({ output: toolOutputSchema }).safeParse(part);
    return parsed.success ? [parsed.data.output.value] : [];
  });
  const changed = outputs.flatMap((output) => output.changed ?? []);
  const researched = outputs.find((output) => output.topic)?.topic;
  return [
    "Got it.",
    changed.length > 0
      ? `Added ${changed.map((c) => `${c.label}: ${c.text}`).join("; ")}.`
      : "Nothing new to add.",
    researched ? `Researched ${researched}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function createFakeChatModel() {
  return new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      const last = prompt.at(-1);
      if (last?.role === "tool") {
        return {
          stream: simulateReadableStream({
            chunks: textChunks(reply(last.content)),
          }),
        };
      }
      const text =
        last?.role === "user"
          ? last.content
              .flatMap((part) => (part.type === "text" ? [part.text] : []))
              .join(" ")
          : "";
      const calls = plan(text);
      if (calls.length === 0) {
        return {
          stream: simulateReadableStream({ chunks: textChunks("Noted.") }),
        };
      }
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start" as const, warnings: [] },
            ...calls.map((call, index) => ({
              type: "tool-call" as const,
              toolCallId: `call-${index}`,
              toolName: call.toolName,
              input: JSON.stringify(call.input),
            })),
            {
              type: "finish" as const,
              finishReason: { unified: "tool-calls" as const, raw: undefined },
              usage,
            },
          ],
        }),
      };
    },
  });
}
