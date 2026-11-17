import { NextResponse } from "next/server";
import { getTester } from "@/lib/auth";
import { chatRequestSchema, runChatTurn } from "@/lib/chat";

export const maxDuration = 120;

export async function POST(request: Request) {
  const tester = await getTester();
  if (!tester) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = chatRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const response = await runChatTurn(tester.userId, body.data);
  return response ?? NextResponse.json({ error: "not found" }, { status: 404 });
}
