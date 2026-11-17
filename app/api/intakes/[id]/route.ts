import { NextResponse } from "next/server";
import { getTester } from "@/lib/auth";
import { getReadingStatus } from "@/lib/intake/reading";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/intakes/[id]">,
) {
  const tester = await getTester();
  if (!tester) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const status = await getReadingStatus(tester.userId, id);
  return status
    ? NextResponse.json(status, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: "not found" }, { status: 404 });
}
