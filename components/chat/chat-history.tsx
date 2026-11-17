import type { Campaign } from "@/lib/chat/campaign";
import type { ChatRow } from "@/lib/chat/types";
import { splitMessage } from "@/lib/chat/url";
import type { Fact } from "@/lib/db/queries";
import { messages, step1FailureCodes } from "@/lib/messages";
import { AssistantMessage } from "./assistant-message";
import { BriefSummary } from "./brief-summary";
import { ChatDivider } from "./chat-divider";
import { ResearchNote } from "./research-note";
import { UserMessage } from "./user-message";

const failureTexts = new Set<string>(
  step1FailureCodes.map((code) => messages[code]),
);

function textOf(row: ChatRow) {
  return row.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
}

type ChatHistoryProps = {
  rows: ChatRow[];
  campaign: Campaign;
  facts: Pick<Fact, "text" | "status">[];
  confirmHref: string | null;
};

function Row({
  row,
  campaign,
  facts,
  confirmHref,
}: Omit<ChatHistoryProps, "rows"> & { row: ChatRow }) {
  const text = textOf(row);
  switch (row.kind) {
    case "chat":
      return row.role === "user" ? (
        <UserMessage {...splitMessage(text)} />
      ) : (
        <AssistantMessage
          text={text}
          bullets={row.parts.flatMap((part) =>
            part.type === "data-change"
              ? [{ label: `${part.data.label}:`, text: part.data.text }]
              : [],
          )}
        />
      );
    case "research":
      return (
        <div className="pl-8">
          {row.parts.map((part) =>
            part.type === "data-research" ? (
              <ResearchNote key={part.data.topic} {...part.data} />
            ) : null,
          )}
        </div>
      );
    case "brief_update":
      if (!Object.values(campaign).some(Boolean) && facts.length === 0) {
        return null;
      }
      return (
        <div className="pl-8">
          <BriefSummary {...campaign} facts={facts} confirmHref={confirmHref} />
        </div>
      );
    case "divider":
      return <ChatDivider label={text} />;
    case "status": {
      const failed = failureTexts.has(text);
      return (
        <AssistantMessage
          text={text}
          tone={failed ? "error" : "default"}
          note={failed ? messages.try_another_link : ""}
        />
      );
    }
    case "summary":
      return <AssistantMessage text={text} />;
  }
}

// A research note reads as the reply's footnote, so it follows the assistant message that came after it.
function researchLast(rows: ChatRow[]) {
  const ordered: ChatRow[] = [];
  let held: ChatRow[] = [];
  for (const row of rows) {
    if (row.kind === "research") {
      held.push(row);
      continue;
    }
    ordered.push(row);
    if (row.kind === "chat" && row.role === "assistant") {
      ordered.push(...held);
      held = [];
    }
  }
  return [...ordered, ...held];
}

export function ChatHistory({
  rows,
  campaign,
  facts,
  confirmHref,
}: ChatHistoryProps) {
  return researchLast(rows).map((row) => (
    <Row
      key={row.id}
      row={row}
      campaign={campaign}
      facts={facts}
      confirmHref={confirmHref}
    />
  ));
}
