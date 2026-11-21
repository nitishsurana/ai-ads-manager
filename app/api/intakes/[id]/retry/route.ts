import { NextResponse } from "next/server";
import { getTester } from "@/lib/auth";
import {
  IntakeConflictError,
  readIntake,
  startIntake,
} from "@/lib/intake/workflow";
import { messages } from "@/lib/messages";

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/intakes/[id]/retry">,
) {
  const tester = await getTester();
  if (!tester) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const intake = await readIntake(tester.userId, id);
  if (!intake) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!intake.canRetry) {
    return NextResponse.json({ error: messages.retry_failed }, { status: 409 });
  }

  try {
    const intakeId = await startIntake({
      userId: tester.userId,
      threadId: intake.threadId,
      url: intake.url,
    });
    return NextResponse.json({ intakeId });
  } catch (error) {
    if (error instanceof IntakeConflictError) {
      return NextResponse.json(
        { error: messages.intake_running },
        { status: 409 },
      );
    }
    console.error(`intake ${id}: retry failed to start`, error);
    return NextResponse.json({ error: messages.retry_failed }, { status: 500 });
  }
}
