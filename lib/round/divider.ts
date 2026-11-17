import "server-only";
import { insertMessage, listRoundCreatives } from "@/lib/db/queries";

// "Round 1 · 3 rated" in the chat, where round 2 begins. The ui_id makes a retry or a second start post it once. The chat is not part of the round, so a failure here is logged and the round goes on.
export async function postRatedDivider(
  userId: string,
  threadId: string,
  round: { id: string; n: number },
) {
  try {
    const rated = (await listRoundCreatives(userId, round.id)).filter(
      (creative) => creative.rating !== null,
    ).length;
    await insertMessage(userId, {
      threadId,
      uiId: `round-${round.n}-rated`,
      role: "system",
      kind: "divider",
      parts: [{ type: "text", text: `Round ${round.n} · ${rated} rated` }],
    });
  } catch (error) {
    console.error(`round ${round.id}: posting the chat divider failed`, error);
  }
}
