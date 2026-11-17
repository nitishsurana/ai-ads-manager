import type { UIMessage } from "ai";
import { z } from "zod";

export type ChatUIMessage = UIMessage<unknown, { intake: { id: string } }>;

export const changeSchema = z.object({ label: z.string(), text: z.string() });
export type Change = z.infer<typeof changeSchema>;

export const researchSchema = z.object({
  topic: z.string(),
  notes: z.array(z.string()),
  sources: z.array(z.object({ label: z.string(), href: z.url() })),
});
export type Research = z.infer<typeof researchSchema>;

// What messages.parts holds. The intake workflow writes text parts only.
export const messagePartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("data-change"), data: changeSchema }),
  z.object({ type: z.literal("data-research"), data: researchSchema }),
]);
export type MessagePart = z.infer<typeof messagePartSchema>;

export const messageRowSchema = z.object({
  ui_id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  kind: z.enum([
    "chat",
    "research",
    "brief_update",
    "status",
    "divider",
    "summary",
  ]),
  parts: z.array(messagePartSchema),
});

export type ChatRow = {
  id: string;
  role: "user" | "assistant" | "system";
  kind: z.infer<typeof messageRowSchema>["kind"];
  parts: MessagePart[];
};

export type ChatMode = "empty" | "reading" | "failed" | "confirm";
