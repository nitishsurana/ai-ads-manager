import { NextResponse } from "next/server";
import { z } from "zod";
import { getTester } from "@/lib/auth";
import { createThread } from "@/lib/db";
import { startIntake } from "@/lib/intake/workflow";

// Dev-only: drives the real workflow before the chat exists. Phase 5 deletes it.
const bodySchema = z.object({
  url: z.string().min(1),
  threadId: z.uuid().optional(),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const tester = await getTester();
  if (!tester)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const threadId = body.data.threadId ?? (await createThread(tester.userId));
  const intakeId = await startIntake({
    userId: tester.userId,
    threadId,
    url: body.data.url,
  });
  return NextResponse.json({ intakeId, threadId });
}
