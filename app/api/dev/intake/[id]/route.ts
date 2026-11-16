import { NextResponse } from "next/server";
import { getTester } from "@/lib/auth";
import { readIntake } from "@/lib/intake/workflow";

// Dev-only, like start-intake.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/dev/intake/[id]">,
) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  const tester = await getTester();
  if (!tester)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const intake = await readIntake(tester.userId, id);
  if (!intake)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    status: intake.status,
    progress: intake.progress,
    failure_code: intake.failureCode,
    workspace_id: intake.workspaceId,
  });
}
