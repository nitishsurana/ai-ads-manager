import type { LanguageModel } from "ai";
import { gatewayClient } from "./real";

export const CHAT_MODEL = "anthropic/claude-opus-5.5";

// The fake pulls in ai/test, so it is imported only when replaying.
export async function createChatModel(): Promise<LanguageModel> {
  if (process.env.PROVIDERS === "fake") {
    return (await import("./fake/chat-model")).createFakeChatModel();
  }
  return gatewayClient()(CHAT_MODEL);
}
