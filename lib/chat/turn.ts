import "server-only";
import {
  consumeStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  isStepCount,
  streamText,
} from "ai";
import { z } from "zod";
import {
  createThread,
  findReadingIntakeId,
  getThread,
  deleteThread,
  insertCosts,
  insertMessage,
  moveMessage,
  listFacts,
  type Thread,
} from "@/lib/db/queries";
import { startIntake } from "@/lib/intake/workflow";
import { mergeFinishedIntake } from "@/lib/workspace";
import { messages } from "@/lib/messages";
import {
  CHAT_MODEL,
  createChatModel,
  createResearcher,
  gatewayCostUsd,
} from "@/lib/providers/ai";
import { readCampaign } from "./campaign";
import { toModelMessages } from "./history";
import { systemPrompt } from "./prompt";
import { loadRows } from "./rows";
import { createChatTools } from "./tools";
import { changeSchema, type ChatUIMessage, type MessagePart } from "./types";
import { findUrls } from "./url";

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_STEPS = 5;
const TIMEOUT_MS = 120_000;

export const chatRequestSchema = z.object({
  threadId: z.uuid(),
  message: z.object({
    // Client ids are 12+ alphanumerics; server ids such as "brief" or "intake-…" can never match.
    id: z.string().regex(/^[A-Za-z0-9]{12,64}$/),
    parts: z
      .tuple([
        z.object({
          type: z.literal("text"),
          text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
        }),
      ])
      .rest(z.never()),
  }),
});

type ChatRequest = z.infer<typeof chatRequestSchema>;

const changedOutputSchema = z.object({ changed: z.array(changeSchema) });

function postStatus(
  userId: string,
  threadId: string,
  uiId: string,
  text: string,
) {
  return insertMessage(userId, {
    threadId,
    uiId,
    role: "assistant",
    kind: "status",
    parts: [{ type: "text", text }],
  });
}

// A reading intake is told to the tester and left alone; any other start failure reads as the generic intake failure. The caller posts the returned status.
async function startReading(userId: string, threadId: string, url: string) {
  if (await findReadingIntakeId(userId, threadId)) {
    return { status: messages.intake_running };
  }
  try {
    return { intakeId: await startIntake({ userId, threadId, url }) };
  } catch (error) {
    console.error(
      `chat: starting an intake for thread ${threadId} failed`,
      error,
    );
    return { status: messages.intake_failed };
  }
}

function assistantParts(parts: ChatUIMessage["parts"]): MessagePart[] {
  return parts.flatMap((part): MessagePart[] => {
    if (part.type === "text") {
      return part.text ? [{ type: "text", text: part.text }] : [];
    }
    if (
      (part.type === "tool-set_campaign" || part.type === "tool-add_fact") &&
      "output" in part
    ) {
      const output = changedOutputSchema.safeParse(part.output);
      return output.success
        ? output.data.changed.map((data) => ({ type: "data-change", data }))
        : [];
    }
    return [];
  });
}

// Returns null when the thread isn't the caller's.
export async function runChatTurn(userId: string, request: ChatRequest) {
  const viewed = await getThread(userId, request.threadId);
  if (!viewed) return null;
  let thread: Thread = viewed;

  const text = request.message.parts[0].text;
  const urls = findUrls(text);
  const url = urls[0] ?? null;
  const messageId = request.message.id;

  const inserted = await insertMessage(userId, {
    threadId: viewed.id,
    uiId: messageId,
    role: "user",
    kind: "chat",
    parts: [{ type: "text", text }],
  });
  if (!inserted) {
    return Response.json({ error: "duplicate message" }, { status: 409 });
  }

  let intakeId: string | null = null;
  if (url) {
    // A thread that is already a workspace starts a new thread for the link; the viewed thread is only left once the intake started.
    const target = viewed.workspaceId ? await createThread(userId) : viewed.id;
    const started = await startReading(userId, target, url);
    if (started.intakeId) {
      intakeId = started.intakeId;
      if (target !== viewed.id) {
        await moveMessage(userId, viewed.id, target, messageId);
        thread = { id: target, workspaceId: null, campaign: {} };
      }
    } else {
      if (target !== viewed.id) await deleteThread(userId, target);
      await postStatus(
        userId,
        viewed.id,
        `${messageId}-intake-status`,
        started.status ?? messages.intake_failed,
      );
    }
    if (intakeId && urls.length > 1) {
      await postStatus(
        userId,
        thread.id,
        `${messageId}-extra-links`,
        messages.extra_links,
      );
    }
  }
  const threadId = thread.id;

  const [rows, facts, campaign] = await Promise.all([
    loadRows(userId, threadId),
    listFacts(userId, threadId),
    readCampaign(userId, thread),
  ]);
  const assistantId = generateId();
  const tools = createChatTools({
    userId,
    thread,
    assistantId,
    researcher: createResearcher(),
  });

  const onError = (error: unknown) => {
    console.error(`chat: thread ${threadId} failed`, error);
    return messages.chat_failed;
  };

  const stepCosts: (number | null)[] = [];

  const stream = createUIMessageStream<ChatUIMessage>({
    originalMessages: [
      { id: request.message.id, role: "user", parts: [{ type: "text", text }] },
    ],
    onError,
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId: assistantId });
      if (intakeId) {
        writer.write({ type: "data-intake", data: { id: intakeId } });
      }
      const result = streamText({
        model: await createChatModel(),
        system: systemPrompt({ campaign, facts, hasLink: url !== null }),
        messages: toModelMessages(rows),
        tools,
        stopWhen: isStepCount(MAX_STEPS),
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        onStepEnd: (step) => {
          stepCosts.push(gatewayCostUsd(step.providerMetadata));
        },
      });
      writer.merge(result.toUIMessageStream({ sendStart: false, onError }));
    },
    onEnd: async ({ responseMessage }) => {
      // Whatever usage was reported counts, including a turn that errored or timed out after some steps.
      if (stepCosts.length > 0) {
        await insertCosts(
          userId,
          (await getThread(userId, threadId))?.workspaceId ?? null,
          [
            {
              provider: "ai",
              model: CHAT_MODEL,
              usd: stepCosts.some((cost) => cost !== null)
                ? stepCosts.reduce<number>((sum, cost) => sum + (cost ?? 0), 0)
                : null,
              meta: { thread_id: threadId, kind: "chat" },
            },
          ],
        );
      }
      if (intakeId) {
        await mergeFinishedIntake(userId, threadId, intakeId).catch((error) =>
          console.error(`chat: merging intake ${intakeId} failed`, error),
        );
      }
      const parts = assistantParts(responseMessage.parts);
      if (parts.length === 0) return;
      await insertMessage(userId, {
        threadId,
        uiId: assistantId,
        role: "assistant",
        kind: "chat",
        parts,
      });
      if (parts.some((part) => part.type === "data-change")) {
        await insertMessage(userId, {
          threadId,
          uiId: "brief",
          role: "assistant",
          kind: "brief_update",
          parts: [{ type: "text", text: "Added to the creative brief" }],
        });
      }
    },
  });

  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: ({ stream }) => consumeStream({ stream }),
  });
}
