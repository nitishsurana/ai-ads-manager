import "server-only";
import { tool } from "ai";
import { z } from "zod";
import {
  insertCosts,
  insertFact,
  getThread,
  insertMessage,
  listFacts,
  type Thread,
} from "@/lib/db/queries";
import { proposeBriefChange } from "@/lib/brief";
import { spendCapReached } from "@/lib/limits";
import type { Researcher } from "@/lib/providers/ai";
import { campaignPatchSchema, mergeCampaign } from "./campaign";
import type { Research } from "./types";

type ToolContext = {
  userId: string;
  thread: Thread;
  assistantId: string;
  researcher: Researcher;
};

export function createChatTools({
  userId,
  thread,
  assistantId,
  researcher,
}: ToolContext) {
  const workspaceId = thread.workspaceId;
  return {
    set_campaign: tool({
      description:
        "Record the occasion, angle or audience the tester states for the campaign. Only pass what they said.",
      inputSchema: campaignPatchSchema,
      execute: async (patch) => ({
        changed: await mergeCampaign(userId, thread.id, patch),
      }),
    }),

    add_fact: tool({
      description:
        "Record a fact the tester states about the product or offer that its page wouldn't show, such as '20% off for Diwali' or 'our candles are vegan'. Use kind offer for discounts, gifts and promotions, otherwise other.",
      inputSchema: z.object({
        text: z.string().trim().min(1).max(200),
        kind: z.enum(["offer", "other"]),
      }),
      execute: async (fact) => {
        const known = await listFacts(userId, thread.id);
        const exists = known.some(
          (item) => item.text.toLowerCase() === fact.text.toLowerCase(),
        );
        if (exists) return { changed: [] };
        await insertFact(userId, thread.id, fact);
        return { changed: [{ label: "Fact", text: fact.text }] };
      },
    }),

    research: tool({
      description:
        "Look up an occasion, audience or domain the tester names, to shape the themes, imagery and tone of the ads. Never use it for facts about the product. At most once per message. The topic is a short label of a few words.",
      inputSchema: z.object({ topic: z.string().trim().min(1).max(120) }),
      execute: async ({ topic }, { toolCallId }) => {
        try {
          if (await spendCapReached()) {
            return {
              topic,
              error: "Spend limit reached for today. Answer without research.",
            };
          }
          const result = await researcher.research(topic);
          await insertCosts(
            userId,
            (await getThread(userId, thread.id))?.workspaceId ?? null,
            result.costs.map((cost) => ({
              ...cost,
              meta: { thread_id: thread.id, kind: "research" },
            })),
          );
          if (result.notes.length === 0) {
            return { topic, error: "No notes found." };
          }
          const research: Research = {
            topic,
            notes: result.notes,
            sources: result.sources,
          };
          await insertMessage(userId, {
            threadId: thread.id,
            uiId: `${assistantId}-research-${toolCallId}`,
            role: "assistant",
            kind: "research",
            parts: [{ type: "data-research", data: research }],
          });
          return { topic, notes: result.notes };
        } catch (error) {
          console.error(`chat: research for thread ${thread.id} failed`, error);
          return { topic, error: "Research is unavailable right now." };
        }
      },
    }),

    ...(workspaceId
      ? {
          propose_brief_change: tool({
            description:
              "Add Do or Don't rules to the workspace's creative brief when the tester gives direction for future rounds, such as 'always show the product outdoors' or 'no pink backgrounds'. Only pass what they said.",
            inputSchema: z.object({
              rules: z
                .array(
                  z.object({
                    kind: z.enum(["do", "dont"]),
                    text: z.string().trim().min(1).max(200),
                  }),
                )
                .min(1)
                .max(5),
            }),
            execute: async ({ rules }) => {
              const added = await proposeBriefChange(
                userId,
                workspaceId,
                rules,
              );
              return {
                changed: added.map((rule) => ({
                  label: rule.kind === "do" ? "Do" : "Don't",
                  text: rule.text,
                })),
              };
            },
          }),
        }
      : {}),
  };
}
