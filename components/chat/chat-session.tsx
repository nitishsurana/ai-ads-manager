"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { examplePrompts } from "@/lib/chat/examples";
import type { ChatMode, ChatUIMessage } from "@/lib/chat/types";
import { splitMessage } from "@/lib/chat/url";
import { messages } from "@/lib/messages";
import { AssistantMessage } from "./assistant-message";
import { ChatComposer } from "./chat-composer";
import { ExamplePrompt } from "./example-prompt";
import { UserMessage } from "./user-message";

const PLACEHOLDER: Record<ChatMode, string> = {
  empty: "Paste a Shopify product link…",
  reading: "Add campaign context…",
  failed: "Paste a Shopify product link…",
  confirm: "Add context or correct something…",
  generating: "Add direction for the next round…",
  round: "Give direction for the next round…",
};

// The server persists every turn, so only the in-flight exchange is rendered from the stream.
const transport = new DefaultChatTransport<ChatUIMessage>({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ id, messages }) => ({
    body: { threadId: id, message: messages.at(-1) },
  }),
});

function textOf(message: ChatUIMessage) {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
}

function progressLabel(message: ChatUIMessage | undefined) {
  const tools = message?.parts.filter((part) => part.type.startsWith("tool-"));
  if (tools?.some((part) => part.type === "tool-research")) {
    return "Researching…";
  }
  if (tools?.length) return "Updating the brief…";
  return message && textOf(message) ? "" : "Thinking…";
}

type ChatSessionProps = {
  threadId: string;
  mode: ChatMode;
  statusLabel: string;
  name: string;
  empty: boolean;
  knownIds: string[];
  children: ReactNode;
};

export function ChatSession({
  threadId,
  mode,
  statusLabel,
  name,
  empty,
  knownIds,
  children,
}: ChatSessionProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const intakeId = useRef<string | null>(null);

  const afterTurn = () => {
    const id = intakeId.current;
    intakeId.current = null;
    if (id) router.push(`/r/${id}`);
    else router.refresh();
  };

  const {
    messages: streamed,
    sendMessage,
    status,
    error,
  } = useChat<ChatUIMessage>({
    id: threadId,
    transport,
    onData: (part) => {
      if (part.type === "data-intake") intakeId.current = part.data.id;
    },
    onFinish: afterTurn,
    onError: afterTurn,
  });

  const busy = status === "submitted" || status === "streaming";
  const known = new Set(knownIds);
  const live = streamed.filter((message) => !known.has(message.id));
  const lastLive = live.at(-1);
  const waiting = busy && lastLive?.role !== "assistant";

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    void sendMessage({ text });
  };

  return (
    <div className="flex h-full w-full flex-col bg-card font-sans text-[13.5px] leading-normal text-foreground">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-semibold">Chat</span>
        <span className="text-xs text-muted-foreground">{statusLabel}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
        <div
          role="log"
          aria-label="Conversation"
          className="flex flex-col gap-4 p-4"
        >
          {empty && live.length === 0 && (
            <>
              <AssistantMessage
                text={`Hi ${name}. Paste a Shopify product link to start.`}
                note="You can add campaign context in plain words: an occasion, something about the product, or who it’s for."
              />
              <div className="flex flex-col gap-2 pl-8">
                <span className="text-xs font-medium text-muted-foreground">
                  Try an example
                </span>
                {examplePrompts.map((example) => (
                  <ExamplePrompt
                    key={example.link}
                    link={example.link}
                    text={example.text}
                    onSelect={() => {
                      setDraft(`${example.link} ${example.text}`);
                      inputRef.current?.focus();
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {children}

          {live.map((message) =>
            message.role === "user" ? (
              <UserMessage
                key={message.id}
                {...splitMessage(textOf(message))}
              />
            ) : (
              <AssistantMessage
                key={message.id}
                text={textOf(message)}
                status={
                  busy && message.id === lastLive?.id
                    ? progressLabel(message)
                    : ""
                }
              />
            ),
          )}
          {waiting && <AssistantMessage status="Thinking…" />}
          {error && !busy && (
            <AssistantMessage tone="error" text={messages.chat_failed} />
          )}
        </div>
      </div>

      <ChatComposer
        value={draft}
        placeholder={PLACEHOLDER[mode]}
        busy={busy}
        inputRef={inputRef}
        onChange={setDraft}
        onSubmit={submit}
      />
    </div>
  );
}
